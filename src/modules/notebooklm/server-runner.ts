import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { approveNotebookLMTask } from "./core";
import { NotebookLMGuard } from "./guard";
import { LegacyNotebookLMSkillProvider, type LegacyNotebookLMOperation } from "./legacy-provider";
import { createPilotTransferManifest, networkingNotebookLMBundle, notebookLMPilotSources, notebookLMPilotTasks, notebookLMPromptHashes } from "./pilot-registry";
import type { NotebookLMAutomationPlan, NotebookLMProviderResult } from "./types";

const allowedOperations = new Set<LegacyNotebookLMOperation>(["EXECUTE", "INSPECT_HOME", "LOCATE_NOTEBOOK", "INSPECT_STUDIO", "INSPECT_REPORTS", "INSPECT_STUDY_GUIDE_SELECTION", "INSPECT_ARTIFACT_VIEW", "INSPECT_SOURCES", "PREPARE_STUDIO_INSPECTION", "ENSURE_NOTEBOOK", "ATTACH_SOURCES", "SUBMIT_PROMPT", "REQUEST_ARTIFACT", "WAIT_FOR_ARTIFACT", "LIST_ARTIFACTS", "RECOVER_ARTIFACT", "CANCEL", "CLEANUP"]);
const resultMarker = "ELOS_NOTEBOOKLM_RESULT=";
const provider = new LegacyNotebookLMSkillProvider(async () => ({ status: "AUTOMATION_FAILED", detailCode: "SERVER_ONLY" }));

function sameJson(left: unknown, right: unknown) { return JSON.stringify(left) === JSON.stringify(right); }

export function validateControlledPilotPlan(candidate: unknown): NotebookLMAutomationPlan {
  if (!candidate || typeof candidate !== "object") throw new Error("INVALID_AUTOMATION_PLAN");
  const plan = candidate as NotebookLMAutomationPlan;
  const template = notebookLMPilotTasks.find((task) => task.id === plan.taskId);
  if (!template || typeof plan.createdAt !== "string" || typeof plan.manifest?.approvedAt !== "string") throw new Error("PILOT_PLAN_SCOPE_BLOCKED");
  const approvedTask = approveNotebookLMTask(template, networkingNotebookLMBundle, notebookLMPilotSources, true, plan.manifest.approvedAt);
  const expectedManifest = createPilotTransferManifest(approvedTask);
  const expected = new NotebookLMGuard().createExecutionPlan({
    task: approvedTask,
    bundle: networkingNotebookLMBundle,
    sources: notebookLMPilotSources,
    manifest: expectedManifest,
    providerId: provider.id,
    notebookTitle: "ELOS — Networking — OSI TCP-IP Foundations",
    promptHash: notebookLMPromptHashes[approvedTask.promptTemplateId],
    createdAt: plan.createdAt,
    forceNewArtifact: plan.forceNewArtifact,
  });
  const exact = plan.id === expected.id
    && plan.providerId === expected.providerId
    && plan.artifactType === expected.artifactType
    && plan.resolvedPrompt === expected.resolvedPrompt
    && plan.promptTemplateId === expected.promptTemplateId
    && plan.promptHash === expected.promptHash
    && plan.notebookTitle === expected.notebookTitle
    && plan.forceNewArtifact === expected.forceNewArtifact
    && sameJson(plan.manifest, expected.manifest);
  if (!exact) throw new Error("PILOT_PLAN_TAMPERED");
  return expected;
}

export async function verifyControlledManifest(plan: NotebookLMAutomationPlan) {
  const workspace = path.resolve(/*turbopackIgnore: true*/ process.cwd());
  for (const file of plan.manifest.files) {
    const absolute = path.resolve(/*turbopackIgnore: true*/ workspace, file.relativePath);
    if (absolute !== workspace && !absolute.startsWith(`${workspace}${path.sep}`)) throw new Error("MANIFEST_PATH_OUTSIDE_WORKSPACE");
    const fileStat = await stat(absolute);
    if (!fileStat.isFile() || fileStat.size !== file.sizeBytes) throw new Error("MANIFEST_FILE_INTEGRITY_MISMATCH");
    const digest = createHash("sha256").update(await readFile(absolute)).digest("hex").toUpperCase();
    if (digest !== file.sha256.toUpperCase()) throw new Error("MANIFEST_FILE_INTEGRITY_MISMATCH");
  }
}

function parseProviderOutput(output: string): NotebookLMProviderResult | NotebookLMProviderResult[] {
  const line = output.split(/\r?\n/).reverse().find((value) => value.startsWith(resultMarker));
  if (!line) return { status: "AUTOMATION_FAILED", detailCode: "PROVIDER_OUTPUT_INVALID" };
  try {
    const parsed = JSON.parse(line.slice(resultMarker.length)) as NotebookLMProviderResult | NotebookLMProviderResult[];
    if (Array.isArray(parsed)) return parsed;
    if (!parsed || !["SUCCESS", "AUTOMATION_FAILED", "HUMAN_LOGIN_REQUIRED", "CANCELLED"].includes(parsed.status)) throw new Error("status");
    if (parsed.artifact?.recoveredContent && parsed.artifact.recoveredContent.length > 100_000) parsed.artifact.recoveredContent = parsed.artifact.recoveredContent.slice(0, 100_000);
    return parsed;
  } catch {
    return { status: "AUTOMATION_FAILED", detailCode: "PROVIDER_OUTPUT_INVALID" };
  }
}

export async function runControlledLegacyProvider(plan: NotebookLMAutomationPlan, operation: LegacyNotebookLMOperation) {
  if (!allowedOperations.has(operation)) return { status: "AUTOMATION_FAILED", detailCode: "OPERATION_BLOCKED" } satisfies NotebookLMProviderResult;
  await verifyControlledManifest(plan);
  const workspace = path.resolve(/*turbopackIgnore: true*/ process.cwd());
  const python = path.join(workspace, "skill notebooklm", ".venv", "Scripts", "python.exe");
  const script = path.join(workspace, "skill notebooklm", "scripts", "elos_automation.py");
  await Promise.all([access(python), access(script)]);
  const sessionRoot = path.join(workspace, ".local", "notebooklm-session");

  return await new Promise<NotebookLMProviderResult | NotebookLMProviderResult[]>((resolve) => {
    const child = spawn(python, [script, "--operation", operation], {
      cwd: workspace,
      env: { ...process.env, PYTHONUTF8: "1", NOTEBOOKLM_SESSION_ROOT: sessionRoot, ELOS_WORKSPACE_ROOT: workspace },
      windowsHide: false,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout = `${stdout}${String(chunk)}`.slice(-200_000); });
    child.stderr.on("data", () => undefined);
    const timer = setTimeout(() => {
      child.kill();
      resolve({ status: "AUTOMATION_FAILED", detailCode: "GENERATION_TIMEOUT" });
    }, 12 * 60 * 1000);
    child.on("error", () => { clearTimeout(timer); resolve({ status: "AUTOMATION_FAILED", detailCode: "PROVIDER_RUNTIME_UNAVAILABLE" }); });
    child.on("close", () => { clearTimeout(timer); resolve(parseProviderOutput(stdout)); });
    child.stdin.end(JSON.stringify({ plan }));
  });
}
