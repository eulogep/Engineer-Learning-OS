import assert from "node:assert/strict";
import test from "node:test";
import { BACKUP_FORMAT, BackupError, backupFilename, createBackup, importBackup, mergeStates, parseBackup } from "../../../src/modules/daily-english/backup.ts";
import { LOCAL_STATE_KEY, loadOrCreateLocalMission, readLocalState, updateLocalMission } from "../../../src/modules/daily-english/local-mission.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
let counter = 0;
const nextId = () => `id-${++counter}`;

function completedDay(storage: ReturnType<typeof memoryStorage>, day: number) {
  const { words, mission } = loadOrCreateLocalMission(storage, new Date(2026, 9, day, 9), nextId);
  updateLocalMission(storage, mission.id, { completed: true, reviews: words.slice(0, 3).map((word) => ({ wordId: word.id, outcome: "SUCCESS" as const })) }, new Date(2026, 9, day, 20));
  return mission;
}

test("a backup restores the full progress on a new device", () => {
  const laptop = memoryStorage();
  completedDay(laptop, 1); completedDay(laptop, 2);
  const file = JSON.stringify(createBackup(laptop, new Date(2026, 9, 2, 21)));

  const phone = memoryStorage();
  const summary = importBackup(phone, file);
  // Day 1 reviews are due on day 2, so day 2 reviews the same three words again.
  assert.deepEqual(summary, { missions: 2, completed: 2, wordsScheduled: 3 });
  assert.deepEqual(readLocalState(phone), readLocalState(laptop));
});

test("import merges and never loses progress made on either side", () => {
  const a = memoryStorage(); completedDay(a, 1);
  const b = memoryStorage(); b.values.set(LOCAL_STATE_KEY, a.values.get(LOCAL_STATE_KEY) as string); completedDay(b, 2);
  // Device A keeps going too, then imports B's backup.
  completedDay(a, 3);
  importBackup(a, JSON.stringify(createBackup(b, new Date())));
  const merged = readLocalState(a);
  assert.equal(merged.missions.length, 3);
  assert.deepEqual(merged.missions.map((mission) => String(mission.date).slice(0, 10)), ["2026-10-01", "2026-10-02", "2026-10-03"]);
});

test("a completed mission and the most recent review win a conflict", () => {
  const mission = { id: "m", date: "2026-10-01T00:00:00", wordIdsJson: "[]", personalSentencesJson: "{}", speakingSessionId: null, completed: false, createdAt: "x" };
  const merged = mergeStates(
    { version: 2, reviews: { w: { lastReviewedDay: "2026-10-05", nextReviewDay: "2026-10-12" } }, missions: [mission], sessions: [] },
    { version: 2, reviews: { w: { lastReviewedDay: "2026-10-02", nextReviewDay: "2026-10-03" }, v: { lastReviewedDay: "2026-10-02", nextReviewDay: "2026-10-03" } }, missions: [{ ...mission, completed: true }], sessions: [] },
  );
  assert.equal(merged.missions[0].completed, true);
  assert.equal(merged.reviews.w.lastReviewedDay, "2026-10-05");
  assert.ok(merged.reviews.v);
});

test("damaged or foreign files are rejected as a whole", () => {
  const storage = memoryStorage(); completedDay(storage, 4);
  const before = storage.values.get(LOCAL_STATE_KEY);
  const valid = createBackup(storage, new Date());
  const cases = [
    "not json",
    JSON.stringify({ format: "something-else", version: 2, state: valid.state }),
    JSON.stringify({ ...valid, version: 1 }),
    JSON.stringify({ ...valid, state: { ...valid.state, missions: [{ id: 42 }] } }),
    JSON.stringify({ ...valid, state: { ...valid.state, reviews: { w: { lastReviewedDay: "yesterday", nextReviewDay: null } } } }),
  ];
  for (const text of cases) assert.throws(() => importBackup(storage, text), BackupError);
  assert.equal(storage.values.get(LOCAL_STATE_KEY), before);
});

test("backup file name and format", () => {
  assert.equal(backupFilename(new Date("2026-10-22T12:00:00Z")), "daily-english-2026-10-22.json");
  assert.equal(parseBackup(JSON.stringify(createBackup(memoryStorage(), new Date()))).format, BACKUP_FORMAT);
});
