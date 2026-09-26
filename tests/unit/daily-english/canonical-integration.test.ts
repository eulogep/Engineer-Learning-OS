import assert from "node:assert/strict";
import test from "node:test";
import type { DailyMission } from "../../../src/types/index.ts";
import { dailyEnglishEvidenceFromMission } from "../../../src/modules/daily-english/integration.ts";
import { deriveCompetencyRecord } from "../../../src/modules/learning-records/core.ts";
import { InMemoryCanonicalLearningRepository } from "../../../src/modules/learning-history/adapters/in-memory.ts";
import { reconcileLegacyLearningHistory } from "../../../src/modules/learning-history/integration/legacy-shadow.ts";
import type { CanonicalEvent, DeviceId, LearnerRef } from "../../../src/modules/learning-history/types.ts";
import { uuid } from "../learning-history/sprint-fixtures.ts";

const completedMission: DailyMission = {
  id: "private-daily-mission-id",
  date: "2026-09-13T08:00:00.000Z",
  wordIdsJson: JSON.stringify(["private-word-id"]),
  personalSentencesJson: JSON.stringify({ "private-word-id": "private personal sentence" }),
  speakingSessionId: "private-speaking-session-id",
  completed: true,
  createdAt: "2026-09-13T07:30:00.000Z",
};

test("Daily English emits only a guided completion fact", () => {
  const evidence = dailyEnglishEvidenceFromMission(completedMission);
  assert.ok(evidence);
  assert.deepEqual(evidence.learnerResponses, {});
  assert.equal(evidence.artifactReference, null);
  assert.deepEqual(evidence.competencyIds, ["DAILY_ENGLISH_GUIDED_PRACTICE"]);
  assert.equal(evidence.evaluationResult.outcome, "SUCCESSFUL_GUIDED");
  assert.equal(evidence.evaluationResult.independence, "GUIDED");
  assert.equal(deriveCompetencyRecord("DAILY_ENGLISH_GUIDED_PRACTICE", [evidence]).status, "PRACTICED");
});

test("Daily English refuses incomplete or sessionless mission state", () => {
  assert.equal(dailyEnglishEvidenceFromMission({ ...completedMission, completed: false }), null);
  assert.equal(dailyEnglishEvidenceFromMission({ ...completedMission, speakingSessionId: null }), null);
  assert.equal(dailyEnglishEvidenceFromMission({ ...completedMission, date: "invalid" }), null);
});

test("Daily English reconciles idempotently without canonicalizing legacy content or identifiers", async () => {
  const evidence = dailyEnglishEvidenceFromMission(completedMission);
  assert.ok(evidence);
  const repository = new InMemoryCanonicalLearningRepository();
  const input = {
    repository,
    identity: { learnerRef: uuid(920) as LearnerRef, deviceRef: uuid(921) as DeviceId },
    evidence: [evidence], deletions: [], errorSignals: [], reviewItems: [], reviewResults: [],
  } as const;
  assert.deepEqual(await reconcileLegacyLearningHistory(input), { events: 3, outboxJobs: 3 });
  assert.deepEqual(await reconcileLegacyLearningHistory(input), { events: 3, outboxJobs: 3 });
  const events: CanonicalEvent[] = [];
  for await (const event of repository.iterateEventsForExport()) events.push(event);
  assert.deepEqual(events.map((event) => event.eventType).sort(), ["ATTEMPT_COMPLETED", "EVIDENCE_CREATED", "MISSION_COMPLETED"]);
  const serialized = JSON.stringify(events);
  for (const privateValue of [
    completedMission.id,
    completedMission.speakingSessionId!,
    "private-word-id",
    "private personal sentence",
  ]) assert.equal(serialized.includes(privateValue), false);
});
