import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { recommendedRemediation, remediationMethod } from "../../../src/modules/academic-workspace/remediation.ts";
import { deriveCompetencyRecord, upsertEvidence } from "../../../src/modules/learning-records/core.ts";
import { generateReviewItems, mergeErrorPatterns, selectVisibleReviewItems } from "../../../src/modules/review-engine/core.ts";
import { createVisualAttempt, evaluateVisualSubmission, submitVisualAttempt, visualEvidenceDraft } from "../../../src/modules/visual-learning/core.ts";
import { visualErrorSignals, visualEvidenceFromAttempt } from "../../../src/modules/visual-learning/integration.ts";
import { osiVisualReconstruction } from "../../../src/modules/visual-learning/osi-model-definition.ts";
import type { EvidenceRecord } from "../../../src/modules/learning-records/types.ts";
import type { VisualLearningAttempt, VisualSubmission } from "../../../src/modules/visual-learning/types.ts";

function submission(order = osiVisualReconstruction.expectedNodeOrder): VisualSubmission {
  return {
    taskId: osiVisualReconstruction.id,
    nodes: order.map((id, index) => ({
      ...osiVisualReconstruction.nodes.find((node) => node.id === id)!,
      position: { x: 0, y: index },
    })),
    edges: [],
    classifications: { ...osiVisualReconstruction.expectedClassifications },
    hintsUsed: 0,
    attempts: 1,
  };
}

function readyAttempt(id = "visual-attempt-1", at = 100): VisualLearningAttempt {
  const attempt = createVisualAttempt(osiVisualReconstruction, id, at);
  return {
    ...attempt,
    order: [...osiVisualReconstruction.expectedNodeOrder],
    classifications: { ...osiVisualReconstruction.expectedClassifications },
  };
}

test("T-0017 drag/drop evaluation behavior remains deterministic", () => {
  const result = evaluateVisualSubmission(osiVisualReconstruction, submission());
  assert.equal(result.correct, true);
  assert.deepEqual(result.incorrectOrderNodeIds, []);
  assert.deepEqual(result.incorrectClassificationNodeIds, []);
});

test("order and classification errors remain separate", () => {
  const reversed = [...osiVisualReconstruction.expectedNodeOrder].reverse();
  const orderResult = evaluateVisualSubmission(osiVisualReconstruction, submission(reversed));
  assert.equal(orderResult.orderCorrect, false);
  assert.equal(orderResult.classificationsCorrect, true);
  const mappingSubmission = submission();
  delete mappingSubmission.classifications.presentation;
  const mappingResult = evaluateVisualSubmission(osiVisualReconstruction, mappingSubmission);
  assert.equal(mappingResult.orderCorrect, true);
  assert.deepEqual(mappingResult.incorrectClassificationNodeIds, ["presentation"]);
});

test("visual evidence draft remains explicitly guided", () => {
  const learnerSubmission = { ...submission(), hintsUsed: 1, attempts: 2 };
  const evaluation = evaluateVisualSubmission(osiVisualReconstruction, learnerSubmission);
  const draft = visualEvidenceDraft(osiVisualReconstruction, learnerSubmission, evaluation, 1234);
  assert.equal(draft.evidencePolicy, "GUIDED_PRACTICE_ONLY");
  assert.deepEqual(draft.sourceIds, ["ACADEMIC-NETWORK-CH01-001"]);
});

test("A-C clean first success creates Evidence without false ErrorPattern or ReviewItem", () => {
  const completed = submitVisualAttempt(readyAttempt(), osiVisualReconstruction, 200);
  const evidence = visualEvidenceFromAttempt(completed, osiVisualReconstruction);
  const signals = visualErrorSignals(completed, osiVisualReconstruction, evidence.map((item) => item.id));
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].evidenceType, "GUIDED_VISUAL_PRACTICE");
  assert.equal(evidence[0].evaluationResult.visualFinalResult, "CORRECT");
  assert.deepEqual(signals, []);
  assert.deepEqual(generateReviewItems([], mergeErrorPatterns([], signals), 200), []);
});

