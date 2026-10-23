import assert from "node:assert/strict";
import test from "node:test";
import { buildAgentPractice, parseAgentPractice } from "../../../src/modules/learner-snapshot/agent-practice.ts";

const chapters = [{ id: "ch_a", title: "Chapitre A", subject: "Matière fictive" }];
const attempts = [
  { at: "2026-01-01T10:00:00Z", chapterId: "ch_a", questionId: "q1", correct: false },
  { at: "2026-01-02T10:00:00Z", chapterId: "ch_a", questionId: "q1", correct: true },
  { at: "2026-01-02T11:00:00Z", chapterId: "ch_a", questionId: "q2", correct: false },
  { at: "2026-01-03T09:00:00Z", chapterId: "ch_inconnu", questionId: "q3", correct: true },
];

test("per-chapter counts: the latest answer decides what is left to retry", () => {
  const practice = buildAgentPractice(attempts, chapters, new Date("2026-01-04T00:00:00Z"));
  assert.equal(practice.evidence, "DERIVED_PRACTICE");
  const a = practice.chapters.find((chapter) => chapter.chapterId === "ch_a")!;
  assert.deepEqual([a.title, a.answered, a.correct, a.toRetry, a.lastAt], ["Chapitre A", 3, 1, 1, "2026-01-02T11:00:00Z"]);
  assert.equal(practice.chapters[0].chapterId, "ch_inconnu", "most recent first; unknown chapters keep their id");
  assert.ok(!JSON.stringify(practice).includes("q1"), "counts only, no question identifiers");
});

test("the app accepts a valid summary and rejects damaged or inflated ones", () => {
  const text = JSON.stringify(buildAgentPractice(attempts, chapters, new Date(0)));
  assert.equal(parseAgentPractice(text).chapters.length, 2);
  const inflated = JSON.parse(text); inflated.chapters[0].correct = 99;
  assert.throws(() => parseAgentPractice(JSON.stringify(inflated)), /INVALID_AGENT_PRACTICE/);
  const mastery = JSON.parse(text); mastery.evidence = "MASTERY";
  assert.throws(() => parseAgentPractice(JSON.stringify(mastery)), /INVALID_AGENT_PRACTICE/);
});

test("the app reads the summary from the shared folder, and ignores it without permission or when damaged", async () => {
  const { readAgentPractice } = await import("../../../src/modules/learner-snapshot/browser-bridge.ts");
  const folder = (content: string, permission: "granted" | "prompt" = "granted") => ({
    name: "ELOS-Hermes",
    queryPermission: async () => permission,
    requestPermission: async () => permission,
    getFileHandle: async (name: string) => {
      if (name !== "elos-practice.json") throw new Error("NotFound");
      return { getFile: async () => ({ text: async () => content }), createWritable: async () => { throw new Error("read only"); } };
    },
  });
  const valid = JSON.stringify(buildAgentPractice(attempts, chapters, new Date(0)));
  assert.equal((await readAgentPractice(folder(valid)))?.chapters.length, 2);
  assert.equal(await readAgentPractice(folder(valid, "prompt")), null);
  assert.equal(await readAgentPractice(folder("{not json")), null);
});
