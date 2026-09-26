import type { NotebookLMAutomationPlan, NotebookLMProvider, NotebookLMProviderResult } from "./types";

export type LegacySkillCapability = {
  capability: string;
  supported: "YES" | "PARTIAL" | "NO";
  method: string;
  risk: string;
  usedInPilot: boolean;
};

export const legacyNotebookLMSkillAudit = {
  repository: "https://github.com/PleasePrompto/notebooklm-skill",
  version: "1.3.0 (CHANGELOG); exact upstream commit unavailable in the local copy",
  license: "MIT",
  runtime: "Python + patchright 1.55.2 + dedicated persistent Chrome profile",
  sessionDirectory: ".local/notebooklm-session/",
  riskAcceptance: "EXPLICIT_HUMAN_APPROVED",
  capabilities: [
    { capability: "Persistent Google login", supported: "YES", method: "Dedicated ELOS profile and local storage_state", risk: "KNOWN_ACCEPTED_RISK", usedInPilot: true },
    { capability: "Create provider notebook", supported: "PARTIAL", method: "Semantic UI selectors with deterministic title", risk: "DOM_CHANGED", usedInPilot: true },
    { capability: "Notebook reuse", supported: "PARTIAL", method: "Local bundle-to-notebook mapping plus provider URL validation", risk: "Provider URL may become stale", usedInPilot: true },
    { capability: "Attach approved source", supported: "PARTIAL", method: "Exact manifest file passed to the provider file input", risk: "DOM_CHANGED or UPLOAD_FAILED", usedInPilot: true },
    { capability: "Submit prompt", supported: "YES", method: "Notebook query input with bounded response wait", risk: "Provider UI dependent", usedInPilot: true },
    { capability: "Generate Studio artifact", supported: "PARTIAL", method: "Study Guide/Report and Quiz semantic controls", risk: "DOM_CHANGED or GENERATION_TIMEOUT", usedInPilot: true },
    { capability: "Discover artifact", supported: "PARTIAL", method: "Before/after visible-card snapshot scoped to current notebook", risk: "ARTIFACT_NOT_FOUND", usedInPilot: true },
    { capability: "Recover artifact", supported: "PARTIAL", method: "Text extraction when available, otherwise provider reference", risk: "RECOVERY_FAILED", usedInPilot: true },
    { capability: "Anti-detection", supported: "YES", method: "Existing Patchright/stealth behavior retained", risk: "KNOWN_ACCEPTED_RISK", usedInPilot: true },
  ] satisfies LegacySkillCapability[],
} as const;

export type LegacyNotebookLMOperation = "EXECUTE" | "INSPECT_HOME" | "LOCATE_NOTEBOOK" | "INSPECT_STUDIO" | "INSPECT_REPORTS" | "INSPECT_STUDY_GUIDE_SELECTION" | "INSPECT_ARTIFACT_VIEW" | "INSPECT_SOURCES" | "PREPARE_STUDIO_INSPECTION" | "ENSURE_NOTEBOOK" | "ATTACH_SOURCES" | "SUBMIT_PROMPT" | "REQUEST_ARTIFACT" | "WAIT_FOR_ARTIFACT" | "LIST_ARTIFACTS" | "RECOVER_ARTIFACT" | "CANCEL" | "CLEANUP";
export type LegacyNotebookLMTransport = (plan: NotebookLMAutomationPlan, operation: LegacyNotebookLMOperation) => Promise<NotebookLMProviderResult | NotebookLMProviderResult[]>;

async function browserTransport(plan: NotebookLMAutomationPlan, operation: LegacyNotebookLMOperation) {
  try {
    const response = await fetch("/api/notebooklm/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan, operation }),
    });
    const payload = await response.json() as NotebookLMProviderResult | NotebookLMProviderResult[];
    if (!response.ok) {
      const detailCode = !Array.isArray(payload) && payload.detailCode ? payload.detailCode : `HTTP_${response.status}`;
      return { status: response.status === 401 ? "HUMAN_LOGIN_REQUIRED" : "AUTOMATION_FAILED", detailCode } satisfies NotebookLMProviderResult;
    }
    return payload;
  } catch {
    return { status: "AUTOMATION_FAILED", detailCode: "PROVIDER_BRIDGE_UNAVAILABLE" } satisfies NotebookLMProviderResult;
  }
}

export class LegacyNotebookLMSkillProvider implements NotebookLMProvider {
  readonly id = "LEGACY_NOTEBOOKLM_SKILL_1_3_0_CONTROLLED";
  readonly mode = "LEGACY_CONTROLLED" as const;
  private readonly transport: LegacyNotebookLMTransport;

  constructor(transport: LegacyNotebookLMTransport = browserTransport) {
    this.transport = transport;
  }

  private async single(plan: NotebookLMAutomationPlan, operation: LegacyNotebookLMOperation) {
    const result = await this.transport(plan, operation);
    return Array.isArray(result) ? result[0] ?? { status: "AUTOMATION_FAILED" as const, detailCode: "EMPTY_PROVIDER_RESULT" } : result;
  }

  prepareTask(plan: NotebookLMAutomationPlan) { return this.single(plan, "EXECUTE"); }
  ensureNotebook(plan: NotebookLMAutomationPlan) { return this.single(plan, "ENSURE_NOTEBOOK"); }
  attachSources(plan: NotebookLMAutomationPlan) { return this.single(plan, "ATTACH_SOURCES"); }
  submitPrompt(plan: NotebookLMAutomationPlan) { return this.single(plan, "SUBMIT_PROMPT"); }
  requestArtifact(plan: NotebookLMAutomationPlan) { return this.single(plan, "REQUEST_ARTIFACT"); }
  waitForArtifact(plan: NotebookLMAutomationPlan) { return this.single(plan, "WAIT_FOR_ARTIFACT"); }
  async listArtifacts(plan: NotebookLMAutomationPlan) {
    const result = await this.transport(plan, "LIST_ARTIFACTS");
    return Array.isArray(result) ? result : [result];
  }
  recoverArtifact(plan: NotebookLMAutomationPlan) { return this.single(plan, "RECOVER_ARTIFACT"); }
  cancel(plan: NotebookLMAutomationPlan) { return this.single(plan, "CANCEL"); }
  async cleanup(plan: NotebookLMAutomationPlan) { await this.transport(plan, "CLEANUP"); }
}

export { LegacyNotebookLMSkillProvider as LegacyNotebookLMAutomationProvider };
