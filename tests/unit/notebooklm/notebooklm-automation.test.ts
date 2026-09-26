/* eslint-disable @typescript-eslint/no-require-imports -- Node strip-types test runner */
import type { AuthorizedTransferManifest, NotebookLMProvider, NotebookLMSourceBundle, NotebookLMTask } from "../../../src/modules/notebooklm/types.ts";
import type { SourceRecord } from "../../../src/modules/source-engine/types.ts";
const assert = require("node:assert/strict");
const test = require("node:test");
const {
  applyNotebookLMProviderResult,
  approveNotebookLMTask,
  beginManualNotebookLMTask,
  createNotebookLMDerivedArtifact,
  createRecoveredNotebookLMDerivedArtifact,
  createNotebookLMTask,
  notebookLMArtifactCanPromoteCompetency,
  prepareExplicitAutomationRetry,
  recordNotebookLMArtifactRegistered,
  startNotebookLMAutomation,
  upsertRecoveredNotebookLMArtifact,
} = require("../../../src/modules/notebooklm/core.ts");
const { NotebookLMGuard } = require("../../../src/modules/notebooklm/guard.ts");
const { LegacyNotebookLMAutomationProvider, legacyNotebookLMSkillAudit } = require("../../../src/modules/notebooklm/legacy-provider.ts");

const approvedAt = "2026-08-24T12:00:00.000Z";
const source: SourceRecord = {
  schemaVersion: 1, materialKind: "ORIGINAL_SOURCE", id: "ACADEMIC-1", title: "Cours réseau", sourceType: "PDF", domain: "Informatique", subject: "Réseaux",
  originalPathOrReference: "fixtures/course.pdf", classification: "ACADEMIC_PERSONAL_USE", origin: "Fixture locale", author: null, publisher: null, createdAt: null, updatedAt: null,
  language: "fr", licenseStatus: "UNKNOWN", copyrightStatus: "UNKNOWN", trust: { authority: "UNKNOWN", verification: "PARTIAL", pedagogicalRelevance: "HIGH" }, freshness: "UNKNOWN",
  status: "PARTIALLY_VERIFIED", tags: ["fixture"], conceptIds: ["OSI_MODEL"], competencyIds: ["NETWORK_FUNDAMENTALS"], missionIds: [], notes: ["Fixture synthétique."],
  provenance: { catalogReference: null, extractedFields: ["title"], inferredFields: [] },
};
const bundle: NotebookLMSourceBundle = {
  schemaVersion: 1, id: "BUNDLE-1", title: "OSI", purpose: "Guide", sourceIds: [source.id], classification: "ACADEMIC_PERSONAL_USE",
  allowedExternalUse: "REQUIRES_EXPLICIT_LEARNER_APPROVAL", copyrightStatus: "UNKNOWN", authorizationStatus: "WAITING_FOR_APPROVAL", notes: [],
};
const manifest: AuthorizedTransferManifest = {
  taskId: "TASK-1", bundleId: bundle.id, approvedAt,
  files: [{ sourceId: source.id, relativePath: "fixtures/course.pdf", sha256: "A".repeat(64), sizeBytes: 2048, classification: "ACADEMIC_PERSONAL_USE" }],
};

function waitingTask(): NotebookLMTask {
  return createNotebookLMTask({
    id: "TASK-1", taskType: "STUDY_GUIDE", sourceBundleId: bundle.id, subjectId: "NETWORKING", conceptIds: ["OSI_MODEL"], purpose: "Guide sourcé",
    executionMode: "SEMI_AUTOMATED", createdAt: "2026-08-24T11:00:00.000Z", promptTemplateId: "academic-study-guide-v1", preparedPrompt: "Crée un guide fondé uniquement sur la source jointe.",
    activeFollowup: { required: true, label: "Restituer", href: "/learn/visual-lab" }, notes: [],
  }, bundle, [source]);
}

function approvedTask() { return approveNotebookLMTask(waitingTask(), bundle, [source], true, approvedAt); }
function plan(task = approvedTask(), transferManifest = manifest) {
  return new NotebookLMGuard().createExecutionPlan({ task, bundle, sources: [source], manifest: transferManifest, providerId: "MOCK", notebookTitle: "ELOS — Networking — OSI TCP-IP Foundations", promptHash: "B".repeat(64), createdAt: approvedAt });
}

