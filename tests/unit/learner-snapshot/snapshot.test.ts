import assert from "node:assert/strict";
import test from "node:test";
import { buildLearnerSnapshot, parseLearnerSnapshot } from "../../../src/modules/learner-snapshot/core.ts";
import { loadOrCreateLocalMission, updateLocalMission, saveLocalSession, createLocalSession, missionReviews, readLocalState, LOCAL_STATE_KEY } from "../../../src/modules/daily-english/local-mission.ts";
import { deriveFlashcards, rateCard, type StudioState } from "../../../src/modules/learning-studio/core.ts";
import { SYNTHETIC_DOCUMENTS } from "../../../src/modules/learning-studio/fixtures.ts";

function storage() {
  const values = new Map<string, string>();
  return { values, getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); } };
}

const PERSONAL = "Ma soeur Aminata habite rue Secrète";
const TRANSCRIPT = "my private spoken answer about my family";

function scenario() {
  const daily = storage();
  const day1 = new Date(2026, 9, 20, 9);
  const { words, mission } = loadOrCreateLocalMission(daily, day1, () => "m1");
  const sentences = Object.fromEntries(words.map((word) => [word.id, `${PERSONAL} — ${word.word}`]));
  updateLocalMission(daily, mission.id, { personalSentences: sentences });
  const session = saveLocalSession(daily, createLocalSession(TRANSCRIPT, 30, day1, () => "s1"));
  updateLocalMission(daily, mission.id, { speakingSessionId: session.id, completed: true, reviews: missionReviews(words, sentences, TRANSCRIPT) }, day1);
  const cards = deriveFlashcards(SYNTHETIC_DOCUMENTS);
  let studio: StudioState = { version: 1, reviews: {}, attempts: [{ id: "a", at: day1.toISOString(), evidenceKind: "DERIVED_PRACTICE", canonical: false, assisted: false,
    items: [{ questionId: "q", cardId: cards[0].id, correct: false }] }], reviewLog: [] };
  studio = rateCard(studio, cards[1].id, "SUCCESS", day1, "2026-10-20");
  return { daily, cards, studio };
}

test("snapshot lists what is due, difficulties and upcoming exams only", () => {
  const { daily, cards, studio: base } = scenario();
  const studio = rateCard(base, cards[2].id, "SUCCESS", new Date(2026, 9, 21, 7), "2026-10-21");
  const snapshot = buildLearnerSnapshot({
    dailyEnglish: readLocalState(daily), dailyStorage: daily, studio, cards,
    documentTitles: Object.fromEntries(SYNTHETIC_DOCUMENTS.map((d) => [d.id, d.title])),
    exams: [{ course: "SQL", date: "2026-11-02", priority: "P1" }, { course: "Passé", date: "2026-09-01", priority: "P0" }, { course: "Réseaux", date: null, priority: "P2" }],
    now: new Date(2026, 9, 21, 8),
  });
  assert.equal(snapshot.today, "2026-10-21");
  assert.ok(snapshot.dailyEnglish.dueWords.length > 0, "day-1 words are due on day 2");
  assert.equal(snapshot.dailyEnglish.streak, 1);
  assert.ok(snapshot.studio.dueToday.some((item) => item.source === SYNTHETIC_DOCUMENTS[0].title));
  assert.ok(snapshot.studio.dueToday.some((item) => item.term === cards[1].term), "a card succeeded yesterday is due again today (Leitner 1 day)");
  assert.ok(!snapshot.studio.dueToday.some((item) => item.term === cards[2].term), "a card reviewed today is not due");
  assert.deepEqual(snapshot.studio.difficulties.map((item) => item.term), [cards[0].term]);
  assert.deepEqual(snapshot.exams, [{ course: "SQL", date: "2026-11-02", priority: "P1", daysLeft: 12 }]);
  assert.equal(parseLearnerSnapshot(JSON.stringify(snapshot)).today, "2026-10-21");
});

test("snapshot never contains personal sentences, transcriptions or source passages", () => {
  const { daily, cards, studio } = scenario();
  assert.ok(daily.values.get(LOCAL_STATE_KEY)!.includes(PERSONAL), "the local state does contain them");
  const text = JSON.stringify(buildLearnerSnapshot({ dailyEnglish: readLocalState(daily), dailyStorage: daily, studio, cards, documentTitles: {}, exams: [], now: new Date(2026, 9, 21) }));
  assert.ok(!text.includes(PERSONAL));
  assert.ok(!text.includes(TRANSCRIPT));
  assert.ok(!text.includes("répond à la couche"), "no source passage text");
  assert.ok(!cards.some((card) => text.includes(card.definition)), "no definitions (source text)");
});

test("readers reject foreign or damaged files", () => {
  assert.throws(() => parseLearnerSnapshot(JSON.stringify({ format: "other" })), /INVALID/);
  assert.throws(() => parseLearnerSnapshot("{"));
});
