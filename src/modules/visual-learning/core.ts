import type {
  VisualAttemptOrigin,
  VisualEvidenceDraft,
  VisualEvaluation,
  VisualLearningAttempt,
  VisualSubmission,
  VisualTaskDefinition,
} from "./types";

export function evaluateVisualSubmission(
  definition: VisualTaskDefinition,
  submission: VisualSubmission,
): VisualEvaluation {
  const learnerOrder = submission.nodes.map((node) => node.id);
  const incorrectOrderNodeIds = definition.expectedNodeOrder.filter(
    (nodeId, index) => learnerOrder[index] !== nodeId,
  );
  const incorrectClassificationNodeIds = definition.expectedNodeOrder.filter(
    (nodeId) => submission.classifications[nodeId] !== definition.expectedClassifications[nodeId],
  );
  const orderCorrect = incorrectOrderNodeIds.length === 0
    && learnerOrder.length === definition.expectedNodeOrder.length;
  const classificationsCorrect = incorrectClassificationNodeIds.length === 0;

  return {
    correct: orderCorrect && classificationsCorrect,
    orderCorrect,
    classificationsCorrect,
    incorrectOrderNodeIds,
    incorrectClassificationNodeIds,
  };
}

export function createVisualAttempt(
  definition: VisualTaskDefinition,
  id: string,
  createdAt: number,
  origin: VisualAttemptOrigin = null,
): VisualLearningAttempt {
  return {
    id,
    taskId: definition.id,
    taskVersion: definition.version,
    status: "IN_PROGRESS",
    order: [...definition.initialNodeOrder],
    classifications: {},
    submissionCount: 0,
    hintsUsed: 0,
    errorObservations: [],
    lastEvaluation: null,
    origin,
    startedAt: createdAt,
    completedAt: null,
    updatedAt: createdAt,
  };
}

export function visualSubmissionFromAttempt(
  attempt: VisualLearningAttempt,
  definition: VisualTaskDefinition,
): VisualSubmission {
  const byId = new Map(definition.nodes.map((node) => [node.id, node]));
  return {
    taskId: definition.id,
    nodes: attempt.order.map((id, index) => ({ ...byId.get(id)!, position: { x: 0, y: index } })),
    edges: [],
    classifications: { ...attempt.classifications },
    hintsUsed: attempt.hintsUsed,
    attempts: attempt.submissionCount + 1,
  };
}

export function submitVisualAttempt(
  attempt: VisualLearningAttempt,
  definition: VisualTaskDefinition,
  submittedAt: number,
): VisualLearningAttempt {
  const submission = visualSubmissionFromAttempt(attempt, definition);
  const evaluation = evaluateVisualSubmission(definition, submission);
  const submissionNumber = attempt.submissionCount + 1;
  const observations = [...attempt.errorObservations];
  if (!evaluation.orderCorrect) observations.push({
    id: `${attempt.id}:submission:${submissionNumber}:ORDER`,
    kind: "ORDER",
    nodeIds: [...evaluation.incorrectOrderNodeIds],
    observedAt: submittedAt,
    submissionNumber,
  });
  if (!evaluation.classificationsCorrect) observations.push({
    id: `${attempt.id}:submission:${submissionNumber}:CLASSIFICATION`,
    kind: "CLASSIFICATION",
    nodeIds: [...evaluation.incorrectClassificationNodeIds],
    observedAt: submittedAt,
    submissionNumber,
  });
  return {
    ...attempt,
    status: evaluation.correct ? "COMPLETED" : "IN_PROGRESS",
    submissionCount: submissionNumber,
    errorObservations: observations,
    lastEvaluation: evaluation,
    completedAt: evaluation.correct ? submittedAt : null,
    updatedAt: submittedAt,
  };
}
export function visualEvidenceDraft(
  definition: VisualTaskDefinition,
  submission: VisualSubmission,
  evaluation: VisualEvaluation,
  createdAt: number,
): VisualEvidenceDraft {
  return {
    taskId: definition.id,
    conceptIds: [...definition.conceptIds],
    sourceIds: [...definition.sourceIds],
    responseFormat: "SEMANTIC_NODE_ORDER_AND_CLASSIFICATION",
    expectedStructure: {
      nodeOrder: [...definition.expectedNodeOrder],
      classifications: { ...definition.expectedClassifications },
    },
    learnerStructure: submission,
    hintsUsed: submission.hintsUsed,
    attempts: submission.attempts,
    evaluation,
    createdAt,
    evidencePolicy: "GUIDED_PRACTICE_ONLY",
  };
}
