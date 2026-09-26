import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { completeHeldOutExcelAttempt, createHeldOutExcelAttempt, heldOutExcelEvidence, pauseHeldOutExcelAttempt, resumeHeldOutExcelAttempt, startHeldOutExcelAttempt, updateHeldOutExcelAnswers } from "../../../src/modules/held-out-excel/core.ts";
import { deriveCompetencyRecord } from "../../../src/modules/learning-records/core.ts";

const passingResult = { passed: true, delimiterValid: true, anomalyValid: true, explanationValid: true, evaluatedAt: 5_000 } as const;

test("pause and resume preserve the held-out answers exactly", () => {
  let attempt = startHeldOutExcelAttempt(createHeldOutExcelAttempt(1_000, "held-out-one"), 2_000);
  attempt = updateHeldOutExcelAnswers(attempt, { delimiter: "semicolon", anomalyId: "HX-206", explanation: "I verify the preview and confirm that each field is in a separate column." }, 3_000);
  const paused = pauseHeldOutExcelAttempt(attempt, 3_500);
  const resumed = resumeHeldOutExcelAttempt(paused, 4_000);
  assert.equal(paused.status, "PAUSED");
  assert.equal(resumed.status, "IN_PROGRESS");
  assert.deepEqual({ delimiter: resumed.delimiter, anomalyId: resumed.anomalyId, explanation: resumed.explanation }, { delimiter: attempt.delimiter, anomalyId: attempt.anomalyId, explanation: attempt.explanation });
});

test("successful held-out evidence promotes only through autonomous transfer", () => {
  let attempt = startHeldOutExcelAttempt(createHeldOutExcelAttempt(1_000, "held-out-pass"), 2_000);
  attempt = updateHeldOutExcelAnswers(attempt, { delimiter: "semicolon", anomalyId: "HX-206", explanation: "I verify the preview and confirm that each field is in a separate column." }, 3_000);
  attempt = completeHeldOutExcelAttempt(attempt, passingResult);
  const evidence = heldOutExcelEvidence(attempt);
  assert.ok(evidence);
  assert.equal(evidence.evaluationResult.outcome, "SUCCESSFUL_TRANSFER");
  assert.equal(evidence.evaluationResult.independence, "INDEPENDENT");
  assert.equal(evidence.evaluationResult.assistanceMode, "NONE");
  assert.equal(deriveCompetencyRecord("EXCEL_CSV_IMPORT", [evidence]).status, "DEMONSTRATED");
});

test("failed held-out evidence remains incomplete and cannot demonstrate competence", () => {
  let attempt = startHeldOutExcelAttempt(createHeldOutExcelAttempt(1_000, "held-out-fail"), 2_000);
  attempt = updateHeldOutExcelAnswers(attempt, { delimiter: "comma", anomalyId: "unknown", explanation: "The preview is unclear because the values are still together in one column." }, 3_000);
  attempt = completeHeldOutExcelAttempt(attempt, { ...passingResult, passed: false, delimiterValid: false, anomalyValid: false });
  const evidence = heldOutExcelEvidence(attempt);
  assert.ok(evidence);
  assert.equal(evidence.evaluationResult.outcome, "INCOMPLETE");
  assert.equal(deriveCompetencyRecord("EXCEL_CSV_IMPORT", [evidence]).status, "FRAGILE");
});

test("client held-out modules contain no answer-key import or evaluator constants", () => {
  const files = [
    "src/components/held-out-excel/HeldOutExcelWorkspace.tsx",
    "src/modules/held-out-excel/browser-store.ts",
    "src/modules/held-out-excel/core.ts",
    "src/modules/held-out-excel/definition.ts",
  ];
  const clientSource = files.map((file) => readFileSync(path.resolve(process.cwd(), file), "utf8")).join("\n");
  assert.doesNotMatch(clientSource, /server-evaluator|EXPECTED_ANOMALY|EXPECTED_DELIMITER|correctAnswer|answerKey/);
  assert.doesNotMatch(clientSource, /\bfetch\s*\(\s*["'`]https?:/);
});
