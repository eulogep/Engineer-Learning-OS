import type { EvidenceRecord } from "../learning-records/types";
import type { ErrorSignal } from "../review-engine/types";
import type { VisualLearningAttempt, VisualTaskDefinition } from "./types";

export function visualEvidenceId(attempt: VisualLearningAttempt) {
  return `${attempt.id}:GUIDED_VISUAL_PRACTICE`;
}

export function visualEvidenceFromAttempt(
  attempt: VisualLearningAttempt,
  definition: VisualTaskDefinition,
): EvidenceRecord[] {
  if (attempt.submissionCount === 0 || !attempt.lastEvaluation) return [];
  const orderErrors = attempt.errorObservations.filter((item) => item.kind === "ORDER").flatMap((item) => item.nodeIds);
  const classificationErrors = attempt.errorObservations.filter((item) => item.kind === "CLASSIFICATION").flatMap((item) => item.nodeIds);
  return [{
    id: visualEvidenceId(attempt),
    attemptId: attempt.id,
    missionId: definition.id,
    missionVersion: definition.version,
    competencyIds: ["OSI_TCP_IP_REASONING"],
    createdAt: attempt.completedAt ?? attempt.updatedAt,
    evidenceType: "GUIDED_VISUAL_PRACTICE",
    artifactReference: null,
    learnerResponses: {
      nodeOrder: JSON.stringify(attempt.order),
      classifications: JSON.stringify(attempt.classifications),
    },
    evaluationResult: {
      outcome: attempt.status === "COMPLETED" ? "SUCCESSFUL_GUIDED" : "INCOMPLETE",
      delimiterDiagnostic: "PENDING",
      anomalyIdentification: "PENDING",
      missionCompletion: attempt.status === "COMPLETED" ? "VALID" : "PENDING",
      independence: "GUIDED",
      academicSourceIds: [...definition.sourceIds],
      academicSectionIds: [...definition.sectionIds],
      academicConceptIds: [...definition.conceptIds],
      academicPageReferences: definition.pageReferences.map((reference) => ({ ...reference })),
      academicGroundingStatus: "VERIFIED",
      visualTaskId: definition.id,
      visualAttempts: attempt.submissionCount,
      visualOrderErrors: orderErrors,
      visualClassificationErrors: classificationErrors,
      visualFinalResult: attempt.status === "COMPLETED" ? "CORRECT" : "NOT_YET_CORRECT",
      visualAssistanceLevel: "GUIDED",
      visualOriginFlow: attempt.origin?.originFlow,
      visualOriginErrorPatternId: attempt.origin?.originErrorPatternId ?? undefined,
      visualRemediationMethod: attempt.origin?.remediationMethod,
    },
    assistance: { hintCount: attempt.hintsUsed, retryCount: Math.max(0, attempt.submissionCount - 1) },
    selfEvaluation: null,
    sourceClassification: "PERSONAL",
    verificationStatus: "VALID",
  }];
}

export function visualErrorSignals(
  attempt: VisualLearningAttempt,
  definition: VisualTaskDefinition,
  availableEvidenceIds: string[],
): ErrorSignal[] {
  const sourceEvidenceId = visualEvidenceId(attempt);
  if (!availableEvidenceIds.includes(sourceEvidenceId)) return [];
  return attempt.errorObservations.map((observation) => ({
    id: observation.id,
    competencyId: "OSI_TCP_IP_REASONING",
    sourceEvidenceId,
    missionId: definition.id,
    attemptId: attempt.id,
    errorType: observation.kind === "ORDER" ? "PROCEDURAL_ERROR" : "INCOMPLETE_RESPONSE",
    concept: observation.kind === "ORDER" ? definition.reviewMappings.order : definition.reviewMappings.classification,
    description: observation.kind === "ORDER"
      ? "L?ordre des couches OSI a n?cessit? une correction dans la reconstruction visuelle."
      : "La correspondance entre couches OSI et pile TCP/IP a n?cessit? une correction.",
    observedAt: observation.observedAt,
    severity: attempt.submissionCount >= 3 ? "HIGH" : "MEDIUM",
    academicSourceId: definition.sourceIds[0],
    academicSectionId: definition.sectionIds[0],
    remediationUsed: Boolean(attempt.origin),
    remediationMethod: attempt.origin?.remediationMethod ?? null,
    originErrorPatternId: attempt.origin?.originErrorPatternId ?? undefined,
    visualAttemptCount: attempt.submissionCount,
    visualHintUsage: attempt.hintsUsed,
    academicPageReferences: definition.pageReferences.map((reference) => ({ ...reference })),
  }));
}
