import assert from "node:assert/strict";
import test from "node:test";
import type { DeviceId, LearnerRef } from "../../src/modules/learning-history/types.ts";

const localValues = new Map<string, string>();
const localStorageStub: Storage = {
  get length() { return localValues.size; },
  clear: () => localValues.clear(),
  getItem: (key) => localValues.get(key) ?? null,
  key: (index) => [...localValues.keys()][index] ?? null,
  removeItem: (key) => { localValues.delete(key); },
  setItem: (key, value) => { localValues.set(key, value); },
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageStub, configurable: true });
Object.defineProperty(globalThis, "window", { value: { localStorage: localStorageStub }, configurable: true });

const { InMemoryCanonicalLearningRepository } = await import(
  "../../src/modules/learning-history/adapters/in-memory.ts"
);
const { reconcileLegacyLearningHistory } = await import(
  "../../src/modules/learning-history/integration/legacy-shadow.ts"
);
const { useLearningRecordStore } = await import(
  "../../src/modules/learning-records/browser-store.ts"
);
const { excelLevel1Mission } = await import(
  "../../src/modules/mission-runtime/excel-level-1-mission.ts"
);
const { useMissionRuntimeStore } = await import(
  "../../src/modules/mission-runtime/store.ts"
);
const { useReviewEngineStore } = await import(
  "../../src/modules/review-engine/browser-store.ts"
);
const { reviewEvidenceFromResult, reviewIsTraceable } = await import(
  "../../src/modules/review-engine/core.ts"
);
const { rebuildPedagogicalPolicyFromRepository } = await import(
  "../../src/modules/scientific-pedagogy/snapshot.ts"
);
const { uuid } = await import("../unit/learning-history/sprint-fixtures.ts");

function resetStores(): void {
  useMissionRuntimeStore.setState({ hydrated: true, attempts: {}, drafts: {} });
  useLearningRecordStore.setState({
    hydrated: true, evidence: [], deletions: [], competencies: [], events: [],
  });
  useReviewEngineStore.setState({
    hydrated: true,
    errorSignals: [],
    errorPatterns: [],
    reviewItems: [],
    results: [],
    events: [],
    activeItemId: null,
    startedAt: {},
    drafts: {},
    feedback: {},
    retries: {},
    hints: {},
  });
}

function acknowledge(): void {
  useMissionRuntimeStore.getState().submit(excelLevel1Mission, "acknowledged");
  useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
}

function completeHeldOutMission(): void {
  const mission = useMissionRuntimeStore.getState();
  mission.reset(excelLevel1Mission);
  mission.start(excelLevel1Mission);
  acknowledge(); acknowledge(); acknowledge();

  useMissionRuntimeStore.getState().submit(excelLevel1Mission, "single-column");
  assert.equal(useMissionRuntimeStore.getState().attempts[excelLevel1Mission.id].feedback["check-columns"].correct, false);
  useMissionRuntimeStore.getState().retry(excelLevel1Mission);
  useMissionRuntimeStore.getState().submit(excelLevel1Mission, "separate-columns");
  useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);

  useMissionRuntimeStore.getState().submit(excelLevel1Mission, "Energy_kWh est manquante pour L1-005");
  useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
  useMissionRuntimeStore.getState().submitEvidence(excelLevel1Mission, {
    id: "held-out-local-proof",
    displayName: "held-out-private-evidence.png",
    mimeType: "image/png",
    size: 2048,
    storedAt: Date.now(),
  });
  useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
  useMissionRuntimeStore.getState().submit(excelLevel1Mission, "4");
  useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
  acknowledge();
}

