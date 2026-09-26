import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceRecord } from "../../../src/modules/learning-records/types.ts";
import type { ErrorSignal, ReviewResultRecord } from "../../../src/modules/review-engine/types.ts";
import type { CanonicalEvent, DeviceId, EventId, LearnerRef } from "../../../src/modules/learning-history/types.ts";

const { InMemoryCanonicalLearningRepository } = await import(
  "../../../src/modules/learning-history/adapters/in-memory.ts"
);
const { reconcileLegacyLearningHistory } = await import(
  "../../../src/modules/learning-history/integration/legacy-shadow.ts"
);
const { useLearningRecordStore } = await import(
  "../../../src/modules/learning-records/browser-store.ts"
);
const { uuid } = await import("./sprint-fixtures.ts");

const evidence: EvidenceRecord = {
  id: "legacy-evidence-private",
  attemptId: "legacy-attempt-private",
  missionId: "excel-level-1",
  missionVersion: 1,
  competencyIds: ["EXCEL_CSV_IMPORT"],
  createdAt: 1_000,
  evidenceType: "MISSION_COMPLETION",
  artifactReference: {
    id: "private-artifact-id",
    displayName: "private-learner-file.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    size: 42,
    storedAt: 900,
    verificationStatus: "UNVERIFIED",
  },
  learnerResponses: { explanation: "private raw learner answer" },
  evaluationResult: {
    outcome: "SUCCESSFUL_GUIDED",
    delimiterDiagnostic: "VALID",
    anomalyIdentification: "VALID",
    missionCompletion: "VALID",
    academicSourceIds: ["private-course-source"],
    academicConceptIds: ["CSV_DELIMITER_DIAGNOSIS"],
  },
  assistance: { hintCount: 1, retryCount: 1 },
  selfEvaluation: 4,
  sourceClassification: "PERSONAL",
  verificationStatus: "VALID",
};

const signal: ErrorSignal = {
  id: "legacy-error-signal-private",
  competencyId: "EXCEL_CSV_IMPORT",
  sourceEvidenceId: evidence.id,
  missionId: evidence.missionId,
  attemptId: evidence.attemptId,
  errorType: "PROCEDURAL_ERROR",
  concept: "CSV_DELIMITER_DIAGNOSIS",
  description: "private error description",
  observedAt: 950,
  severity: "MEDIUM",
};

const reviewResult: ReviewResultRecord = {
  id: "legacy-review-result-private",
  reviewItemId: "legacy-review-item",
  competencyId: "EXCEL_CSV_IMPORT",
  sourceEvidenceIds: [evidence.id],
  correct: true,
  response: "private review response",
  hintCount: 0,
  retryCount: 0,
  confidence: 4,
  durationMs: 100,
  completedAt: 2_000,
  sourceClassification: "PERSONAL",
};

const identity = { learnerRef: uuid(900) as LearnerRef, deviceRef: uuid(901) as DeviceId };

test("legacy learner records reconcile idempotently into canonical event and outbox metadata", async () => {
  const repository = new InMemoryCanonicalLearningRepository();
  const input = {
    repository,
    identity,
    evidence: [evidence],
    deletions: [],
    errorSignals: [signal],
    reviewItems: [],
    reviewResults: [reviewResult],
  } as const;
  assert.deepEqual(await reconcileLegacyLearningHistory(input), { events: 5, outboxJobs: 5 });
  assert.deepEqual(await reconcileLegacyLearningHistory(input), { events: 5, outboxJobs: 5 });
  assert.equal(await repository.countEvents(), 5);
  assert.equal(await repository.countOutboxJobs(), 5);

  const events: CanonicalEvent[] = [];
  for await (const event of repository.iterateEventsForExport()) events.push(event);
  assert.deepEqual(events.map((event) => event.eventType).sort(), [
    "ATTEMPT_COMPLETED", "ERROR_OBSERVED", "EVIDENCE_CREATED", "MISSION_COMPLETED", "REVIEW_COMPLETED",
  ]);
  assert.ok(events.every((event) => event.classification === "SYNC_ALLOWED"));
  const serialized = JSON.stringify(events);
  for (const raw of [
    "private raw learner answer", "private-learner-file.xlsx", "private error description",
    "private review response", "private-course-source",
  ]) assert.equal(serialized.includes(raw), false);
});

