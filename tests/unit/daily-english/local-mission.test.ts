import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_WORD_COUNT,
  LOCAL_STATE_KEY,
  analyzeProduction,
  createLocalSession,
  dayKey,
  isLocalSessionId,
  loadOrCreateLocalMission,
  localProgressSummary,
  localWordId,
  missionReviews,
  readLocalState,
  saveLocalSession,
  selectDailyWordIds,
  updateLocalMission,
  wordUsagePattern,
} from "../../../src/modules/daily-english/local-mission.ts";
import { VOCABULARY } from "../../../src/modules/daily-english/vocabulary.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

let counter = 0;
const nextId = () => `id-${++counter}`;

test("first mission mixes new words from every vocabulary pack", () => {
  const first = selectDailyWordIds(VOCABULARY, {}, "2026-10-01");
  assert.equal(first.length, DAILY_WORD_COUNT);
  const packs = new Set(first.map((id) => VOCABULARY.find((entry) => localWordId(entry.word) === id)?.pack));
  assert.equal(packs.size, 5);
});

test("unfinished missions do not burn new words; completed ones schedule reviews", () => {
  const storage = memoryStorage();
  const day1 = loadOrCreateLocalMission(storage, new Date(2026, 9, 1, 9), nextId);
  const day2 = loadOrCreateLocalMission(storage, new Date(2026, 9, 2, 9), nextId);
  assert.deepEqual(day2.words.map((word) => word.id), day1.words.map((word) => word.id));

  const sentences = Object.fromEntries(day2.words.map((word) => [word.id, `I use ${word.word} here.`]));
  const production = day2.words.slice(0, 5).map((word) => `I like ${word.word}.`).join(" ");
  updateLocalMission(storage, day2.mission.id, { completed: true, reviews: missionReviews(day2.words, sentences, production) }, new Date(2026, 9, 2, 20));

  const day3 = loadOrCreateLocalMission(storage, new Date(2026, 9, 3, 9), nextId);
  // Every word reviewed on day 2 is due on day 3 (first box = 1 day), but three
  // slots stay reserved for new words; the other reviews wait for tomorrow.
  const day2Ids = new Set(day2.words.map((word) => word.id));
  assert.equal(day3.words.filter((word) => day2Ids.has(word.id)).length, 7);
  assert.equal(day3.words.filter((word) => word.status === "nouveau").length, 3);
  assert.equal(readLocalState(storage).reviews[day2.words[0].id]?.nextReviewDay, "2026-10-03");
});

test("reviews apply once and only to words of the mission", () => {
  const storage = memoryStorage();
  const { words, mission } = loadOrCreateLocalMission(storage, new Date(2026, 9, 5, 9), nextId);
  const reviews = [{ wordId: words[0].id, outcome: "SUCCESS" as const }, { wordId: "local-word-not-in-mission", outcome: "SUCCESS" as const }];
  updateLocalMission(storage, mission.id, { completed: true, reviews }, new Date(2026, 9, 5));
  updateLocalMission(storage, mission.id, { completed: true, reviews }, new Date(2026, 9, 5));
  const state = readLocalState(storage);
  assert.deepEqual(state.reviews[words[0].id], { lastReviewedDay: "2026-10-05", nextReviewDay: "2026-10-06" });
  assert.equal(state.reviews["local-word-not-in-mission"], undefined);
});

test("version 1 storage keeps its history and starts reviews fresh", () => {
  const legacy = { version: 1, lastUsed: { "local-word-embrace": "2026-10-09" }, missions: [{ id: "local-mission-old", date: "2026-10-09T00:00:00", wordIdsJson: "[]", personalSentencesJson: "{}", speakingSessionId: null, completed: true, createdAt: "2026-10-09T08:00:00.000Z" }], sessions: [] };
  const state = readLocalState(memoryStorage({ [LOCAL_STATE_KEY]: JSON.stringify(legacy) }));
  assert.equal(state.version, 2);
  assert.equal(state.missions.length, 1);
  assert.deepEqual(state.reviews, {});
});

test("progress summary counts the streak of completed days", () => {
  const storage = memoryStorage();
  for (const day of [8, 9, 10]) {
    const { mission } = loadOrCreateLocalMission(storage, new Date(2026, 9, day, 9), nextId);
    updateLocalMission(storage, mission.id, { completed: true }, new Date(2026, 9, day, 20));
  }
  assert.equal(localProgressSummary(storage, new Date(2026, 9, 10, 21)).streak, 3);
  assert.equal(localProgressSummary(storage, new Date(2026, 9, 11, 9)).streak, 3);
  assert.equal(localProgressSummary(storage, new Date(2026, 9, 12, 9)).streak, 0);
});

