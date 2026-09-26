import type { EvidenceRecord } from "../learning-records/types";
import type { HeldOutExcelAnswers, HeldOutExcelAttempt, HeldOutExcelResult } from "./types";

export function createHeldOutExcelAttempt(at = Date.now(), id = globalThis.crypto.randomUUID()): HeldOutExcelAttempt {
  return { id, status: "READY", delimiter: "", anomalyId: "", explanation: "", createdAt: at, startedAt: null, updatedAt: at, submittedAt: null, result: null };
}

export function startHeldOutExcelAttempt(attempt: HeldOutExcelAttempt, at = Date.now()): HeldOutExcelAttempt {
  return attempt.status === "READY" ? { ...attempt, status: "IN_PROGRESS", startedAt: at, updatedAt: at } : attempt;
}

export function pauseHeldOutExcelAttempt(attempt: HeldOutExcelAttempt, at = Date.now()): HeldOutExcelAttempt {
  return attempt.status === "IN_PROGRESS" ? { ...attempt, status: "PAUSED", updatedAt: at } : attempt;
}

export function resumeHeldOutExcelAttempt(attempt: HeldOutExcelAttempt, at = Date.now()): HeldOutExcelAttempt {
  return attempt.status === "PAUSED" ? { ...attempt, status: "IN_PROGRESS", updatedAt: at } : attempt;
}

export function updateHeldOutExcelAnswers(attempt: HeldOutExcelAttempt, answers: Partial<HeldOutExcelAnswers>, at = Date.now()): HeldOutExcelAttempt {
  return attempt.status === "IN_PROGRESS" ? { ...attempt, ...answers, updatedAt: at } : attempt;
}

export function completeHeldOutExcelAttempt(attempt: HeldOutExcelAttempt, result: HeldOutExcelResult): HeldOutExcelAttempt {
  return attempt.status === "IN_PROGRESS" ? { ...attempt, status: "SUBMITTED", result, submittedAt: result.evaluatedAt, updatedAt: result.evaluatedAt } : attempt;
}

export function heldOutExcelEvidence(attempt: HeldOutExcelAttempt): EvidenceRecord | null {
  if (attempt.status !== "SUBMITTED" || !attempt.result || attempt.startedAt === null || attempt.submittedAt === null) return null;
  const result = attempt.result;
  return {
    id: `${attempt.id}:MISSION_COMPLETION`,
    attemptId: attempt.id,
    missionId: "excel-csv-held-out-transfer-v1",
    missionVersion: 1,
    competencyIds: ["EXCEL_CSV_IMPORT", "DATA_ANOMALY_IDENTIFICATION"],
    createdAt: attempt.submittedAt,
    evidenceType: "MISSION_COMPLETION",
    artifactReference: null,
    learnerResponses: { delimiter: attempt.delimiter, anomalyId: attempt.anomalyId, explanation: attempt.explanation },
    evaluationResult: {
      outcome: result.passed ? "SUCCESSFUL_TRANSFER" : "INCOMPLETE",
      delimiterDiagnostic: result.delimiterValid ? "VALID" : "INVALID",
      anomalyIdentification: result.anomalyValid ? "VALID" : "INVALID",
      missionCompletion: "VALID",
      heldOutTransfer: result.passed ? "VALID" : "INVALID",
      independence: "INDEPENDENT",
      dataClassification: "TRAINING_SYNTHETIC",
      assistanceMode: "NONE",
    },
    assistance: { hintCount: 0, retryCount: 0 },
    selfEvaluation: null,
    sourceClassification: "PERSONAL",
    verificationStatus: "VALID",
  };
}
