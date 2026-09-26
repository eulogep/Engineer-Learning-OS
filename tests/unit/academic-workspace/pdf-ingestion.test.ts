/* eslint-disable @typescript-eslint/no-require-imports -- Node strip-types test runner */
import type {} from "node:test";
const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { academicPdfQuizIsGrounded } = require("../../../src/modules/academic-workspace/core.ts");
const { academicErrorSignals, academicEvidenceFromAttempt } = require("../../../src/modules/academic-workspace/integration.ts");
const { academicExtractorRegistry, classifyInventoryDuplicate, extractorFor } = require("../../../src/modules/academic-workspace/extractor-registry.ts");
const { buildPdfExtractionResult, extractPdfBytes } = require("../../../src/modules/academic-workspace/pdf-extractor.ts");
const { academicWorkspaceRegistry, networkingPdfQuiz, networkingPdfSections } = require("../../../src/modules/academic-workspace/pilot-registry.ts");
const { continueAcademicQuiz, createAcademicQuizAttempt, startAcademicQuiz, submitAcademicAnswer } = require("../../../src/modules/academic-workspace/core.ts");
const { generateReviewItems, mergeErrorPatterns, reviewIsTraceable } = require("../../../src/modules/review-engine/core.ts");

const readable = (pageNumber: number, heading = pageNumber === 1 ? "03 - Modèles de référence" : "Contenu réseau") => ({ pageNumber, text: `${heading}\n${"La couche réseau assure le routage des datagrammes. ".repeat(2)}` });

function completedPdfAttempt() {
  let attempt = startAcademicQuiz(createAcademicQuizAttempt(networkingPdfQuiz, 10, "pdf-attempt"), 20);
  for (const question of networkingPdfQuiz.questions) {
    attempt = submitAcademicAnswer(attempt, networkingPdfQuiz, question.expectedResponse, 30 + attempt.currentQuestionIndex);
    attempt = continueAcademicQuiz(attempt, networkingPdfQuiz, 40 + attempt.currentQuestionIndex);
  }
  return attempt;
}

test("A. text PDF detection uses readable-page density", () => {
  const result = buildPdfExtractionResult("SYNTHETIC-PDF", [readable(1), readable(2), readable(3)]);
  assert.equal(result.pdfType, "TEXT_PDF");
});

test("B. scanned PDF detection returns OCR_REQUIRED without invented text", () => {
  const result = buildPdfExtractionResult("SYNTHETIC-SCAN", Array.from({ length: 4 }, (_, index) => ({ pageNumber: index + 1, text: "" })));
  assert.equal(result.pdfType, "SCANNED_PDF");
  assert.equal(result.status, "OCR_REQUIRED");
  assert.ok(result.pages.every((page: { text: string }) => page.text === ""));
});

test("C. successful extraction preserves every synthetic page", () => {
  const result = buildPdfExtractionResult("SYNTHETIC-SUCCESS", [readable(1), readable(2)]);
  assert.equal(result.status, "SUCCESS");
  assert.equal(result.pages.length, 2);
});

test("D. partial extraction exposes failed and no-text pages", () => {
  const result = buildPdfExtractionResult("SYNTHETIC-PARTIAL", [readable(1), readable(2), { pageNumber: 3, text: "" }, { pageNumber: 4, text: null, error: "fixture" }]);
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.pdfType, "MIXED_PDF");
  assert.equal(result.pages[3].status, "FAILED");
});

test("E. no-text PDF never becomes a successful extraction", () => {
  const result = buildPdfExtractionResult("SYNTHETIC-NO-TEXT", [{ pageNumber: 1, text: "" }]);
  assert.notEqual(result.status, "SUCCESS");
  assert.match(result.warnings.join(" "), /OCR requis/i);
});

test("F. corrupted bytes fail honestly through the real adapter", async () => {
  const result = await extractPdfBytes("SYNTHETIC-CORRUPTED", new Uint8Array([1, 2, 3, 4]));
  assert.ok(["CORRUPTED", "FAILED"].includes(result.status));
  assert.equal(result.pages.length, 0);
});

test("G. page provenance is stable and one-based", () => {
  const result = buildPdfExtractionResult("SYNTHETIC-PROVENANCE", [readable(14), readable(15)]);
  assert.deepEqual(result.pages.map((page: { pageNumber: number }) => page.pageNumber), [14, 15]);
});

test("H. conservative sections preserve source and page range", () => {
  const result = buildPdfExtractionResult("SYNTHETIC-SECTION", [readable(14, "03 - Modèles de référence"), readable(15)]);
  assert.equal(result.sections[0].sourceId, "SYNTHETIC-SECTION");
  assert.equal(result.sections[0].pageStart, 14);
  assert.equal(result.sections[0].pageEnd, 15);
});

test("I. pilot PDF concepts resolve to exact PDF sections", () => {
  const ids = new Set(networkingPdfSections.map((section: { id: string }) => section.id));
  const concepts = academicWorkspaceRegistry.concepts.filter((concept: { sourceIds: string[] }) => concept.sourceIds.includes("ACADEMIC-NETWORK-CH01-001"));
  assert.ok(concepts.length >= 4);
  assert.ok(concepts.every((concept: { sectionIds: string[] }) => concept.sectionIds.every((id) => ids.has(id))));
});

