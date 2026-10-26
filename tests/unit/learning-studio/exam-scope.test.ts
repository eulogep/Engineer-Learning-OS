import assert from "node:assert/strict";
import test from "node:test";
import { buildImportedDocument } from "../../../src/modules/learning-studio/import.ts";
import { citationFor } from "../../../src/modules/learning-studio/core.ts";
import { documentsForExamScope, type ExamScopeConfirmation } from "../../../src/modules/learning-studio/exam-scope.ts";
import { buildMockExam, gradeMockExam } from "../../../src/modules/learning-studio/exam.ts";

const now = new Date("2026-10-26T12:00:00Z");
const document = { ...buildImportedDocument("synthetic-sql", { title: "Synthetic course", subjectLabel: "SQL", chapter: "Tables", docType: "COURS" }, [
  { pageNumber: 1, text: "Consigne synthétique : l’examen couvre uniquement la création de tables." },
  { pageNumber: 2, text: "CREATE TABLE test (id INTEGER PRIMARY KEY);" },
  { pageNumber: 3, text: "SELECT city, count(*) FROM users GROUP BY city HAVING count(*) > 3;" },
], "page", now), provenance: { sourceId: "synthetic-sql", sha256: "a".repeat(64), originalFileName: "synthetic.txt",
  extractionMethod: "PLAIN_TEXT_LOCAL", artifactRole: "DERIVED" as const, originalRole: "ORIGINAL_SOURCE" as const } };
const reference = (page: number) => citationFor(document, page, document.pages[page - 1].passages[0].id, document.pages[page - 1].passages[0].text);
const scope: ExamScopeConfirmation = { subjectId: document.subjectId, confirmation: "LEARNER_ATTESTED_FROM_SOURCE", confirmedAt: now.toISOString(), instruction: reference(1), passages: [reference(2)] };

test("only explicitly covered passages generate exam questions", () => {
  const filtered = documentsForExamScope([document], scope);
  assert.deepEqual(filtered[0].pages.map((page) => page.pageNumber), [2]);
  const exam = buildMockExam([document], 10, 1, now, { scope, includeOpenResponses: true });
  assert.equal(exam.questions.length, 1);
  assert.ok(exam.questions[0].prompt.includes("CREATE TABLE"));
  assert.ok(!exam.questions.some((question) => /GROUP BY|HAVING/.test(question.prompt)));
  assert.equal(document.pages.length, 3);
});

test("changed versions, hashes, missing instructions and cross-subject references fail closed", () => {
  assert.throws(() => documentsForExamScope([{ ...document, version: 2 }], scope), /INVALID_EXAM_SCOPE/);
  assert.throws(() => documentsForExamScope([{ ...document, provenance: { ...document.provenance, sha256: "b".repeat(64) } }], scope), /INVALID_EXAM_SCOPE/);
  assert.throws(() => documentsForExamScope([document], { ...scope, subjectId: "WEB" }), /INVALID_EXAM_SCOPE/);
  assert.throws(() => documentsForExamScope([document], { ...scope, passages: [] }), /INVALID_EXAM_SCOPE/);
  assert.throws(() => documentsForExamScope([document], { ...scope, instruction: { ...scope.instruction, quote: "invented" } }), /INVALID_EXAM_SCOPE/);
});

test("programme-only and unverified sources cannot authorize or enter an exam scope", () => {
  for (const status of ["PROGRAM_ONLY", "UNVERIFIED"] as const) {
    const candidate = { ...document, academicSource: { id: "catalogue-id", path: "knowledge/synthetic.txt", sha256: "a".repeat(64), status,
      classification: "PERSONAL" as const, examScope: "UNCONFIRMED" as const } };
    assert.throws(() => documentsForExamScope([candidate], scope), /INVALID_EXAM_SCOPE/);
  }
});

test("scope snapshots are retained with derived practice without rewriting original evidence", () => {
  const exam = buildMockExam([document], 5, 1, now, { scope, includeOpenResponses: true });
  assert.notEqual(exam.scope, scope);
  const result = gradeMockExam(exam, {}, {}, now, new Date(now.getTime() + 1000));
  assert.deepEqual(result.attempt.examScope, scope);
  assert.notEqual(result.attempt.examScope, exam.scope);
  assert.equal(result.attempt.canonical, false);
  assert.equal(result.pending, 1);
});
