import type { CanonicalEvent } from "../learning-history/types";
import type {
  AssistanceLevel,
  ConceptRelation,
  ConfidenceCalibration,
  LearnerConceptState,
  PedagogicalObservation,
  PedagogicalPlan,
  ReviewScheduleDecision,
  ReviewScheduleInput,
} from "./types";

export const SCIENTIFIC_POLICY_VERSION = 1 as const;
export const MINUTE_MS = 60_000;
export const DAY_MINUTES = 24 * 60;
const ASSISTANCE_LADDER: readonly AssistanceLevel[] = [
  "NONE", "PROMPT", "HINT", "SCAFFOLD", "PARTIAL_EXAMPLE", "WORKED_EXAMPLE", "FULL_SOLUTION",
];

function boundedConfidence(value: number | null): 1 | 2 | 3 | 4 | 5 | null {
  return Number.isInteger(value) && value !== null && value >= 1 && value <= 5
    ? value as 1 | 2 | 3 | 4 | 5
    : null;
}

export function classifyConfidence(input: Readonly<{
  correct: boolean;
  confidence: number | null;
  assistance: AssistanceLevel;
  hintCount: number;
  retryCount: number;
}>): ConfidenceCalibration {
  const confidence = boundedConfidence(input.confidence);
  if (!input.correct && confidence !== null && confidence >= 4) return "OVERCONFIDENT_ERROR";
  if (input.correct && (input.assistance !== "NONE" || input.hintCount > 0 || input.retryCount >= 2)) {
    return "ASSISTANCE_DEPENDENCE";
  }
  if (input.correct && confidence !== null && confidence <= 2) return "UNDERCONFIDENT_SUCCESS";
  if (input.correct && confidence !== null && confidence >= 3 && input.assistance === "NONE"
    && input.hintCount === 0 && input.retryCount === 0) return "STABLE_AUTONOMOUS_SUCCESS";
  return "NEEDS_MORE_EVIDENCE";
}

export function nextAssistanceLevel(input: Readonly<{
  current: AssistanceLevel;
  recentCorrect: readonly boolean[];
  recentAutonomous: readonly boolean[];
}>): AssistanceLevel {
  const index = ASSISTANCE_LADDER.indexOf(input.current);
  if (index < 0) return "PROMPT";
  const lastTwoCorrect = input.recentCorrect.slice(-2).every(Boolean) && input.recentCorrect.length >= 2;
  const lastTwoAutonomous = input.recentAutonomous.slice(-2).every(Boolean) && input.recentAutonomous.length >= 2;
  if (lastTwoCorrect && lastTwoAutonomous) return ASSISTANCE_LADDER[Math.max(0, index - 1)];
  const recent = input.recentCorrect.slice(-2);
  if (recent.length === 2 && recent.every((value) => !value)) {
    return ASSISTANCE_LADDER[Math.min(ASSISTANCE_LADDER.length - 2, index + 1)];
  }
  return input.current;
}

export function scheduleReview(input: ReviewScheduleInput): ReviewScheduleDecision {
  if (!input.correct) {
    return Object.freeze({
      intervalMinutes: input.recurringErrorCount >= 2 ? 5 : 10,
      reasonCodes: Object.freeze([input.recurringErrorCount >= 2 ? "RECURRING_ERROR" : "RETRIEVAL_ERROR"]),
    });
  }
  const baseDays = [3, 7, 14][Math.min(2, Math.max(0, input.successfulReviewCount - 1))];
  const assisted = input.hintCount > 0 || input.retryCount >= 2;
  const intervalDays = assisted ? Math.min(baseDays, 1) : baseDays;
  const reasonCodes = ["SPACED_SUCCESS"];
  if (assisted) reasonCodes.push("ASSISTANCE_DEPENDENCE");
  if (input.confidence !== null && input.confidence <= 2) reasonCodes.push("UNDERCONFIDENT_SUCCESS");
  return Object.freeze({ intervalMinutes: intervalDays * DAY_MINUTES, reasonCodes: Object.freeze(reasonCodes) });
}