test("J. pilot PDF is assigned to Networking only after content confirmation", () => {
  const academicModule = academicWorkspaceRegistry.modules.find((item: { id: string }) => item.id === "MODULE-NETWORK-FUNDAMENTALS");
  assert.ok(academicModule.sourceIds.includes("ACADEMIC-NETWORK-CH01-001"));
  assert.equal(academicModule.subjectId, "SUBJECT-NETWORKING");
});

test("K. grounded PDF quiz requires source, section, concepts and pages", () => {
  assert.equal(academicPdfQuizIsGrounded(networkingPdfQuiz), true);
  assert.equal(academicPdfQuizIsGrounded({ ...networkingPdfQuiz, questions: [{ ...networkingPdfQuiz.questions[0], pageStart: undefined }] }), false);
});

test("L. PDF quiz evidence propagates page references", () => {
  const completion = academicEvidenceFromAttempt(completedPdfAttempt(), networkingPdfQuiz).at(-1);
  assert.equal(completion.evaluationResult.academicPageReferences.length, 1);
  assert.equal(new Set(completion.evaluationResult.academicPageReferences.map((reference: { sourceId: string; pageStart: number; pageEnd: number }) => `${reference.sourceId}:${reference.pageStart}:${reference.pageEnd}`)).size, 1);
  assert.ok(completion.evaluationResult.academicPageReferences.every((reference: { pageStart: number }) => reference.pageStart >= 14));
});

test("M. PDF quiz error creates a traceable review", () => {
  let attempt = startAcademicQuiz(createAcademicQuizAttempt(networkingPdfQuiz, 1, "pdf-wrong"), 2);
  attempt = submitAcademicAnswer(attempt, networkingPdfQuiz, "transport", 3);
  const evidence = academicEvidenceFromAttempt(attempt, networkingPdfQuiz);
  const signals = academicErrorSignals(attempt, networkingPdfQuiz, evidence.map((item: { id: string }) => item.id));
  const patterns = mergeErrorPatterns([], signals);
  const items = generateReviewItems([], patterns, 4);
  assert.equal(items.length, 1);
  assert.equal(reviewIsTraceable(items[0], patterns, evidence), true);
});

test("N. checksum duplicate detection distinguishes exact possible and new", () => {
  assert.equal(classifyInventoryDuplicate("A", ["A"], []), "EXACT_DUPLICATE");
  assert.equal(classifyInventoryDuplicate("B", [], ["B"]), "POSSIBLE_DUPLICATE");
  assert.equal(classifyInventoryDuplicate("C", ["A"], ["B"]), "NEW_SOURCE");
});

test("O. extractor registry is local-only and declares all five formats", () => {
  assert.deepEqual(Object.keys(academicExtractorRegistry).sort(), ["CSV", "DOCX", "MARKDOWN", "PDF", "TEXT"]);
  assert.ok((Object.values(academicExtractorRegistry) as Array<{ localOnly: boolean }>).every((descriptor) => descriptor.localOnly));
  assert.equal(extractorFor("PDF").capabilities.scannedPdf, "OCR_REQUIRED");
});

test("P. unsupported extension has no extractor assignment", () => {
  const { courseFormatFromFileName } = require("../../../src/modules/academic-workspace/core.ts");
  assert.equal(courseFormatFromFileName("malware.exe"), null);
});

test("Q. PDF ingestion implementation has no external network call", () => {
  const files = ["src/modules/academic-workspace/pdf-extractor.ts", "src/modules/academic-workspace/extractor-registry.ts"];
  const source = files.map((file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8")).join("\n");
  assert.doesNotMatch(source, /fetch\(|axios|https?:\/\//i);
});

test("R. original academic PDF remains ignored and untracked", () => {
  const relative = "cours esiea/Reseau Informatique/cours/CH01_Introduction_INF3050.pdf";
  assert.doesNotThrow(() => childProcess.execFileSync("git", ["check-ignore", relative], { cwd: process.cwd() }));
  assert.equal(childProcess.execFileSync("git", ["ls-files", relative], { cwd: process.cwd(), encoding: "utf8" }).trim(), "");
});

test("S. PDF quiz state survives a JSON refresh round trip", () => {
  const attempt = completedPdfAttempt();
  assert.deepEqual(JSON.parse(JSON.stringify(attempt)), attempt);
});

test("T. source return navigation points to the exact PDF route", () => {
  const evidence = fs.readFileSync(path.join(process.cwd(), "src/components/learning-records/LearningRecordPanels.tsx"), "utf8");
  const sourcePage = fs.readFileSync(path.join(process.cwd(), "src/components/academic-workspace/PdfSourceWorkspace.tsx"), "utf8");
  assert.match(evidence, /subjects\/networking\/sources\/ch01-introduction-inf3050/);
  assert.match(sourcePage, /originalPathOrReference/);
});
