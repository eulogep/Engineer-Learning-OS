import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_WORD_COUNT,
  LOCAL_STATE_KEY,
  LOCAL_WORD_POOL,
  analyzeProduction,
  createLocalSession,
  dayKey,
  isLocalSessionId,
  loadOrCreateLocalMission,
  localWordId,
  readLocalState,
  saveLocalSession,
  selectDailyWordIds,
  updateLocalMission,
  wordUsagePattern,
} from "../../../src/modules/daily-english/local-mission.ts";

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

test("rotation picks never-used words first, then the least recently used", () => {
  const first = selectDailyWordIds(LOCAL_WORD_POOL, {});
  assert.equal(first.length, DAILY_WORD_COUNT);
  assert.deepEqual(first, LOCAL_WORD_POOL.slice(0, 10).map((seed) => localWordId(seed.word)));

  const lastUsed = Object.fromEntries(first.map((id) => [id, "2026-10-01"]));
  const second = selectDailyWordIds(LOCAL_WORD_POOL, lastUsed);
  assert.equal(second.some((id) => first.includes(id)), false);
});

test("a full pool cycles through every word before repeating", () => {
  const storage = memoryStorage();
  const seen = new Set<string>();
  for (let day = 1; day <= 3; day += 1) {
    const { words } = loadOrCreateLocalMission(storage, new Date(2026, 9, day, 9), nextId);
    words.forEach((word) => seen.add(word.id));
  }
  assert.equal(seen.size, LOCAL_WORD_POOL.length);
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
