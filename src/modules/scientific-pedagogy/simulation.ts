import { scheduleReview } from "./core";

export type SchedulerCandidate = "CURRENT_V1" | "FSRS_COMPATIBLE_BASELINE" | "ELOS_CONTEXT_AWARE";
export type SyntheticLearnerCase = Readonly<{
  id: string;
  stabilityDays: number;
  difficulty: number;
  successfulReviewCount: number;
  confidence: number | null;
  hintCount: number;
  retryCount: number;
  recurringErrorCount: number;
}>;
export type SchedulerMetrics = Readonly<{
  candidate: SchedulerCandidate;
  meanPredictedRecall: number;
  unnecessaryReviews: number;
  missedReviews: number;
}>;

const EINSTEIN_SCHEDULER_CANDIDATES = ["CURRENT_V1", "FSRS_COMPATIBLE_BASELINE", "ELOS_CONTEXT_AWARE"] as const;

function intervalDays(candidate: SchedulerCandidate, value: SyntheticLearnerCase): number {
  if (candidate === "CURRENT_V1") return [3, 7, 14][Math.min(2, Math.max(0, value.successfulReviewCount - 1))];
  if (candidate === "FSRS_COMPATIBLE_BASELINE") {
    const targetRetention = 0.9;
    return Math.max(1, Math.round(-value.stabilityDays * Math.log(targetRetention) * (1 + value.difficulty / 10)));
  }
  return scheduleReview({ correct: true, successfulReviewCount: value.successfulReviewCount,
    confidence: value.confidence, hintCount: value.hintCount, retryCount: value.retryCount,
    recurringErrorCount: value.recurringErrorCount }).intervalMinutes / (24 * 60);
}

export function compareSchedulers(cases: readonly SyntheticLearnerCase[]): readonly SchedulerMetrics[] {
  if (!cases.length) throw new Error("SYNTHETIC_CASES_REQUIRED");
  return Object.freeze(EINSTEIN_SCHEDULER_CANDIDATES.map((candidate) => {
    const probabilities = cases.map((value) => Math.exp(-intervalDays(candidate, value) / value.stabilityDays));
    return Object.freeze({
      candidate,
      meanPredictedRecall: Number((probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length).toFixed(6)),
      unnecessaryReviews: probabilities.filter((value) => value > 0.97).length,
      missedReviews: probabilities.filter((value) => value < 0.75).length,
    });
  }));
}
