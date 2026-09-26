import assert from "node:assert/strict";
import test from "node:test";
import type { ErrorSignal } from "../../../src/modules/review-engine/types.ts";

const { useReviewEngineStore } = await import("../../../src/modules/review-engine/browser-store.ts");

const signal: ErrorSignal = {
  id: "signal:journal:1",
  competencyId: "EXCEL_CSV_IMPORT",
  sourceEvidenceId: "evidence:journal:1",
  missionId: "mission:journal",
  attemptId: "attempt:journal",
  errorType: "PROCEDURAL_ERROR",
  concept: "CSV_DELIMITER_DIAGNOSIS",
  description: "Synthetic error",
  observedAt: 100,
  severity: "MEDIUM",
};

test("review store retains exact error occurrences idempotently for canonical reconciliation", () => {
  useReviewEngineStore.setState({ errorSignals: [], errorPatterns: [], reviewItems: [], events: [] });
  useReviewEngineStore.getState().addErrorSignals([signal], 100);
  useReviewEngineStore.getState().addErrorSignals([signal], 100);
  assert.deepEqual(useReviewEngineStore.getState().errorSignals, [signal]);
});

test("review store refuses conflicting content under an existing occurrence identity", () => {
  useReviewEngineStore.setState({ errorSignals: [], errorPatterns: [], reviewItems: [], events: [] });
  useReviewEngineStore.getState().addErrorSignals([signal], 100);
  assert.throws(() => useReviewEngineStore.getState().addErrorSignals([
    { ...signal, severity: "HIGH" },
  ], 101));
});