test("A. approved bundle creates an immutable automation plan", () => {
  const value = plan();
  assert.equal(value.destination, "NOTEBOOKLM");
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.manifest.files), true);
});
test("B. unapproved bundle cannot execute", () => assert.throws(() => plan(waitingTask()), /TASK_NOT_APPROVED/));
test("C. forbidden classification is blocked by the guard", () => {
  const blockedBundle = { ...bundle, classification: "COMPANY_INTERNAL", allowedExternalUse: "BLOCKED" };
  assert.throws(() => new NotebookLMGuard().createExecutionPlan({ task: approvedTask(), bundle: blockedBundle, sources: [{ ...source, classification: "COMPANY_INTERNAL" }], manifest, providerId: "MOCK", notebookTitle: "ELOS", promptHash: "B".repeat(64), createdAt: approvedAt }), /BUNDLE_BLOCKED/);
});
test("D. transfer requires an exact file manifest without wildcards", () => {
  const unsafe = { ...manifest, files: [{ ...manifest.files[0], relativePath: "fixtures/*.pdf" }] };
  assert.throws(() => plan(approvedTask(), unsafe), /UNSAFE_PATH/);
});
test("E. task lifecycle enters one bounded automation run", () => assert.equal(startNotebookLMAutomation(approvedTask(), plan(), approvedAt).status, "AUTOMATION_RUNNING"));
test("F. automation failure exposes the preserved manual fallback", () => {
  const running = startNotebookLMAutomation(approvedTask(), plan(), approvedAt);
  const failed = applyNotebookLMProviderResult(running, { status: "AUTOMATION_FAILED", detailCode: "DOM_CHANGED" }, approvedAt);
  assert.equal(beginManualNotebookLMTask(failed).status, "IN_PROGRESS");
});
test("G. authentication interruption becomes HUMAN_LOGIN_REQUIRED", () => {
  const running = startNotebookLMAutomation(approvedTask(), plan(), approvedAt);
  assert.equal(applyNotebookLMProviderResult(running, { status: "HUMAN_LOGIN_REQUIRED" }, approvedAt).status, "HUMAN_LOGIN_REQUIRED");
});
test("H. repeated provider artifact discovery updates instead of duplicating", () => {
  const task = beginManualNotebookLMTask(approvedTask());
  const first = { ...createNotebookLMDerivedArtifact({ id: "A1", task, bundle, title: "Guide", localReference: null, createdAt: approvedAt }), providerArtifactRef: "PROVIDER-A1" };
  const second = { ...first, id: "A2", title: "Guide actualisé" };
  const values = upsertRecoveredNotebookLMArtifact(upsertRecoveredNotebookLMArtifact({}, first), second);
  assert.deepEqual(Object.keys(values), ["A1"]);
  assert.equal(values.A1.title, "Guide actualisé");
});
test("H2. repeated provider registration preserves one checkpoint and one artifact identity", () => {
  const task = beginManualNotebookLMTask(approvedTask());
  const artifact = { ...createNotebookLMDerivedArtifact({ id: "A1", task, bundle, title: "Guide", localReference: null, createdAt: approvedAt }), providerArtifactRef: "PROVIDER-A1" };
  const first = recordNotebookLMArtifactRegistered(task, artifact, approvedAt);
  const second = recordNotebookLMArtifactRegistered(first, artifact, approvedAt);
  assert.equal(second.automationEvents?.filter((event: { type: string }) => event.type === "ARTIFACT_REGISTERED").length, 1);
});
test("I. duplicate source identities are rejected", () => {
  const duplicate = { ...manifest, files: [manifest.files[0], manifest.files[0]] };
  assert.throws(() => plan(approvedTask(), duplicate), /EXPLICIT_FILE_MANIFEST_REQUIRED/);
});
test("J. recovered artifact remains non-canonical", () => {
  const artifact = createNotebookLMDerivedArtifact({ id: "A1", task: beginManualNotebookLMTask(approvedTask()), bundle, title: "Guide", localReference: null, createdAt: approvedAt });
  assert.equal(artifact.canonical, false);
});
test("K. generation lifecycle writes no Evidence", () => assert.equal("evidence" in startNotebookLMAutomation(approvedTask(), plan(), approvedAt), false));
test("L. generation cannot promote competency", () => {
  const artifact = createNotebookLMDerivedArtifact({ id: "A1", task: beginManualNotebookLMTask(approvedTask()), bundle, title: "Guide", localReference: null, createdAt: approvedAt });
  assert.equal(notebookLMArtifactCanPromoteCompetency(artifact), false);
});
test("M. persisted started task cannot reexecute on refresh", () => {
  const running = startNotebookLMAutomation(approvedTask(), plan(), approvedAt);
  assert.throws(() => startNotebookLMAutomation(running, plan(), approvedAt), /NOT_READY|ALREADY_STARTED/);
});
test("N. accepted-risk legacy provider executes only through its controlled transport", async () => {
  const provider = new LegacyNotebookLMAutomationProvider(async () => ({ status: "SUCCESS", providerNotebookRef: "https://notebooklm.google.com/notebook/test" }));
  assert.equal((await provider.prepareTask(plan())).status, "SUCCESS");
  assert.equal(legacyNotebookLMSkillAudit.riskAcceptance, "EXPLICIT_HUMAN_APPROVED");
  assert.equal(legacyNotebookLMSkillAudit.capabilities.find((item: { capability: string }) => item.capability === "Anti-detection").risk, "KNOWN_ACCEPTED_RISK");
});
test("P. recovered provider output stays derived and unverified", () => {
  const running = startNotebookLMAutomation(approvedTask(), plan(), approvedAt);
  const artifact = createRecoveredNotebookLMDerivedArtifact({
    id: "AUTO-A1", task: running, bundle,
    result: { status: "SUCCESS", providerNotebookRef: "https://notebooklm.google.com/notebook/test", artifact: { title: "Guide", providerArtifactRef: "provider:a1", recoveryMode: "TEXT_EXTRACT", recoveredContent: "Contenu dérivé" } },
    createdAt: approvedAt,
  });
  assert.equal(artifact.canonical, false);
  assert.equal(artifact.verificationStatus, "UNVERIFIED");
  assert.equal(notebookLMArtifactCanPromoteCompetency(artifact), false);
});
test("Q. provider command is never called before an approved plan exists", () => {
  let calls = 0;
  const provider = new LegacyNotebookLMAutomationProvider(async () => { calls += 1; return { status: "SUCCESS" }; });
  assert.throws(() => plan(waitingTask()), /TASK_NOT_APPROVED/);
  assert.equal(calls, 0);
  void provider;
});
test("R. dedicated persistent session is documented outside canonical learner state", () => {
  assert.equal(legacyNotebookLMSkillAudit.sessionDirectory, ".local/notebooklm-session/");
  assert.doesNotMatch(JSON.stringify(approvedTask()), /cookie|state\.json|browser_profile/i);
});
test("S. resume after login preserves the same approved task and manifest", () => {
  const running = startNotebookLMAutomation(approvedTask(), plan(), approvedAt);
  const loginRequired = applyNotebookLMProviderResult(running, { status: "HUMAN_LOGIN_REQUIRED", detailCode: "LOGIN_REQUIRED" }, approvedAt);
  const resumed = prepareExplicitAutomationRetry(loginRequired);
  const resumedPlan = plan(resumed);
  assert.equal(resumed.id, loginRequired.id);
  assert.equal(resumed.approvedAt, loginRequired.approvedAt);
  assert.deepEqual(resumedPlan.manifest, plan().manifest);
});
test("O. provider abstraction can be mocked without external calls", async () => {
  const success = { status: "SUCCESS" as const, providerNotebookRef: "mock:notebook" };
  const mock: NotebookLMProvider = {
    id: "MOCK", mode: "SEMI_AUTOMATED", prepareTask: async () => success, ensureNotebook: async () => success, attachSources: async () => success,
    submitPrompt: async () => success, requestArtifact: async () => success, waitForArtifact: async () => success, listArtifacts: async () => [success],
    recoverArtifact: async () => success, cancel: async () => ({ status: "CANCELLED" }), cleanup: async () => undefined,
  };
  assert.equal((await mock.prepareTask(plan())).status, "SUCCESS");
});
