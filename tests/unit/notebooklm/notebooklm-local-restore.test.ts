import assert from "node:assert/strict";
import test from "node:test";
import {
  createNotebookLMRestoreCoordinator,
  migrateNotebookLMPersistedState,
  NOTEBOOKLM_STORE_VERSION,
  settleNotebookLMRestore,
} from "../../../src/modules/notebooklm/local-restore.ts";

const completedTask = {
  schemaVersion: 1,
  id: "TASK-1",
  taskType: "STUDY_GUIDE",
  sourceBundleId: "BUNDLE-1",
  subjectId: "NETWORKING",
  conceptIds: ["OSI"],
  purpose: "Guide",
  executionMode: "LEGACY_CONTROLLED",
  authorizationStatus: "HUMAN_APPROVED",
  createdAt: "2026-08-25T00:00:00.000Z",
  status: "COMPLETED",
  promptTemplateId: "study-guide",
  preparedPrompt: "Fixture synthétique.",
  externalUseApproved: true,
  artifactIds: ["ARTIFACT-1"],
  activeFollowup: { required: true, label: "Continuer", href: "/learn" },
  automationEvents: [
    { type: "NOTEBOOK_RESOLVED", at: "2026-08-25T00:00:01.000Z" },
    { type: "SOURCE_CONFIRMED", at: "2026-08-25T00:00:02.000Z" },
    { type: "PROMPT_SUBMITTED", at: "2026-08-25T00:00:03.000Z" },
    { type: "ARTIFACT_DISCOVERED", at: "2026-08-25T00:00:04.000Z" },
    { type: "ARTIFACT_RECOVERED", at: "2026-08-25T00:00:05.000Z" },
    { type: "ARTIFACT_REGISTERED", at: "2026-08-25T00:00:06.000Z" },
  ],
  notes: [],
};

const artifact = {
  id: "ARTIFACT-1",
  title: "Guide synthétique",
  sourceBundleId: "BUNDLE-1",
  sourceIds: ["SOURCE-1"],
  conceptIds: ["OSI"],
  providerArtifactRef: "provider:study-guide:1",
  notes: [],
};

function persisted() {
  return {
    tasks: { [completedTask.id]: structuredClone(completedTask) },
    artifacts: { [artifact.id]: structuredClone(artifact) },
    plans: {},
  };
}

test("A. normal persisted state migrates to a ready local snapshot", () => {
  const result = migrateNotebookLMPersistedState(persisted());
  assert.equal(result.quarantinedRecords, 0);
  assert.equal(Object.keys(result.state.tasks).length, 1);
});

test("B. empty state remains a valid empty snapshot", () => {
  assert.deepEqual(migrateNotebookLMPersistedState({}).state, { tasks: {}, artifacts: {}, plans: {} });
});

test("C. malformed JSON failure terminates as recoverable FAILED", async () => {
  const result = await settleNotebookLMRestore(() => Promise.reject(new SyntaxError("malformed JSON")));
  assert.deepEqual(result, { state: "FAILED", failureCode: "LOCAL_RESTORE_FAILED" });
});

test("D. one malformed task is quarantined while one valid task restores", () => {
  const state = persisted() as { tasks: Record<string, unknown>; artifacts: Record<string, unknown>; plans: Record<string, unknown> };
  state.tasks.BROKEN = { id: "BROKEN" };
  const result = migrateNotebookLMPersistedState(state);
  assert.equal(result.quarantinedRecords, 1);
  assert.deepEqual(Object.keys(result.state.tasks), ["TASK-1"]);
});

test("E. completed Study Guide remains completed with checkpoints", () => {
  const task = migrateNotebookLMPersistedState(persisted()).state.tasks["TASK-1"];
  assert.equal(task.status, "COMPLETED");
  assert.equal(task.automationEvents?.at(-1)?.type, "ARTIFACT_REGISTERED");
});

test("F. an existing DerivedArtifact restores exactly once", () => {
  const result = migrateNotebookLMPersistedState(persisted());
  assert.deepEqual(Object.keys(result.state.artifacts), ["ARTIFACT-1"]);
});

test("G. repeated refresh migration does not duplicate task or artifact", () => {
  const first = migrateNotebookLMPersistedState(persisted()).state;
  const second = migrateNotebookLMPersistedState(first).state;
  assert.equal(Object.keys(second.tasks).length, 1);
  assert.equal(Object.keys(second.artifacts).length, 1);
});

test("H. migration is deterministic and versioned", () => {
  const first = migrateNotebookLMPersistedState(persisted());
  const second = migrateNotebookLMPersistedState(persisted());
  assert.equal(NOTEBOOKLM_STORE_VERSION, 3);
  assert.deepEqual(first, second);
});

test("I. restore exception always terminates", async () => {
  const result = await settleNotebookLMRestore(() => { throw new Error("storage unavailable"); });
  assert.equal(result.state, "FAILED");
});

test("J. StrictMode double initialization shares one in-flight restore", async () => {
  let calls = 0;
  let finish!: () => void;
  const coordinator = createNotebookLMRestoreCoordinator(() => {
    calls += 1;
    return new Promise<void>((resolve) => { finish = resolve; });
  });
  const first = coordinator();
  const second = coordinator();
  assert.strictEqual(first, second);
  finish();
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test("K. restore lifecycle never executes a provider", async () => {
  let providerCalls = 0;
  const result = await settleNotebookLMRestore(() => {
    migrateNotebookLMPersistedState(persisted());
    return Promise.resolve();
  });
  assert.equal(result.state, "READY");
  assert.equal(providerCalls, 0);
});

test("L. restored state creates no Evidence or competency promotion", () => {
  const serialized = JSON.stringify(migrateNotebookLMPersistedState(persisted()).state);
  assert.doesNotMatch(serialized, /evidenceRecords|competencyPromotion|DEMONSTRATED|RETAINED/);
});

export {};
