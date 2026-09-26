import { sha256, stableJson } from "../learning-history/export/integrity";
import type { CanonicalHistoryRepository } from "../learning-history/repository";
import type { CanonicalEvent } from "../learning-history/types";
import { buildLearnerConceptStates, observationsFromCanonicalHistory, selectPedagogicalPlan } from "./core";
import { ELOS_CONCEPT_RELATIONS } from "./decisions";
import type { ConfidenceCalibration, PedagogicalPlan } from "./types";

export type PedagogicalPolicySnapshot = Readonly<{
  policyVersion: 1;
  sourceDigest: string;
  conceptCount: number;
  plans: readonly PedagogicalPlan[];
  metrics: Readonly<{
    delayedRetrievalSuccesses: number;
    transferSuccesses: number;
    recurringErrors: number;
    calibration: Readonly<Record<ConfidenceCalibration, number>>;
  }>;
}>;

export async function buildPedagogicalPolicySnapshot(
  events: readonly CanonicalEvent[],
): Promise<PedagogicalPolicySnapshot> {
  const observations = observationsFromCanonicalHistory(events);
  const states = buildLearnerConceptStates(observations);
  const calibration: Record<ConfidenceCalibration, number> = {
    OVERCONFIDENT_ERROR: 0,
    UNDERCONFIDENT_SUCCESS: 0,
    ASSISTANCE_DEPENDENCE: 0,
    STABLE_AUTONOMOUS_SUCCESS: 0,
    NEEDS_MORE_EVIDENCE: 0,
  };
  for (const state of states) calibration[state.latestCalibration] += 1;
  const plans = states.map((state) => selectPedagogicalPlan(state, ELOS_CONCEPT_RELATIONS));
  return Object.freeze({
    policyVersion: 1,
    sourceDigest: await sha256(stableJson(events)),
    conceptCount: states.length,
    plans: Object.freeze(plans),
    metrics: Object.freeze({
      delayedRetrievalSuccesses: states.reduce((sum, state) => sum + state.delayedRetrievalSuccessCount, 0),
      transferSuccesses: states.reduce((sum, state) => sum + state.transferSuccessCount, 0),
      recurringErrors: states.filter((state) => state.errorCount >= 2).length,
      calibration: Object.freeze(calibration),
    }),
  });
}

export async function rebuildPedagogicalPolicyFromRepository(
  repository: Pick<CanonicalHistoryRepository, "iterateEventsForExport">,
): Promise<PedagogicalPolicySnapshot> {
  const events: CanonicalEvent[] = [];
  for await (const event of repository.iterateEventsForExport()) events.push(event);
  return buildPedagogicalPolicySnapshot(events);
}
