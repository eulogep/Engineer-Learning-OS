import { createHash } from "node:crypto";
import { spawn, type ChildProcessByStdio, type SpawnOptionsWithStdioTuple, type StdioPipe } from "node:child_process";
import type { Readable, Writable } from "node:stream";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { approveNotebookLMTask } from "./core";
import { isNotebookLMAutomationEnabled } from "./automation-gate";
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

export async function verifyControlledManifest(plan: NotebookLMAutomationPlan, workspaceRoot: string = process.cwd()) {
  const workspace = path.resolve(/*turbopackIgnore: true*/ workspaceRoot);
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

type SpawnPiped = (command: string, args: readonly string[], options: SpawnOptionsWithStdioTuple<StdioPipe, StdioPipe, StdioPipe>) => ChildProcessByStdio<Writable, Readable, Readable>;

export type ControlledRunnerDeps = {
  spawn: SpawnPiped;
  access: typeof access;
  verifyManifest: typeof verifyControlledManifest;
  env: NodeJS.ProcessEnv;
  cwd: string;
};

/**
 * Runs one allowlisted operation through the local automation script.
 *
 * The executable and the script are fixed paths under the workspace; the only caller-supplied value
 * that reaches `spawn` is an operation name from a closed allowlist, passed as an argument (no shell).
 * Dependencies are injectable so the guarantees can be tested without starting a process.
 */
export async function runControlledLegacyProvider(plan: NotebookLMAutomationPlan, operation: LegacyNotebookLMOperation, overrides: Partial<ControlledRunnerDeps> = {}) {
  const deps: ControlledRunnerDeps = { spawn, access, verifyManifest: verifyControlledManifest, env: process.env, cwd: process.cwd(), ...overrides };
  // Defence in depth: the route already refuses when disabled, but the runner must never spawn on its own.
  if (!isNotebookLMAutomationEnabled(deps.env)) throw new Error("AUTOMATION_DISABLED");
  if (!allowedOperations.has(operation)) return { status: "AUTOMATION_FAILED", detailCode: "OPERATION_BLOCKED" } satisfies NotebookLMProviderResult;
  await deps.verifyManifest(plan, deps.cwd);
  const workspace = path.resolve(/*turbopackIgnore: true*/ deps.cwd);
  const python = path.join(workspace, "skill notebooklm", ".venv", "Scripts", "python.exe");
  const script = path.join(workspace, "skill notebooklm", "scripts", "elos_automation.py");
  await Promise.all([deps.access(python), deps.access(script)]);
  const sessionRoot = path.join(workspace, ".local", "notebooklm-session");

  return await new Promise<NotebookLMProviderResult | NotebookLMProviderResult[]>((resolve) => {
    const child = deps.spawn(python, [script, "--operation", operation], {
      cwd: workspace,
      env: { ...deps.env, PYTHONUTF8: "1", NOTEBOOKLM_SESSION_ROOT: sessionRoot, ELOS_WORKSPACE_ROOT: workspace },
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
