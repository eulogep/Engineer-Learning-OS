/**
 * Replay evaluation of spaced-repetition schedulers on a real review log
 * (method of the open-spaced-repetition benchmark): walk each item's history in
 * time order, ask every model for its predicted recall probability just before
 * each review, and score the predictions against what actually happened.
 *
 * Models:
 * - CURRENT_V1: the ELOS Leitner ladder (1, 3, 7, 14, 30, 60 days). It does not
 *   predict probabilities, so it is read as "the interval is set for 90 %
 *   recall": R = 0.9^(elapsed / interval).
 * - FSRS_4_5: the FSRS-4.5 memory model with its published default parameters
 *   (open-spaced-repetition, MIT). Personal parameters would require an
 *   optimiser and enough history; defaults are a fair, reproducible baseline.
 *
 * Limits: the log mixes flashcard ratings and quiz answers; first reviews give
 * no prediction; small logs give unstable scores. This compares predictions, it
 * does not prove a better learning outcome.
 */

export type ReviewEvent = Readonly<{ itemId: string; at: number; success: boolean }>;
export type SchedulerId = "CURRENT_V1" | "FSRS_4_5";
export type ReplayScore = Readonly<{ scheduler: SchedulerId; predictions: number; logLoss: number; brier: number; meanPredicted: number; observedRecall: number }>;
export type ReplayReport = Readonly<{ items: number; events: number; predictions: number; enough: boolean; scores: readonly ReplayScore[] }>;

const DAY_MS = 86_400_000;
export const MIN_PREDICTIONS = 30;

// --- CURRENT_V1 (ELOS Leitner) -------------------------------------------------

const LADDER = [1, 3, 7, 14, 30, 60] as const;

function leitnerNext(interval: number, success: boolean): number {
  if (!success) return LADDER[0];
  return LADDER.find((value) => value > interval) ?? LADDER[LADDER.length - 1];
}

// --- FSRS-4.5 ----------------------------------------------------------------

export const FSRS_4_5_DEFAULT_WEIGHTS = [
  0.4872, 1.4003, 3.7145, 13.8206, 5.1618, 1.2298, 0.8975, 0.031, 1.6474, 0.1367, 1.0461, 2.1072, 0.0793, 0.3246, 1.587, 0.2272, 2.8755,
] as const;
const DECAY = -0.5;
const FACTOR = 19 / 81;
type Grade = 1 | 3; // Again | Good: the log only knows failure / success

export function fsrsRetrievability(elapsedDays: number, stability: number): number {
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

type FsrsMemory = Readonly<{ stability: number; difficulty: number }>;
const clampDifficulty = (value: number) => Math.min(10, Math.max(1, value));

function fsrsInit(grade: Grade, w = FSRS_4_5_DEFAULT_WEIGHTS): FsrsMemory {
  return { stability: w[grade - 1], difficulty: clampDifficulty(w[4] - w[5] * (grade - 3)) };
}

export function fsrsUpdate(memory: FsrsMemory, elapsedDays: number, grade: Grade, w = FSRS_4_5_DEFAULT_WEIGHTS): FsrsMemory {
  const { stability: s, difficulty: d } = memory;
  const r = fsrsRetrievability(elapsedDays, s);
  const initialMedium = w[4];
  const difficulty = clampDifficulty(w[7] * initialMedium + (1 - w[7]) * (d - w[6] * (grade - 3)));
  const stability = grade === 1
    ? w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r))
    : s * (Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) + 1);
  return { stability: Math.max(0.01, stability), difficulty };
}

// --- Replay ------------------------------------------------------------------

function score(scheduler: SchedulerId, pairs: readonly { p: number; y: number }[]): ReplayScore {
  const n = pairs.length;
  const clamp = (p: number) => Math.min(1 - 1e-6, Math.max(1e-6, p));
  const logLoss = n ? -pairs.reduce((sum, { p, y }) => sum + (y ? Math.log(clamp(p)) : Math.log(1 - clamp(p))), 0) / n : 0;
  const brier = n ? pairs.reduce((sum, { p, y }) => sum + (p - y) ** 2, 0) / n : 0;
  const round = (value: number) => Number(value.toFixed(4));
  return {
    scheduler, predictions: n, logLoss: round(logLoss), brier: round(brier),
    meanPredicted: round(n ? pairs.reduce((sum, { p }) => sum + p, 0) / n : 0),
    observedRecall: round(n ? pairs.reduce((sum, { y }) => sum + y, 0) / n : 0),
  };
}

export function replaySchedulers(events: readonly ReviewEvent[]): ReplayReport {
  const byItem = new Map<string, ReviewEvent[]>();
  for (const event of events) if (Number.isFinite(event.at)) byItem.set(event.itemId, [...(byItem.get(event.itemId) ?? []), event]);
  const leitner: { p: number; y: number }[] = [];
  const fsrs: { p: number; y: number }[] = [];
  for (const history of byItem.values()) {
    history.sort((a, b) => a.at - b.at);
    let interval = 0;
    let memory: FsrsMemory | null = null;
    let last = 0;
    for (const event of history) {
      const grade: Grade = event.success ? 3 : 1;
      if (memory === null) {
        memory = fsrsInit(grade);
        interval = leitnerNext(0, event.success);
        last = event.at;
        continue;
      }
      const elapsed = (event.at - last) / DAY_MS;
      if (elapsed < 0.5) continue; // same-session repetitions say nothing about forgetting
      const y = event.success ? 1 : 0;
      leitner.push({ p: Math.pow(0.9, elapsed / interval), y });
      fsrs.push({ p: fsrsRetrievability(elapsed, memory.stability), y });
      memory = fsrsUpdate(memory, elapsed, grade);
      interval = leitnerNext(interval, event.success);
      last = event.at;
    }
  }
  return {
    items: byItem.size,
    events: events.length,
    predictions: fsrs.length,
    enough: fsrs.length >= MIN_PREDICTIONS,
    scores: [score("CURRENT_V1", leitner), score("FSRS_4_5", fsrs)],
  };
}