test("D-F real order and mapping errors create two distinct canonical signals", () => {
  const failed = submitVisualAttempt(createVisualAttempt(osiVisualReconstruction, "both-errors", 100), osiVisualReconstruction, 200);
  const evidence = visualEvidenceFromAttempt(failed, osiVisualReconstruction);
  const signals = visualErrorSignals(failed, osiVisualReconstruction, evidence.map((item) => item.id));
  assert.deepEqual(new Set(signals.map((signal) => signal.concept)), new Set(["OSI_LAYER_ORDER_CONFUSION", "OSI_TCPIP_MAPPING_CONFUSION"]));
  assert.equal(signals.every((signal) => signal.sourceEvidenceId === evidence[0].id), true);
});

test("G-H repeated reconciliation is idempotent and schedules one review per concept", () => {
  const failed = submitVisualAttempt(createVisualAttempt(osiVisualReconstruction, "idempotent", 100), osiVisualReconstruction, 200);
  const evidence = visualEvidenceFromAttempt(failed, osiVisualReconstruction);
  const signals = visualErrorSignals(failed, osiVisualReconstruction, evidence.map((item) => item.id));
  const once = mergeErrorPatterns([], signals);
  const twice = mergeErrorPatterns(once, signals);
  assert.equal(twice.length, 2);
  assert.equal(twice.every((pattern) => pattern.occurrenceCount === 1), true);
  const reviews = generateReviewItems([], twice, 300);
  const reconciled = generateReviewItems(reviews, twice, 400);
  assert.equal(reconciled.length, 2);
  const order = reconciled.find((item) => item.concept === "OSI_LAYER_ORDER_CONFUSION")!;
  const mapping = reconciled.find((item) => item.concept === "OSI_TCPIP_MAPPING_CONFUSION")!;
  assert.equal(order.reviewType, "VISUAL_ORDER_RECONSTRUCTION");
  assert.equal(mapping.reviewType, "VISUAL_MAPPING_RECONSTRUCTION");
  assert.match(order.actionRoute ?? "", /^\/learn\/visual-lab\?task=OSI_TCPIP_RECONSTRUCTION/);
  assert.match(mapping.actionRoute ?? "", /focus=mapping/);
  assert.deepEqual(order.academicPageReferences, [{ sourceId: "ACADEMIC-NETWORK-CH01-001", pageStart: 17, pageEnd: 17 }]);
  assert.equal(selectVisibleReviewItems(reconciled, twice, evidence, 400).due.length, 2);
});

test("I-K hints, attempts, earlier errors and final success remain in one guided record", () => {
  let attempt = createVisualAttempt(osiVisualReconstruction, "guided-history", 100);
  attempt = { ...attempt, hintsUsed: 1 };
  attempt = submitVisualAttempt(attempt, osiVisualReconstruction, 200);
  attempt = { ...attempt, order: [...osiVisualReconstruction.expectedNodeOrder], classifications: { ...osiVisualReconstruction.expectedClassifications } };
  attempt = submitVisualAttempt(attempt, osiVisualReconstruction, 300);
  const evidence = visualEvidenceFromAttempt(attempt, osiVisualReconstruction)[0];
  assert.equal(evidence.assistance.hintCount, 1);
  assert.equal(evidence.evaluationResult.visualAttempts, 2);
  assert.equal(evidence.evaluationResult.visualFinalResult, "CORRECT");
  assert.ok((evidence.evaluationResult.visualOrderErrors?.length ?? 0) > 0);
});

