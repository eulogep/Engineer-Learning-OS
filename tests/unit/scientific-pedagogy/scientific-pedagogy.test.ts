import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { CanonicalEvent } from "../../../src/modules/learning-history/types.ts";
import {
  ELOS_CONCEPT_RELATIONS,
  buildPedagogicalPolicySnapshot,
  SCIENTIFIC_DECISIONS,
  type ScientificSourceRecord,
  buildLearnerConceptStates,
  classifyConfidence,
  compareSchedulers,
  evaluateInvariantExplanation,
  nextAssistanceLevel,
  observationsFromCanonicalHistory,
  prerequisitePath,
  relatedConcepts,
  scheduleReview,
  selectPedagogicalPlan,
  validateConceptRelations,
} from "../../../src/modules/scientific-pedagogy/index.ts";

test("SCI-001 through SCI-006 have explicit decisions, sources, limits and metrics", () => {
  assert.deepEqual(SCIENTIFIC_DECISIONS.map((record) => record.id), [
    "SCI-001", "SCI-002", "SCI-003", "SCI-004", "SCI-005", "SCI-006",
  ]);
  const evidence = JSON.parse(readFileSync(new URL("../../../docs/research/evidence-index.json", import.meta.url), "utf8")) as ScientificSourceRecord[];
  const sourceIds = new Set(evidence.map((source) => source.id));
  assert.equal(sourceIds.size, evidence.length);
  for (const source of evidence) {
    assert.match(source.title, /\S/);
    assert.ok(source.authors.length > 0);
    assert.ok(source.year >= 1900 && source.year <= 2026);
    assert.match(source.publicationVenue, /\S/);
    assert.match(source.url, /^https:\/\//);
    assert.match(source.mainFinding, /\S/);
    assert.match(source.limitations, /\S/);
    assert.match(source.elosRelevance, /\S/);
  }
  for (const record of SCIENTIFIC_DECISIONS) {
    assert.ok(record.sources.length > 0);
    assert.ok(record.limitations.length > 0);
    assert.ok(record.measurementPlan.length > 0);
    assert.match(record.claim, /\S/);
    for (const sourceId of record.sources) assert.equal(sourceIds.has(sourceId), true, `missing evidence source ${sourceId}`);
  }
});

test("confidence is calibrated against performance and assistance instead of granting mastery", () => {
  assert.equal(classifyConfidence({ correct: false, confidence: 5, assistance: "NONE", hintCount: 0, retryCount: 0 }), "OVERCONFIDENT_ERROR");
  assert.equal(classifyConfidence({ correct: true, confidence: 1, assistance: "NONE", hintCount: 0, retryCount: 0 }), "UNDERCONFIDENT_SUCCESS");
  assert.equal(classifyConfidence({ correct: true, confidence: 5, assistance: "HINT", hintCount: 1, retryCount: 0 }), "ASSISTANCE_DEPENDENCE");
  assert.equal(classifyConfidence({ correct: true, confidence: 4, assistance: "NONE", hintCount: 0, retryCount: 0 }), "STABLE_AUTONOMOUS_SUCCESS");
});

test("assistance rises gradually, never jumps to a full solution, and fades after autonomous success", () => {
  assert.equal(nextAssistanceLevel({ current: "PROMPT", recentCorrect: [false, false], recentAutonomous: [false, false] }), "HINT");
  assert.equal(nextAssistanceLevel({ current: "WORKED_EXAMPLE", recentCorrect: [false, false], recentAutonomous: [false, false] }), "WORKED_EXAMPLE");
  assert.equal(nextAssistanceLevel({ current: "SCAFFOLD", recentCorrect: [true, true], recentAutonomous: [true, true] }), "HINT");
});

test("context-aware scheduling preserves the established ladder and shortens assisted or recurring-error review", () => {
  assert.equal(scheduleReview({ correct: true, successfulReviewCount: 1, confidence: 3, hintCount: 0, retryCount: 1, recurringErrorCount: 1 }).intervalMinutes, 3 * 24 * 60);
  assert.equal(scheduleReview({ correct: true, successfulReviewCount: 3, confidence: 5, hintCount: 1, retryCount: 0, recurringErrorCount: 1 }).intervalMinutes, 24 * 60);
  assert.equal(scheduleReview({ correct: false, successfulReviewCount: 0, confidence: 5, hintCount: 0, retryCount: 0, recurringErrorCount: 2 }).intervalMinutes, 5);
});

test("the concept graph is deterministic, provenance-bound and cycle-safe", () => {
  assert.deepEqual(prerequisitePath("CSV_DELIMITER_DIAGNOSIS", ELOS_CONCEPT_RELATIONS), ["CSV_FIELD_SEPARATOR"]);
  assert.deepEqual(relatedConcepts("CSV_DELIMITER_DIAGNOSIS", "CONFUSED_WITH", ELOS_CONCEPT_RELATIONS), ["CSV_ENCODING_DIAGNOSIS"]);
  assert.throws(() => prerequisitePath("A", [
    { from: "A", to: "B", type: "PREREQUISITE_OF", provenance: "synthetic" },
    { from: "B", to: "A", type: "PREREQUISITE_OF", provenance: "synthetic" },
  ]), /CYCLIC_PREREQUISITE_RELATION/);
  assert.throws(() => validateConceptRelations([
    { from: "A", to: "A", type: "RELATED_TO", provenance: "synthetic" },
  ]), /SELF_CONCEPT_RELATION/);
});

test("self-explanation is scored by semantic invariants rather than verbosity", () => {
  const groups = [["delimiter", "séparateur"], ["colonnes"], ["aperçu", "preview"]];
  assert.equal(evaluateInvariantExplanation("Le séparateur répartit les colonnes dans l’aperçu.", groups, 10).valid, true);
  assert.equal(evaluateInvariantExplanation("Cette réponse est très longue mais ne décrit aucun mécanisme utile pour le cas demandé.", groups, 10).valid, false);
});

test("canonical history produces a deterministic privacy-safe snapshot and an inspectable next action", async () => {
  const base = { schemaVersion: 1, learnerRef: "01990000-0000-7000-8000-000000000001", deviceRef: "01990000-0000-7000-8000-000000000002",
    recordedAt: 1_000, deviceLocalOrder: 1, classification: "LOCAL_ONLY",
    definitionIdentity: { definitionId: "01990000-0000-7000-8000-000000000003", definitionVersion: 1, definitionHash: "a".repeat(64) },
    attemptId: "01990000-0000-7000-8000-000000000004" };
  const events = [
    { ...base, id: "01990000-0000-7000-8000-000000000005", occurredAt: 900, eventType: "CONFIDENCE_RECORDED",
      payload: { subjectRef: "attempt", subjectType: "ATTEMPT", value: 5 } },
    { ...base, id: "01990000-0000-7000-8000-000000000006", occurredAt: 1_000, deviceLocalOrder: 2, eventType: "ERROR_OBSERVED",
      payload: { errorOccurrenceId: "01990000-0000-7000-8000-000000000007", conceptIds: ["CSV_DELIMITER_DIAGNOSIS"],
        competencyIds: ["EXCEL_CSV_IMPORT"], errorType: "PROCEDURAL_ERROR", errorCode: "DELIMITER",
        severity: "MEDIUM", context: { sourceRefs: [] } } },
  ] as unknown as CanonicalEvent[];
  const observations = observationsFromCanonicalHistory(events);
  assert.equal(observations[0].classification, "LOCAL_ONLY");
  assert.equal("latestResponse" in observations[0], false);
  const state = buildLearnerConceptStates(observations)[0];
  assert.equal(state.latestCalibration, "OVERCONFIDENT_ERROR");
  const plan = selectPedagogicalPlan(state, ELOS_CONCEPT_RELATIONS);
  assert.equal(plan.action, "REMEDIATE_PREREQUISITE");
  assert.equal(plan.relatedConceptId, "CSV_FIELD_SEPARATOR");
  const firstSnapshot = await buildPedagogicalPolicySnapshot(events);
  assert.deepEqual(await buildPedagogicalPolicySnapshot(events), firstSnapshot);
  assert.equal(firstSnapshot.metrics.calibration.OVERCONFIDENT_ERROR, 1);
  assert.doesNotMatch(JSON.stringify(firstSnapshot), /latestResponse|rawContent|answerText/);
});

test("scheduler comparison is deterministic and labels the FSRS-like model as a baseline", () => {
  const cases = [
    { id: "novice", stabilityDays: 2, difficulty: 8, successfulReviewCount: 1, confidence: 2, hintCount: 2, retryCount: 2, recurringErrorCount: 2 },
    { id: "stable", stabilityDays: 30, difficulty: 3, successfulReviewCount: 3, confidence: 4, hintCount: 0, retryCount: 0, recurringErrorCount: 0 },
  ];
  const first = compareSchedulers(cases);
  assert.deepEqual(compareSchedulers(cases), first);
  assert.deepEqual(first.map((value) => value.candidate), ["CURRENT_V1", "FSRS_COMPATIBLE_BASELINE", "ELOS_CONTEXT_AWARE"]);
});
