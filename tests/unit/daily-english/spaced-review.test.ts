import assert from "node:assert/strict";
import test from "node:test";
import {
  addDays,
  applyReview,
  currentInterval,
  nextInterval,
  reviewOutcomes,
  reviewStatus,
  scheduleDailyWords,
  type ReviewState,
} from "../../../src/modules/daily-english/spaced-review.ts";
import { wordUsagePattern } from "../../../src/modules/daily-english/local-mission.ts";
import { VOCABULARY, VOCABULARY_PACKS, vocabularyEntry } from "../../../src/modules/daily-english/vocabulary.ts";

const NEW: ReviewState = { lastReviewedDay: null, nextReviewDay: null };

test("successful reviews climb the Leitner boxes up to mastery", () => {
  let state: ReviewState = NEW;
  const intervals: number[] = [];
  let day = "2026-10-01";
  for (let i = 0; i < 7; i += 1) {
    const next = applyReview(state, "SUCCESS", day);
    intervals.push(currentInterval(next));
    state = next;
    day = next.nextReviewDay;
  }
  assert.deepEqual(intervals, [1, 3, 7, 14, 30, 60, 60]);
  assert.equal(reviewStatus(state), "maitrise");
});

test("partial keeps the box and failure restarts at one day", () => {
  assert.equal(nextInterval(7, "PARTIAL"), 7);
  assert.equal(nextInterval(0, "PARTIAL"), 1);
  assert.equal(nextInterval(30, "FAIL"), 1);
  assert.equal(reviewStatus(NEW), "nouveau");
  assert.equal(reviewStatus({ lastReviewedDay: "2026-10-01", nextReviewDay: "2026-10-08" }), "actif");
});

test("day arithmetic crosses months and DST changes", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(addDays("2026-03-28", 2), "2026-03-30");
});

test("schedule puts overdue reviews first, then interleaves new words by pack", () => {
  const candidates = [
    { id: "a1", group: "a", review: NEW },
    { id: "a2", group: "a", review: NEW },
    { id: "b1", group: "b", review: NEW },
    { id: "late", group: "a", review: { lastReviewedDay: "2026-09-20", nextReviewDay: "2026-09-21" } },
    { id: "due", group: "b", review: { lastReviewedDay: "2026-10-01", nextReviewDay: "2026-10-04" } },
    { id: "later", group: "b", review: { lastReviewedDay: "2026-10-01", nextReviewDay: "2026-10-30" } },
  ];
  assert.deepEqual(scheduleDailyWords(candidates, "2026-10-04", 5), ["late", "due", "a1", "b1", "a2"]);
  // When nothing new is left, upcoming reviews fill the day.
  assert.deepEqual(scheduleDailyWords(candidates, "2026-10-04", 6).at(-1), "later");
});

test("due reviews never take the slots reserved for new words", () => {
  const due = Array.from({ length: 12 }, (_, i) => ({ id: `due-${i}`, group: "a", review: { lastReviewedDay: "2026-10-01", nextReviewDay: "2026-10-02" } }));
  const fresh = Array.from({ length: 5 }, (_, i) => ({ id: `new-${i}`, group: "b", review: NEW }));
  const picked = scheduleDailyWords([...due, ...fresh], "2026-10-02", 10);
  assert.equal(picked.filter((id) => id.startsWith("new-")).length, 3);
  assert.equal(picked.filter((id) => id.startsWith("due-")).length, 7);
  // With only one new word left, reviews fill the rest of the day.
  assert.equal(scheduleDailyWords([...due, fresh[0]], "2026-10-02", 10).filter((id) => id.startsWith("due-")).length, 9);
});

test("outcomes need the word in both the sentence and the production for success", () => {
  const uses = (word: string, text: string) => wordUsagePattern(word).test(text);
  const words = [{ id: "1", word: "deploy" }, { id: "2", word: "patch" }, { id: "3", word: "hash" }];
  const result = reviewOutcomes(words, { 1: "We deployed it.", 2: "I patch servers." }, "Yesterday we deployed the fix.", uses);
  assert.deepEqual(result.map((item) => item.outcome), ["SUCCESS", "PARTIAL", "FAIL"]);
});

test("vocabulary has five packs of unique words, each example uses its word", () => {
  assert.equal(VOCABULARY_PACKS.length, 5);
  assert.equal(VOCABULARY.length, 150);
  assert.equal(new Set(VOCABULARY.map((entry) => entry.word.toLowerCase())).size, VOCABULARY.length);
  const examplesMissingWord = VOCABULARY.filter((entry) => !wordUsagePattern(entry.word).test(entry.example)).map((entry) => entry.word);
  assert.deepEqual(examplesMissingWord, []);
  assert.equal(vocabularyEntry("Firewall")?.pack, "cybersecurity");
  assert.equal(vocabularyEntry("unknown-word"), null);
});
