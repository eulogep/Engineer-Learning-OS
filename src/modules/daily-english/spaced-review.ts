/**
 * Leitner-style spaced review for the daily words, shared by the SQLite API
 * and the browser-only mode.
 *
 * The current box is derived from the last interval (nextReviewDay − lastReviewedDay),
 * so the existing `Word.lastUsedAt` / `Word.nextReviewDate` columns are enough:
 * no schema change or migration is required.
 */

export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60] as const;
/** New words reserved each day, so reviews never starve progression. */
export const MIN_NEW_WORDS_PER_DAY = 3;
/** Words whose interval reaches this many days are shown as mastered. */
export const MASTERY_INTERVAL_DAYS = 30;

export type ReviewOutcome = "SUCCESS" | "PARTIAL" | "FAIL";
export type DayKey = string; // YYYY-MM-DD

export type ReviewState = Readonly<{ lastReviewedDay: DayKey | null; nextReviewDay: DayKey | null }>;
export type ReviewStatus = "nouveau" | "actif" | "maitrise";

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtc(day: DayKey): number {
  const [year, month, date] = day.split("-").map(Number);
  return Date.UTC(year, month - 1, date);
}

export function addDays(day: DayKey, days: number): DayKey {
  return new Date(toUtc(day) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((toUtc(to) - toUtc(from)) / DAY_MS);
}

export function isReviewed(state: ReviewState): boolean {
  return state.lastReviewedDay !== null && state.nextReviewDay !== null;
}

/** Interval (days) that produced the current schedule; 0 for a word never reviewed. */
export function currentInterval(state: ReviewState): number {
  if (!isReviewed(state)) return 0;
  return Math.max(0, daysBetween(state.lastReviewedDay as DayKey, state.nextReviewDay as DayKey));
}

export function nextInterval(current: number, outcome: ReviewOutcome): number {
  if (outcome === "FAIL") return REVIEW_INTERVALS_DAYS[0];
  if (outcome === "PARTIAL") {
    // Stay in the same box (at least the first one).
    const kept = [...REVIEW_INTERVALS_DAYS].reverse().find((interval) => interval <= current);
    return kept ?? REVIEW_INTERVALS_DAYS[0];
  }
  return REVIEW_INTERVALS_DAYS.find((interval) => interval > current) ?? REVIEW_INTERVALS_DAYS[REVIEW_INTERVALS_DAYS.length - 1];
}

export function reviewStatus(state: ReviewState): ReviewStatus {
  if (!isReviewed(state)) return "nouveau";
  return currentInterval(state) >= MASTERY_INTERVAL_DAYS ? "maitrise" : "actif";
}

export function applyReview(state: ReviewState, outcome: ReviewOutcome, today: DayKey): { lastReviewedDay: DayKey; nextReviewDay: DayKey; status: ReviewStatus } {
  const interval = nextInterval(currentInterval(state), outcome);
  const next = { lastReviewedDay: today, nextReviewDay: addDays(today, interval) };
  return { ...next, status: reviewStatus(next) };
}

export type ScheduleCandidate = Readonly<{ id: string; group: string; review: ReviewState }>;

/**
 * Daily selection:
 *  1. due reviews, most overdue first, leaving room for `minNew` new words;
 *  2. new words, interleaved across groups (packs) for variety, in pool order;
 *  3. if still short, the remaining due reviews, then the ones coming up soonest.
 */
export function scheduleDailyWords(candidates: readonly ScheduleCandidate[], today: DayKey, count: number, minNew = MIN_NEW_WORDS_PER_DAY): string[] {
  const reviewed = candidates.filter((candidate) => isReviewed(candidate.review));
  const byNextReview = (a: ScheduleCandidate, b: ScheduleCandidate) =>
    (a.review.nextReviewDay as DayKey).localeCompare(b.review.nextReviewDay as DayKey);

  const due = reviewed.filter((candidate) => (candidate.review.nextReviewDay as DayKey) <= today).sort(byNextReview);
  const upcoming = reviewed.filter((candidate) => (candidate.review.nextReviewDay as DayKey) > today).sort(byNextReview);

  const groups = new Map<string, ScheduleCandidate[]>();
  for (const candidate of candidates) {
    if (isReviewed(candidate.review)) continue;
    groups.set(candidate.group, [...(groups.get(candidate.group) ?? []), candidate]);
  }
  const fresh: ScheduleCandidate[] = [];
  const queues = [...groups.values()];
  for (let round = 0; queues.some((queue) => queue.length > round); round += 1) {
    for (const queue of queues) if (queue[round]) fresh.push(queue[round]);
  }

  const reviewSlots = Math.max(0, count - Math.min(minNew, fresh.length));
  const reviews = due.slice(0, reviewSlots);
  const newWords = fresh.slice(0, count - reviews.length);
  return [...reviews, ...newWords, ...due.slice(reviews.length), ...upcoming].slice(0, count).map((candidate) => candidate.id);
}

export type UsageCheck = (word: string, text: string) => boolean;

/**
 * SUCCESS: the word appears both in the personal sentence and in the oral production.
 * PARTIAL: it appears in only one of them. FAIL: in neither.
 */
export function reviewOutcomes(
  words: readonly Readonly<{ id: string; word: string }>[],
  personalSentences: Readonly<Record<string, string>>,
  production: string,
  uses: UsageCheck,
): { wordId: string; outcome: ReviewOutcome }[] {
  return words.map((word) => {
    const inSentence = uses(word.word, personalSentences[word.id] ?? "");
    const inProduction = uses(word.word, production);
    const outcome: ReviewOutcome = inSentence && inProduction ? "SUCCESS" : inSentence || inProduction ? "PARTIAL" : "FAIL";
    return { wordId: word.id, outcome };
  });
}

export function isReviewOutcome(value: unknown): value is ReviewOutcome {
  return value === "SUCCESS" || value === "PARTIAL" || value === "FAIL";
}
