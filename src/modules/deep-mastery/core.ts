import type {
  DeepMasteryAttempt,
  DeepMasteryDefinition,
  DeepMasteryFeedback,
  DeepMasteryQuestion,
  DeepMasteryStep,
} from "./types";
import { evaluateInvariantExplanation } from "../scientific-pedagogy/core";

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr-FR")
  .replace(/[^a-z0-9;]+/g, " ")
  .trim();

export function deepMasterySteps(definition: DeepMasteryDefinition): DeepMasteryStep[] {
  const retrieval = definition.questions.filter((question) => question.phase === "RETRIEVAL");
  const challenge = definition.questions.filter((question) => question.phase === "CHALLENGE");
  return [
    { kind: "CONTENT", content: definition.foundation },
    { kind: "CONTENT", content: definition.mentalModel },
    ...retrieval.map((question) => ({ kind: "QUESTION" as const, question })),
    ...definition.confusions.map((question) => ({ kind: "QUESTION" as const, question })),
    ...challenge.map((question) => ({ kind: "QUESTION" as const, question })),
    { kind: "QUESTION", question: definition.feynmanPrompt },
    { kind: "QUESTION", question: definition.transferChallenge },
    { kind: "SELF_EVALUATION", id: "self-evaluation", phase: "SELF_EVALUATION", title: "Auto-évaluation", instruction: "À quel point te sens-tu capable de refaire ce diagnostic sans support ?" },
  ];
}

export function stepId(step: DeepMasteryStep) {
  if (step.kind === "CONTENT") return step.content.id;
  if (step.kind === "QUESTION") return step.question.id;
  return step.id;
}

export function stepPhase(step: DeepMasteryStep) {
  if (step.kind === "CONTENT") return step.content.phase;
  if (step.kind === "QUESTION") return step.question.phase;
  return step.phase;
}

export function createDeepMasteryAttempt(definition: DeepMasteryDefinition, at = Date.now(), id = `mastery:${definition.id}:${at}`): DeepMasteryAttempt {
  return {
    id,
    definitionId: definition.id,
    definitionVersion: definition.version,
    status: "READY",
    currentStepIndex: 0,
    completedStepIds: [],
    responses: {},
    confidence: {},
    attempts: {},
    hintsUsed: {},
    retries: {},
    feedback: {},
    startedAt: null,
    completedAt: null,
    updatedAt: at,
    events: [],
  };
}

export function evaluateDeepMasteryQuestion(question: DeepMasteryQuestion, response: string, attemptNumber: number): DeepMasteryFeedback {
  const answer = normalize(response);
  let correct = false;
  if (question.type === "MULTIPLE_CHOICE") {
    correct = answer === normalize(question.correctChoiceId ?? "");
  } else {
    correct = evaluateInvariantExplanation(
      response,
      question.expectedConceptGroups ?? [],
      question.minLength ?? 1,
    ).valid;
  }
  return { correct, message: correct ? question.successFeedback : question.retryFeedback, attemptNumber };
}

export function startDeepMasteryAttempt(attempt: DeepMasteryAttempt, at = Date.now()): DeepMasteryAttempt {
  if (attempt.status !== "READY") return attempt;
  return { ...attempt, status: "IN_PROGRESS", startedAt: at, updatedAt: at, events: [...attempt.events, { type: "SESSION_STARTED", at }] };
}