test("the same local day returns the same mission and keeps saved sentences", () => {
  const storage = memoryStorage();
  const morning = loadOrCreateLocalMission(storage, new Date(2026, 9, 10, 8), nextId);
  updateLocalMission(storage, morning.mission.id, { personalSentences: { [morning.words[0].id]: "I embrace change." } });
  const evening = loadOrCreateLocalMission(storage, new Date(2026, 9, 10, 22), nextId);

  assert.equal(evening.mission.id, morning.mission.id);
  assert.deepEqual(evening.words.map((word) => word.id), morning.words.map((word) => word.id));
  assert.equal(JSON.parse(evening.mission.personalSentencesJson)[morning.words[0].id], "I embrace change.");
  assert.equal(dayKey(new Date(2026, 9, 10, 23, 59)), "2026-10-10");
});

test("completing a local mission records the session and survives a reload", () => {
  const storage = memoryStorage();
  const { mission } = loadOrCreateLocalMission(storage, new Date(2026, 9, 11, 8), nextId);
  const session = saveLocalSession(storage, createLocalSession("Synthetic speech.", 42, new Date(2026, 9, 11, 9), nextId));
  assert.equal(isLocalSessionId(session.id), true);
  assert.equal(isLocalSessionId("cl0serverid"), false);

  updateLocalMission(storage, mission.id, { speakingSessionId: session.id, completed: true });
  const state = readLocalState(storage);
  assert.equal(state.missions.find((item) => item.id === mission.id)?.completed, true);
  assert.equal(state.sessions[0].durationSeconds, 42);
});

test("corrupted or blocked storage degrades to a working in-memory mission", () => {
  const corrupted = memoryStorage({ [LOCAL_STATE_KEY]: "{not json" });
  assert.equal(loadOrCreateLocalMission(corrupted, new Date(2026, 9, 12), nextId).words.length, DAILY_WORD_COUNT);

  const blocked = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("QuotaExceeded"); } };
  assert.equal(loadOrCreateLocalMission(blocked, new Date(2026, 9, 12), nextId).words.length, DAILY_WORD_COUNT);
  assert.equal(loadOrCreateLocalMission(null, new Date(2026, 9, 12), nextId).words.length, DAILY_WORD_COUNT);
});

test("stored history is bounded so localStorage cannot grow without limit", () => {
  const storage = memoryStorage();
  for (let day = 0; day < 70; day += 1) loadOrCreateLocalMission(storage, new Date(2026, 0, 1 + day), nextId);
  assert.equal(readLocalState(storage).missions.length, 60);
});

test("word usage detection accepts regular inflections only for the target word", () => {
  assert.equal(wordUsagePattern("embrace").test("I am embracing new tools"), true);
  assert.equal(wordUsagePattern("thrive").test("Teams thrived"), true);
  assert.equal(wordUsagePattern("adapt").test("we adapted quickly"), true);
  assert.equal(wordUsagePattern("adapt").test("an adapter cable"), false);
  assert.equal(wordUsagePattern("apply").test("I applied last week"), true);
  assert.equal(wordUsagePattern("cover letter").test("my Cover Letter is ready"), true);
});

test("local analysis fixes frequent French-speaker errors with French explanations", () => {
  const words = [
    { id: "w1", word: "collaborate" },
    { id: "w2", word: "insight" },
  ];
  const result = analyzeProduction("i am agree that we collaborate since 3 years. it depend of the informations.", words);

  assert.equal(result.correctedText, "I agree that we collaborate for 3 years. It depend on the information.");
  assert.deepEqual(result.usedWordIds, ["w1"]);
  assert.deepEqual(result.missingWords, ["insight"]);
  assert.ok(result.feedback.errors.length >= 3 && result.feedback.errors.length <= 5);
  assert.ok(result.feedback.errors.every((error) => error.explanation.length > 10));
});

test("clean English produces no invented errors", () => {
  const result = analyzeProduction("I want to explore new opportunities this year.", [{ id: "w", word: "explore" }]);
  assert.equal(result.correctedText, "I want to explore new opportunities this year.");
  assert.deepEqual(result.feedback.errors, []);
});