test("L-M competency is capped at PRACTICED and stronger evidence is never downgraded", () => {
  const visual = visualEvidenceFromAttempt(submitVisualAttempt(readyAttempt(), osiVisualReconstruction, 200), osiVisualReconstruction)[0];
  assert.equal(deriveCompetencyRecord("OSI_TCP_IP_REASONING", [visual]).status, "PRACTICED");
  const demonstrated: EvidenceRecord = {
    ...visual,
    id: "held-out-independent",
    createdAt: 300,
    evaluationResult: { ...visual.evaluationResult, outcome: "SUCCESSFUL_TRANSFER", independence: "INDEPENDENT" },
  };
  assert.equal(deriveCompetencyRecord("OSI_TCP_IP_REASONING", [demonstrated, visual]).status, "DEMONSTRATED");
});

test("N exact source, section and page provenance is preserved", () => {
  const record = visualEvidenceFromAttempt(submitVisualAttempt(readyAttempt(), osiVisualReconstruction, 200), osiVisualReconstruction)[0];
  assert.deepEqual(record.evaluationResult.academicSourceIds, ["ACADEMIC-NETWORK-CH01-001"]);
  assert.deepEqual(record.evaluationResult.academicSectionIds, ["SECTION-PDF-REFERENCE-MODELS"]);
  assert.deepEqual(record.evaluationResult.academicPageReferences, [{ sourceId: "ACADEMIC-NETWORK-CH01-001", pageStart: 17, pageEnd: 17 }]);
});

test("O-Q serialized refresh preserves completion without duplicate Evidence or Review", () => {
  const completed = submitVisualAttempt(readyAttempt("refresh"), osiVisualReconstruction, 200);
  const restored = JSON.parse(JSON.stringify(completed)) as VisualLearningAttempt;
  const records = visualEvidenceFromAttempt(restored, osiVisualReconstruction);
  assert.equal(restored.status, "COMPLETED");
  assert.equal(upsertEvidence(upsertEvidence([], records), records).length, 1);
  const failed = submitVisualAttempt(createVisualAttempt(osiVisualReconstruction, "refresh-errors", 100), osiVisualReconstruction, 200);
  const failedEvidence = visualEvidenceFromAttempt(failed, osiVisualReconstruction);
  const patterns = mergeErrorPatterns([], visualErrorSignals(failed, osiVisualReconstruction, failedEvidence.map((item) => item.id)));
  const reviews = generateReviewItems([], patterns, 300);
  assert.equal(generateReviewItems(reviews, patterns, 400).length, reviews.length);
});

test("R-S visual remediation is routable and never erases the original error", () => {
  assert.equal(remediationMethod("VISUAL_RECONSTRUCTION").route, "/learn/visual-lab");
  assert.ok(recommendedRemediation("ORDER_SEQUENCE").includes("VISUAL_RECONSTRUCTION"));
  let attempt = createVisualAttempt(osiVisualReconstruction, "remediation", 100, {
    originFlow: "ACADEMIC_REMEDIATION",
    originErrorPatternId: "original-pattern",
    returnTo: "/subjects/networking",
    remediationMethod: "VISUAL_RECONSTRUCTION",
  });
  attempt = submitVisualAttempt(attempt, osiVisualReconstruction, 200);
  attempt = { ...attempt, order: [...osiVisualReconstruction.expectedNodeOrder], classifications: { ...osiVisualReconstruction.expectedClassifications } };
  attempt = submitVisualAttempt(attempt, osiVisualReconstruction, 300);
  const evidence = visualEvidenceFromAttempt(attempt, osiVisualReconstruction);
  const signals = visualErrorSignals(attempt, osiVisualReconstruction, evidence.map((item) => item.id));
  assert.ok(signals.length > 0);
  assert.equal(signals.every((signal) => signal.originErrorPatternId === "original-pattern"), true);
});

test("registry exposes the validated task and only designs encapsulation", () => {
  const registry = fs.readFileSync(path.join(process.cwd(), "src/modules/visual-learning/registry.ts"), "utf8");
  assert.match(registry, /OSI_TCPIP_RECONSTRUCTION/);
  assert.match(registry, /status: "DESIGNED"/);
  assert.match(registry, /"MESSAGE", "SEGMENT", "PACKET_OR_DATAGRAM", "FRAME", "BITS"/);
});