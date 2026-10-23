import assert from "node:assert/strict";
import test from "node:test";
import { rateCard, readStudioState, writeStudioState, STUDIO_STATE_KEY, type StudioState } from "../../../src/modules/learning-studio/core.ts";
import { fsrsIntervalDays, fsrsMemoryFromHistory, FSRS_4_5_DEFAULT_WEIGHTS } from "../../../src/modules/scientific-pedagogy/replay.ts";

const base: StudioState = { version: 1, reviews: {}, attempts: [], reviewLog: [] };
const DAY = 86_400_000;

test("FSRS interval equals stability at 90 % target and is bounded", () => {
  assert.equal(fsrsIntervalDays(10), 10);
  assert.equal(fsrsIntervalDays(0.2), 1);
  assert.equal(fsrsIntervalDays(5000), 365);
  assert.ok(fsrsIntervalDays(10, 0.8) > fsrsIntervalDays(10, 0.95));
});

test("FSRS memory is rebuilt from the item's own history", () => {
  assert.equal(fsrsMemoryFromHistory([]), null);
  const first = fsrsMemoryFromHistory([{ at: 0, success: true }])!;
  assert.equal(first.stability, FSRS_4_5_DEFAULT_WEIGHTS[2]);
  const later = fsrsMemoryFromHistory([{ at: 0, success: true }, { at: 4 * DAY, success: true }])!;
  assert.ok(later.stability > first.stability);
});

test("Leitner stays the default scheduler", () => {
  const next = rateCard(base, "c1", "SUCCESS", new Date(2026, 9, 23, 10), "2026-10-23");
  assert.deepEqual(next.reviews.c1, { lastReviewedDay: "2026-10-23", nextReviewDay: "2026-10-24" });
  assert.equal(next.reviewLog?.length, 1);
});

test("experimental FSRS schedules from the review log and lengthens after spaced successes", () => {
  let state: StudioState = { ...base, scheduler: "FSRS_4_5" };
  state = rateCard(state, "c1", "SUCCESS", new Date(Date.UTC(2026, 9, 1, 10)), "2026-10-01");
  const firstGap = Math.round((Date.parse(state.reviews.c1.nextReviewDay!) - Date.parse("2026-10-01")) / DAY);
  assert.equal(firstGap, Math.round(FSRS_4_5_DEFAULT_WEIGHTS[2]));
  state = rateCard(state, "c1", "SUCCESS", new Date(Date.UTC(2026, 9, 5, 10)), "2026-10-05");
  const secondGap = Math.round((Date.parse(state.reviews.c1.nextReviewDay!) - Date.parse("2026-10-05")) / DAY);
  assert.ok(secondGap > firstGap, `${secondGap} > ${firstGap}`);
  state = rateCard(state, "c1", "FAIL", new Date(Date.UTC(2026, 9, 20, 10)), "2026-10-20");
  const lapseGap = Math.round((Date.parse(state.reviews.c1.nextReviewDay!) - Date.parse("2026-10-20")) / DAY);
  assert.ok(lapseGap >= 1 && lapseGap < secondGap, `after a lapse ${lapseGap} < ${secondGap}`);
});

test("the scheduler choice survives storage and unknown values fall back to Leitner", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
  writeStudioState(storage, { ...base, scheduler: "FSRS_4_5" });
  assert.equal(readStudioState(storage).scheduler, "FSRS_4_5");
  values.set(STUDIO_STATE_KEY, JSON.stringify({ version: 1, reviews: {}, attempts: [], scheduler: "SM2" }));
  assert.equal(readStudioState(storage).scheduler, "CURRENT_V1");
});