test("V1 daily loop crosses actual stores and canonical shadow without raw learner content", async () => {
  resetStores();
  completeHeldOutMission();
  const attempt = useMissionRuntimeStore.getState().attempts[excelLevel1Mission.id];
  assert.equal(attempt.status, "COMPLETED");

  useLearningRecordStore.getState().syncExcelAttempt(attempt, excelLevel1Mission);
  const learningAfterMission = useLearningRecordStore.getState();
  const competencyAfterMission = learningAfterMission.competencies.find(
    (record) => record.competencyId === "EXCEL_CSV_IMPORT",
  );
  assert.equal(competencyAfterMission?.status, "PRACTICED");

  const reviewAt = (attempt.completedAt ?? Date.now()) + 1;
  useReviewEngineStore.getState().syncExcelAttempt(
    attempt,
    learningAfterMission.evidence.map((record) => record.id),
    reviewAt,
  );
  const reviewBefore = useReviewEngineStore.getState();
  assert.equal(reviewBefore.errorSignals.length, 1);
  assert.equal(reviewBefore.reviewItems.length, 1);
  const item = reviewBefore.reviewItems[0];
  assert.equal(reviewIsTraceable(item, reviewBefore.errorPatterns, learningAfterMission.evidence), true);

  useReviewEngineStore.getState().startReview(item.id, reviewAt + 1);
  useReviewEngineStore.getState().setDraft(item.id, "delimiter");
  useReviewEngineStore.getState().submitAnswer(item.id, reviewAt + 2);
  assert.equal(useReviewEngineStore.getState().feedback[item.id].correct, true);
  const result = useReviewEngineStore.getState().finishReview(item.id, true, 4, reviewAt + 1_000);
  assert.ok(result);
  useLearningRecordStore.getState().addEvidenceRecords([reviewEvidenceFromResult(item, result)]);

  const learning = useLearningRecordStore.getState();
  const review = useReviewEngineStore.getState();
  const competency = learning.competencies.find((record) => record.competencyId === "EXCEL_CSV_IMPORT");
  assert.equal(learning.evidence.length, 3);
  assert.equal(review.results.length, 1);
  assert.equal(review.errorPatterns[0].resolvedStatus, "IMPROVING");
  assert.equal(competency?.status, "PRACTICED");
  assert.ok(competency?.supportingEvidenceIds.every((id) => learning.evidence.some((record) => record.id === id)));

  const repository = new InMemoryCanonicalLearningRepository();
  const input = {
    repository,
    identity: { learnerRef: uuid(910000) as LearnerRef, deviceRef: uuid(910001) as DeviceId },
    evidence: learning.evidence,
    deletions: learning.deletions,
    errorSignals: review.errorSignals,
    reviewItems: review.reviewItems,
    reviewResults: review.results,
  } as const;
  assert.deepEqual(await reconcileLegacyLearningHistory(input), { events: 8, outboxJobs: 8 });
  assert.deepEqual(await reconcileLegacyLearningHistory(input), { events: 8, outboxJobs: 8 });
  assert.equal(await repository.countEvents(), 8);
  assert.equal(await repository.countOutboxJobs(), 8);
  assert.equal((await repository.readEventsByType("EVIDENCE_CREATED")).length, 2);
  assert.equal((await repository.readEventsByType("ERROR_OBSERVED")).length, 1);
  assert.equal((await repository.readEventsByType("REVIEW_COMPLETED")).length, 1);

  const policySnapshot = await rebuildPedagogicalPolicyFromRepository(repository);
  assert.ok(policySnapshot.conceptCount >= 1);
  assert.ok(policySnapshot.plans.length >= 1);
  assert.equal(policySnapshot.metrics.delayedRetrievalSuccesses, 1);
  assert.equal(JSON.stringify(policySnapshot).includes("held-out-private-evidence.png"), false);

  const serialized: string[] = [];
  for await (const event of repository.iterateEventsForExport()) serialized.push(JSON.stringify(event));
  const canonical = serialized.join("\n");
  assert.equal(canonical.includes("single-column"), false);
  assert.equal(canonical.includes("held-out-private-evidence.png"), false);
  assert.equal(canonical.includes("learnerResponses"), false);
  assert.equal(canonical.includes("displayName"), false);
});