test("legacy identity mapping is stable across repositories and raw content stays opaque", async () => {
  const first = new InMemoryCanonicalLearningRepository();
  const second = new InMemoryCanonicalLearningRepository();
  const shared = {
    identity,
    evidence: [evidence], deletions: [], errorSignals: [], reviewItems: [], reviewResults: [],
  } as const;
  await reconcileLegacyLearningHistory({ ...shared, repository: first });
  await reconcileLegacyLearningHistory({ ...shared, repository: second });
  const collect = async (repository: typeof first) => {
    const events: CanonicalEvent[] = [];
    for await (const event of repository.iterateEventsForExport()) events.push(event);
    return events;
  };
  assert.deepEqual(await collect(first), await collect(second));
  const canonicalEvidence = (await first.readEventsByType("EVIDENCE_CREATED"))[0];
  assert.equal(canonicalEvidence.eventType, "EVIDENCE_CREATED");
  if (canonicalEvidence.eventType !== "EVIDENCE_CREATED") assert.fail("Expected evidence event.");
  assert.deepEqual(canonicalEvidence.payload.artifactRefs.map((ref) => ({
    storagePolicy: ref.storagePolicy, contentIncluded: ref.contentIncluded,
  })), [{ storagePolicy: "LOCAL_ONLY", contentIncluded: false }]);
});

test("evolving legacy evidence is not canonicalized until its outcome is terminal", async () => {
  const repository = new InMemoryCanonicalLearningRepository();
  const evolving: EvidenceRecord = {
    ...evidence,
    evaluationResult: { ...evidence.evaluationResult, outcome: "INCOMPLETE", missionCompletion: "PENDING" },
  };
  const common = { repository, identity, deletions: [], errorSignals: [], reviewItems: [], reviewResults: [] } as const;
  assert.deepEqual(await reconcileLegacyLearningHistory({ ...common, evidence: [evolving] }), {
    events: 0, outboxJobs: 0,
  });
  assert.deepEqual(await reconcileLegacyLearningHistory({ ...common, evidence: [evidence] }), {
    events: 3, outboxJobs: 3,
  });
  assert.equal(await repository.countEvents(), 3);
});

test("legacy evidence deletion appends a tombstone and prevents stale resurrection", async () => {
  const repository = new InMemoryCanonicalLearningRepository();
  const common = { repository, identity, errorSignals: [], reviewItems: [], reviewResults: [] } as const;
  await reconcileLegacyLearningHistory({ ...common, evidence: [evidence], deletions: [] });
  const deletion = { id: "legacy-deletion-1", evidenceId: evidence.id, requestedAt: 2_000 };
  await reconcileLegacyLearningHistory({ ...common, evidence: [], deletions: [deletion] });
  const tombstones = await repository.readTombstones();
  assert.equal(tombstones.length, 1);
  assert.equal(tombstones[0].eventType, "DELETION_REQUESTED");
  if (tombstones[0].eventType !== "DELETION_REQUESTED") assert.fail("Expected deletion event.");
  assert.equal(tombstones[0].payload.targetType, "EVIDENCE");
  await reconcileLegacyLearningHistory({ ...common, evidence: [evidence], deletions: [deletion] });
  assert.equal(await repository.countEvents(), 4);
  const original = (await repository.readEventsByType("EVIDENCE_CREATED"))[0];
  await assert.rejects(repository.appendEvent({ ...original, id: uuid(777) as EventId }));
});

test("learner evidence removal records exactly one durable deletion intent", () => {
  useLearningRecordStore.setState({ evidence: [evidence], deletions: [], competencies: [], events: [] });
  useLearningRecordStore.getState().removeEvidence(evidence.id);
  assert.equal(useLearningRecordStore.getState().evidence.length, 0);
  assert.equal(useLearningRecordStore.getState().deletions.length, 1);
  assert.equal(useLearningRecordStore.getState().deletions[0].evidenceId, evidence.id);
  useLearningRecordStore.getState().removeEvidence(evidence.id);
  assert.equal(useLearningRecordStore.getState().deletions.length, 1);
});