export function submitDeepMasteryStep(attempt: DeepMasteryAttempt, definition: DeepMasteryDefinition, response: string, confidence: number, at = Date.now()): DeepMasteryAttempt {
  if (attempt.status !== "IN_PROGRESS") return attempt;
  const step = deepMasterySteps(definition)[attempt.currentStepIndex];
  const id = stepId(step);
  const attemptNumber = (attempt.attempts[id] ?? 0) + 1;
  let feedback: DeepMasteryFeedback;
  let misconceptionTags: string[] | undefined;
  if (step.kind === "CONTENT") feedback = { correct: true, message: "Repère essentiel enregistré. Continue quand tu es prêt.", attemptNumber };
  else if (step.kind === "SELF_EVALUATION") feedback = { correct: confidence >= 1 && confidence <= 5, message: "Auto-évaluation enregistrée.", attemptNumber };
  else {
    feedback = evaluateDeepMasteryQuestion(step.question, response, attemptNumber);
    if (!feedback.correct) misconceptionTags = step.question.misconceptionTags;
  }
  const outcomeEvent = {
    type: feedback.correct ? "ANSWER_CORRECT" as const : "ANSWER_INCORRECT" as const,
    at,
    stepId: id,
    attemptNumber,
    ...(misconceptionTags ? { misconceptionTags } : {}),
  };
  return {
    ...attempt,
    responses: { ...attempt.responses, [id]: response },
    confidence: { ...attempt.confidence, [id]: confidence },
    attempts: { ...attempt.attempts, [id]: attemptNumber },
    feedback: { ...attempt.feedback, [id]: feedback },
    updatedAt: at,
    events: [...attempt.events, outcomeEvent],
  };
}

export function continueDeepMasteryAttempt(attempt: DeepMasteryAttempt, definition: DeepMasteryDefinition, at = Date.now()): DeepMasteryAttempt {
  const steps = deepMasterySteps(definition);
  const current = steps[attempt.currentStepIndex];
  const id = stepId(current);
  if (attempt.feedback[id]?.correct !== true) return attempt;
  const completedStepIds = [...new Set([...attempt.completedStepIds, id])];
  if (attempt.currentStepIndex === steps.length - 1) {
    return { ...attempt, status: "COMPLETED", completedStepIds, completedAt: at, updatedAt: at, events: [...attempt.events, { type: "SESSION_COMPLETED", at }] };
  }
  return { ...attempt, currentStepIndex: attempt.currentStepIndex + 1, completedStepIds, updatedAt: at, events: [...attempt.events, { type: "STEP_VIEWED", at, stepId: stepId(steps[attempt.currentStepIndex + 1]) }] };
}

export function retryDeepMasteryStep(attempt: DeepMasteryAttempt, definition: DeepMasteryDefinition, at = Date.now()): DeepMasteryAttempt {
  const id = stepId(deepMasterySteps(definition)[attempt.currentStepIndex]);
  const feedback = { ...attempt.feedback };
  delete feedback[id];
  return { ...attempt, feedback, retries: { ...attempt.retries, [id]: (attempt.retries[id] ?? 0) + 1 }, updatedAt: at, events: [...attempt.events, { type: "RETRY", at, stepId: id }] };
}

export function revealDeepMasteryHint(attempt: DeepMasteryAttempt, definition: DeepMasteryDefinition, at = Date.now()): DeepMasteryAttempt {
  const step = deepMasterySteps(definition)[attempt.currentStepIndex];
  if (step.kind !== "QUESTION") return attempt;
  const id = step.question.id;
  const next = Math.min(3, step.question.hintLevels.length, (attempt.hintsUsed[id] ?? 0) + 1);
  if (next === (attempt.hintsUsed[id] ?? 0)) return attempt;
  return { ...attempt, hintsUsed: { ...attempt.hintsUsed, [id]: next }, updatedAt: at, events: [...attempt.events, { type: "HINT_USED", at, stepId: id, attemptNumber: next }] };
}

export function pauseDeepMasteryAttempt(attempt: DeepMasteryAttempt, at = Date.now()): DeepMasteryAttempt {
  if (attempt.status !== "IN_PROGRESS") return attempt;
  return { ...attempt, status: "PAUSED", updatedAt: at, events: [...attempt.events, { type: "SESSION_PAUSED", at }] };
}

export function resumeDeepMasteryAttempt(attempt: DeepMasteryAttempt, at = Date.now()): DeepMasteryAttempt {
  if (attempt.status !== "PAUSED") return attempt;
  return { ...attempt, status: "IN_PROGRESS", updatedAt: at, events: [...attempt.events, { type: "SESSION_RESUMED", at }] };
}