export function validateConceptRelations(relations: readonly ConceptRelation[]): readonly ConceptRelation[] {
  const seen = new Set<string>();
  for (const relation of relations) {
    if (!relation.from.trim() || !relation.to.trim() || !relation.provenance.trim()) throw new Error("INVALID_CONCEPT_RELATION");
    if (relation.from === relation.to) throw new Error("SELF_CONCEPT_RELATION");
    const key = `${relation.type}:${relation.from}:${relation.to}`;
    if (seen.has(key)) throw new Error("DUPLICATE_CONCEPT_RELATION");
    seen.add(key);
  }
  return Object.freeze([...relations]);
}

export function relatedConcepts(
  conceptId: string,
  type: ConceptRelation["type"],
  relations: readonly ConceptRelation[],
): readonly string[] {
  const validated = validateConceptRelations(relations);
  const values = validated.flatMap((relation) => {
    if (relation.type !== type) return [];
    if (relation.from === conceptId) return [relation.to];
    if (type === "CONFUSED_WITH" && relation.to === conceptId) return [relation.from];
    return [];
  });
  return Object.freeze([...new Set(values)].sort());
}

export function prerequisitePath(conceptId: string, relations: readonly ConceptRelation[]): readonly string[] {
  const validated = validateConceptRelations(relations);
  const reverse = new Map<string, string[]>();
  for (const relation of validated) {
    if (relation.type !== "PREREQUISITE_OF") continue;
    reverse.set(relation.to, [...(reverse.get(relation.to) ?? []), relation.from]);
  }
  const result: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (current: string) => {
    if (visiting.has(current)) throw new Error("CYCLIC_PREREQUISITE_RELATION");
    if (visited.has(current)) return;
    visiting.add(current);
    for (const prerequisite of [...(reverse.get(current) ?? [])].sort()) {
      visit(prerequisite);
      if (!result.includes(prerequisite)) result.push(prerequisite);
    }
    visiting.delete(current);
    visited.add(current);
  };
  visit(conceptId);
  return Object.freeze(result);
}

export function evaluateInvariantExplanation(
  response: string,
  expectedConceptGroups: readonly (readonly string[])[],
  minimumLength = 1,
): Readonly<{ valid: boolean; coveredGroups: number; requiredGroups: number }> {
  const normalized = response.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR");
  const coveredGroups = expectedConceptGroups.filter((group) => group.some((term) => normalized.includes(
    term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr-FR"),
  ))).length;
  return Object.freeze({
    valid: response.trim().length >= minimumLength && coveredGroups === expectedConceptGroups.length,
    coveredGroups,
    requiredGroups: expectedConceptGroups.length,
  });
}

function assistanceFromEvent(event: CanonicalEvent): AssistanceLevel {
  if (event.eventType !== "EVIDENCE_CREATED" && event.eventType !== "REVIEW_COMPLETED") return "NONE";
  const modes = event.payload.assistance.modes;
  if (modes.includes("FULL_SOLUTION")) return "FULL_SOLUTION";
  if (modes.includes("PARTIAL_SOLUTION")) return "PARTIAL_EXAMPLE";
  if (modes.includes("GUIDED")) return "SCAFFOLD";
  if (modes.includes("HINT")) return "HINT";
  return "NONE";
}

export function observationsFromCanonicalHistory(events: readonly CanonicalEvent[]): readonly PedagogicalObservation[] {
  const confidenceByAttempt = new Map<string, 1 | 2 | 3 | 4 | 5>();
  for (const event of events) if (event.eventType === "CONFIDENCE_RECORDED") {
    confidenceByAttempt.set(event.attemptId, event.payload.value);
  }
  const observations: PedagogicalObservation[] = [];
  for (const event of events) {
    if (event.eventType === "ERROR_OBSERVED") for (const conceptId of event.payload.conceptIds) {
      observations.push({ observationId: event.id, conceptId, occurredAt: event.occurredAt, correct: false,
        confidence: confidenceByAttempt.get(event.attemptId) ?? null, assistance: "NONE", hintCount: 0,
        retryCount: 0, delayedRetrieval: false, transfer: false, classification: event.classification });
    }
    if (event.eventType === "EVIDENCE_CREATED") for (const conceptId of event.payload.conceptIds) {
      const assistance = assistanceFromEvent(event);
      observations.push({ observationId: event.id, conceptId, occurredAt: event.occurredAt,
        correct: event.payload.result.status === "VALID", confidence: confidenceByAttempt.get(event.attemptId) ?? null,
        assistance, hintCount: event.payload.assistance.hintCount, retryCount: event.payload.assistance.retryCount,
        delayedRetrieval: false, transfer: event.payload.result.outcomeCode === "SUCCESSFUL_TRANSFER",
        classification: event.classification });
    }
    if (event.eventType === "REVIEW_COMPLETED") for (const conceptId of event.payload.conceptIds) {
      const assistance = assistanceFromEvent(event);
      observations.push({ observationId: event.id, conceptId, occurredAt: event.occurredAt,
        correct: event.payload.outcome === "CORRECT", confidence: event.payload.confidence === null
          ? null : boundedConfidence(event.payload.confidence), assistance, hintCount: event.payload.assistance.hintCount,
        retryCount: event.payload.assistance.retryCount, delayedRetrieval: true, transfer: false,
        classification: event.classification });
    }
  }
  return Object.freeze(observations.sort((left, right) => left.occurredAt - right.occurredAt
    || left.observationId.localeCompare(right.observationId)));
}

