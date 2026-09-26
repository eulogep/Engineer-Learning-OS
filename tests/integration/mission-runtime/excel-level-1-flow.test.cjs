/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS TypeScript harness */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const memory = new Map();
const localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};
globalThis.localStorage = localStorage;
globalThis.window = { localStorage };

const { excelLevel1Mission } = require("../../../src/modules/mission-runtime/excel-level-1-mission.ts");
const { useMissionRuntimeStore } = require("../../../src/modules/mission-runtime/store.ts");

const getAttempt = () => useMissionRuntimeStore.getState().attempts[excelLevel1Mission.id];
const acknowledgeAndContinue = () => {
  useMissionRuntimeStore.getState().submit(excelLevel1Mission, "acknowledged");
  useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
};

test("fresh Excel mission supports retry, evidence, pause/resume, refresh and completion", async () => {
  useMissionRuntimeStore.getState().reset(excelLevel1Mission);
  useMissionRuntimeStore.getState().start(excelLevel1Mission);
  assert.equal(getAttempt().status, "IN_PROGRESS");

  acknowledgeAndContinue();
  acknowledgeAndContinue();
  acknowledgeAndContinue();
  assert.equal(getAttempt().currentStepIndex, 3);

  useMissionRuntimeStore.getState().setDraft(excelLevel1Mission.id, "single-column");
  useMissionRuntimeStore.getState().submit(excelLevel1Mission);
  assert.equal(getAttempt().feedback["check-columns"].correct, false);
  useMissionRuntimeStore.getState().showHint(excelLevel1Mission);
  useMissionRuntimeStore.getState().retry(excelLevel1Mission);
  useMissionRuntimeStore.getState().setDraft(excelLevel1Mission.id, "separate-columns");
  useMissionRuntimeStore.getState().submit(excelLevel1Mission);
  assert.equal(getAttempt().feedback["check-columns"].correct, true);
  useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);

  useMissionRuntimeStore.getState().setDraft(excelLevel1Mission.id, "Energy_kWh est manquante pour L1-005");
  useMissionRuntimeStore.getState().submit(excelLevel1Mission);
  useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
  useMissionRuntimeStore.getState().submitEvidence(excelLevel1Mission, { id: "local-proof-1", displayName: "preuve-excel-test.png", mimeType: "image/png", size: 1024, storedAt: 10 });
  useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);

  useMissionRuntimeStore.getState().pause(excelLevel1Mission);
  const paused = getAttempt();
  assert.equal(paused.status, "PAUSED");
  assert.equal(paused.currentStepIndex, 6);
  assert.equal(paused.responses["find-anomaly"], "Energy_kWh est manquante pour L1-005");
  assert.equal(paused.evidence["submit-evidence"].id, "local-proof-1");
  useMissionRuntimeStore.getState().resume(excelLevel1Mission);
  assert.equal(getAttempt().currentStepIndex, 6);

  const persisted = memory.get("engineer-learning-os:mission-runtime:v2");
  assert.ok(persisted);
  useMissionRuntimeStore.setState({ attempts: {}, drafts: {}, hydrated: false });
  memory.set("engineer-learning-os:mission-runtime:v2", persisted);
  await useMissionRuntimeStore.persist.rehydrate();
  useMissionRuntimeStore.getState().markHydrated();
  assert.equal(getAttempt().currentStepIndex, 6);
  assert.equal(getAttempt().status, "IN_PROGRESS");
  assert.equal(getAttempt().activeSince, null);
  useMissionRuntimeStore.getState().activateActivity(excelLevel1Mission);
  assert.ok(getAttempt().activeSince);

  useMissionRuntimeStore.getState().setDraft(excelLevel1Mission.id, "4");
  useMissionRuntimeStore.getState().submit(excelLevel1Mission);
  useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
  acknowledgeAndContinue();
  assert.equal(getAttempt().status, "COMPLETED");
  assert.equal(getAttempt().completedStepIds.length, 8);
  assert.ok(getAttempt().events.some((event) => event.type === "ANSWER_INCORRECT"));
  assert.ok(getAttempt().events.some((event) => event.type === "HINT_USED"));
  assert.ok(getAttempt().events.some((event) => event.type === "RETRY"));
  assert.ok(getAttempt().events.some((event) => event.type === "EVIDENCE_SUBMITTED"));
  assert.ok(getAttempt().events.some((event) => event.type === "SELF_EVALUATION_SUBMITTED"));
  assert.equal(getAttempt().events.at(-1).type, "MISSION_COMPLETED");

  await useMissionRuntimeStore.persist.rehydrate();
  useMissionRuntimeStore.getState().markHydrated();
  assert.equal(getAttempt().status, "COMPLETED");
  assert.equal(getAttempt().timingReliable, true);
});
