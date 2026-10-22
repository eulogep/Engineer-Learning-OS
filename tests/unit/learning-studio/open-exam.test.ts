import assert from "node:assert/strict";
import test from "node:test";
import { buildMockExam, gradeMockExam } from "../../../src/modules/learning-studio/exam.ts";
import { difficulties, deriveFlashcards, readStudioState, verifyCitation, writeStudioState } from "../../../src/modules/learning-studio/core.ts";
import { SYNTHETIC_DOCUMENTS as documents } from "../../../src/modules/learning-studio/fixtures.ts";
import { buildImportedDocument } from "../../../src/modules/learning-studio/import.ts";

const now = new Date("2026-10-22T12:00:00Z");
test("PHP and SQL technical exercises use actual source excerpts without executing code", () => {
  const source = buildImportedDocument("synthetic-code", { title: "Synthetic code", subjectLabel: "WEB", chapter: "Queries", docType: "TP" }, [
    { pageNumber: 1, text: "SELECT id FROM users WHERE active = 1;" },
    { pageNumber: 2, text: "<?php session_start(); $_SESSION['name'] = $_POST['name']; ?>" },
  ], "page", now);
  const exam = buildMockExam([source], 10, 2, now, { includeOpenResponses: true });
  assert.equal(exam.questions.length, 2);
  assert.ok(exam.questions.every((question) => question.responseType === "OPEN_RESPONSE" && verifyCitation([source], question.citations[0])));
  assert.ok(exam.questions.some((question) => question.prompt.includes("SELECT id FROM users")));
  assert.ok(exam.questions.some((question) => question.prompt.includes("$_POST['name']")));
  const result = gradeMockExam(exam, {}, {}, now, new Date(now.getTime() + 1000));
  assert.equal(result.pending, 2);
  assert.equal(result.total, 0);
});
test("exam duration is configurable and bounded", () => {
  assert.equal(buildMockExam(documents, 5, 1, now, { durationSeconds: 1200 }).durationSeconds, 1200);
  for (const durationSeconds of [NaN, 0, -60, 10801, 60.5]) assert.throws(() => buildMockExam(documents, 5, 1, now, { durationSeconds }), /INVALID_EXAM_DURATION/);
  for (const count of [NaN, 0, -1, 101, 1.5]) assert.throws(() => buildMockExam(documents, count, 1, now), /INVALID_EXAM_COUNT/);
});

test("open questions are cited and pending even when answer exactly matches the reference", () => {
  const exam = buildMockExam(documents, 6, 1, now, { includeOpenResponses: true });
  assert.ok(exam.questions.some((question) => question.responseType === "OPEN_RESPONSE"));
  for (const question of exam.questions) assert.ok(question.citations.every((citation) => verifyCitation(documents, citation)));
  const answers = Object.fromEntries(exam.questions.map((question) => [question.id, question.answer]));
  const result = gradeMockExam(exam, answers, {}, now, new Date(now.getTime() + 60_000));
  assert.equal(result.pending, 3);
  assert.equal(result.total, 3);
  assert.equal(result.score, 3);
  assert.equal(result.attempt.canonical, false);
  assert.equal(result.attempt.pendingResponses?.length, 3);
  assert.ok(result.attempt.pendingResponses?.every((response) => response.status === "PENDING_HUMAN_VALIDATION"));
  assert.deepEqual(difficulties([result.attempt], deriveFlashcards(documents)), []);
});

test("pending responses survive existing Studio persistence without generating errors", () => {
  const exam = buildMockExam(documents, 1, 5, now, { includeOpenResponses: true });
  const result = gradeMockExam(exam, { [exam.questions[0].id]: "Synthetic free response" }, {}, now, new Date(now.getTime() + 1000));
  let data = "";
  const storage = { getItem: () => data, setItem: (_key: string, value: string) => { data = value; } };
  writeStudioState(storage, { version: 1, reviews: {}, attempts: [result.attempt] });
  assert.deepEqual(readStudioState(storage).attempts, [result.attempt]);
  assert.deepEqual(result.attempt.items, []);
});

test("deadline is reached at the exact boundary and invalid clocks are rejected", () => {
  const exam = buildMockExam(documents, 5, 1, now, { durationSeconds: 60 });
  assert.equal(gradeMockExam(exam, {}, {}, now, new Date(now.getTime() + 60_000)).timedOut, true);
  assert.throws(() => gradeMockExam(exam, {}, {}, now, new Date(now.getTime() - 1000)), /INVALID_EXAM_TIMESTAMPS/);
  assert.throws(() => gradeMockExam(exam, {}, {}, now, new Date(NaN)), /INVALID_EXAM_TIMESTAMPS/);
});