export function buildLearnerConceptStates(observations: readonly PedagogicalObservation[]): readonly LearnerConceptState[] {
  const grouped = new Map<string, PedagogicalObservation[]>();
  for (const observation of observations) grouped.set(observation.conceptId, [...(grouped.get(observation.conceptId) ?? []), observation]);
  return Object.freeze([...grouped].sort(([left], [right]) => left.localeCompare(right)).map(([conceptId, values]) => {
    const sorted = [...values].sort((left, right) => left.occurredAt - right.occurredAt || left.observationId.localeCompare(right.observationId));
    const latest = sorted.at(-1)!;
    return Object.freeze({
      conceptId,
      observations: Object.freeze(sorted),
      correctCount: sorted.filter((value) => value.correct).length,
      errorCount: sorted.filter((value) => !value.correct).length,
      autonomousSuccessCount: sorted.filter((value) => value.correct && value.assistance === "NONE"
        && value.hintCount === 0 && value.retryCount === 0).length,
      transferSuccessCount: sorted.filter((value) => value.correct && value.transfer).length,
      delayedRetrievalSuccessCount: sorted.filter((value) => value.correct && value.delayedRetrieval).length,
      latestCalibration: classifyConfidence(latest),
    });
  }));
}

export function selectPedagogicalPlan(
  state: LearnerConceptState,
  relations: readonly ConceptRelation[],
): PedagogicalPlan {
  const latest = state.observations.at(-1);
  const prerequisites = prerequisitePath(state.conceptId, relations);
  const confusions = relatedConcepts(state.conceptId, "CONFUSED_WITH", relations);
  let action: PedagogicalPlan["action"] = "SPACE";
  let relatedConceptId: string | null = null;
  const reasons: string[] = [];
  if (state.errorCount > state.correctCount && prerequisites.length) {
    action = "REMEDIATE_PREREQUISITE"; relatedConceptId = prerequisites.at(-1) ?? null; reasons.push("UNRESOLVED_PREREQUISITE");
  } else if (latest && !latest.correct && confusions.length) {
    action = "INTERLEAVE"; relatedConceptId = confusions[0]; reasons.push("TARGETED_CONFUSION");
  } else if (state.latestCalibration === "ASSISTANCE_DEPENDENCE") {
    action = "FADE_SUPPORT"; reasons.push("ASSISTANCE_DEPENDENCE");
  } else if (state.delayedRetrievalSuccessCount === 0) {
    action = "RETRIEVE"; reasons.push("NO_DELAYED_RETRIEVAL");
  } else if (state.transferSuccessCount === 0) {
    action = "TRANSFER"; reasons.push("NO_TRANSFER_EVIDENCE");
  } else {
    reasons.push("EVIDENCE_STABLE");
  }
  const recent = state.observations.slice(-2);
  return Object.freeze({ policyVersion: SCIENTIFIC_POLICY_VERSION, action, conceptId: state.conceptId,
    relatedConceptId, assistance: nextAssistanceLevel({ current: latest?.assistance ?? "PROMPT",
      recentCorrect: recent.map((value) => value.correct), recentAutonomous: recent.map((value) => value.assistance === "NONE") }),
    reasonCodes: Object.freeze(reasons) });
}
