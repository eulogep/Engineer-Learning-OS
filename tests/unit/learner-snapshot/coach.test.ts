import assert from "node:assert/strict";
import test from "node:test";
import { buildMorningMessage } from "../../../src/modules/learner-snapshot/coach.ts";
import type { LearnerSnapshot } from "../../../src/modules/learner-snapshot/core.ts";

const base: LearnerSnapshot = {
  format: "engineer-learning-os/learner-snapshot", version: 1, generatedAt: "2026-10-23T05:00:00.000Z", today: "2026-10-23",
  dailyEnglish: { streak: 4, wordsSeen: 30, wordsMastered: 3, totalWords: 150, todayMission: null, dueWords: [{ word: "embrace", translation: "accepter", due: "2026-10-23" }] },
  studio: { scheduler: "CURRENT_V1", dueToday: [{ term: "TCP", source: "Cours" }, { term: "UDP", source: "Cours" }], next7Days: [], difficulties: [{ term: "clé étrangère", errors: 2, attempts: 3 }], schedulerReplay: { predictions: 0, enough: false, logLoss: {} } },
  exams: [{ course: "Base de données SQL", date: "2026-10-26", priority: "P1", daysLeft: 3 }],
  privacy: { excludes: [] },
};

test("morning message: streak, workload, recall on the top difficulty, English practice, exam advice", () => {
  const message = buildMorningMessage(base, new Date("2026-10-23T06:00:00Z"));
  assert.match(message, /Série Daily English : 4 jours/);
  assert.match(message, /2 cartes de cours · 1 mot d’anglais/);
  assert.match(message, /que désigne « clé étrangère »/);
  assert.match(message, /Mot du jour : /);
  assert.match(message, /À l’oral \(/);
  assert.match(message, /Base de données SQL dans 3 jours : examen blanc chronométré/);
  assert.ok(!/⚠️/.test(message));
});

test("stale or missing snapshots are stated, nothing is invented", () => {
  assert.match(buildMorningMessage(base, new Date("2026-10-25T08:00:00Z")), /plus de 24 h/);
  const missing = buildMorningMessage(null, new Date());
  assert.match(missing, /Je ne trouve pas ton résumé ELOS/);
  assert.ok(!/À réviser/.test(missing));
});

test("message is deterministic for a given day and rotates the word of the day", () => {
  const now = new Date("2026-10-23T06:00:00Z");
  assert.equal(buildMorningMessage(base, now), buildMorningMessage(base, now));
  const tomorrow = buildMorningMessage({ ...base, today: "2026-10-24", generatedAt: "2026-10-24T05:00:00.000Z" }, new Date("2026-10-24T06:00:00Z"));
  const word = (text: string) => text.match(/Mot du jour : (.+)/)![1];
  assert.notEqual(word(tomorrow), word(buildMorningMessage(base, now)));
});
