import assert from "node:assert/strict";
import test from "node:test";
import { answerFromSources, citationLabel, deriveFlashcards, verifyCitation } from "../../../src/modules/learning-studio/core.ts";
import { buildMockExam, gradeMockExam, SECONDS_PER_QUESTION } from "../../../src/modules/learning-studio/exam.ts";
import { SYNTHETIC_DOCUMENTS as DOCS } from "../../../src/modules/learning-studio/fixtures.ts";
import {
  ImportError, buildImportedDocument, cleanExtractedText, importFormat, splitPassages, textToSections, titleFromFileName,
} from "../../../src/modules/learning-studio/import.ts";

const META = { title: "Cours Linux", subjectLabel: "Administration système", chapter: "Chapitre 3", docType: "COURS" as const };
const NOW = new Date("2026-10-22T10:00:00Z");

test("supported formats and readable titles", () => {
  assert.equal(importFormat("cours.PDF"), "PDF");
  assert.equal(importFormat("notes.md"), "MARKDOWN");
  assert.equal(importFormat("td.txt"), "TEXT");
  assert.equal(importFormat("slides.pptx"), null);
  assert.equal(titleFromFileName("td_2-adressage_ipv4.pdf"), "Td 2 adressage ipv4");
});

test("PDF text is cleaned: hyphenation across lines and broken lines are joined", () => {
  assert.equal(cleanExtractedText("Le système de fi-\nchiers organise les\ndonnées.\n\n\n\nSuite."), "Le système de fichiers organise les données.\n\nSuite.");
});

test("pdf.js ligature fragments are repaired", () => {
  const raw = "La commande chmod sert à modi fi er les permissions d'un   fi chier. Le \nfi chier /etc/passwd est une con fi guration. Un ﬁchier su ffi t.";
  assert.equal(cleanExtractedText(raw), "La commande chmod sert à modifier les permissions d'un fichier. Le fichier /etc/passwd est une configuration. Un fichier suffit.");
  // Ordinary words are untouched.
  assert.equal(cleanExtractedText("Le fil du réseau et la file d’attente."), "Le fil du réseau et la file d’attente.");
});

test("long paragraphs become short citable passages cut at sentence boundaries", () => {
  const sentence = "La commande chmod modifie les permissions d’un fichier pour le propriétaire, le groupe et les autres utilisateurs. ";
  const passages = splitPassages(sentence.repeat(10));
  assert.ok(passages.length >= 2);
  assert.ok(passages.every((passage) => passage.length <= 520 && /\.$/.test(passage)));
});

test("Markdown is split into numbered sections at headings", () => {
  const sections = textToSections("# Permissions\nLa commande chmod modifie les permissions.\n\n## Utilisateurs\nLa commande useradd crée un utilisateur.");
  assert.equal(sections.length, 2);
  assert.deepEqual(sections.map((section) => section.pageNumber), [1, 2]);
});

test("an imported document is personal, citable and usable by the tutor and the tools", () => {
  const document = buildImportedDocument("perso-1", META, [
    { pageNumber: 1, text: "Linux est un système d’exploitation libre. La commande chmod sert à modifier les permissions d’un fichier." },
    { pageNumber: 2, text: "Le fichier /etc/passwd contient la liste des comptes utilisateurs.\n\nUn service est un programme qui tourne en arrière-plan." },
  ], "page", NOW);
  assert.equal(document.classification, "PERSONAL");
  assert.equal(document.synthetic, false);
  assert.equal(document.subjectId, "perso-administration-système");
  const answer = answerFromSources([document], "À quoi sert la commande chmod ?");
  assert.match(answer.answer, /chmod sert à modifier les permissions/);
  assert.ok(answer.studioCitations.every((citation) => verifyCitation([document], citation)));
  assert.equal(citationLabel([document], answer.studioCitations[0]), "Cours Linux, p. 1");
  assert.ok(deriveFlashcards([document]).some((card) => card.term === "commande chmod"));
});

test("text files cite sections, not pages", () => {
  const document = buildImportedDocument("perso-2", META, textToSections("Un service est un programme qui tourne en arrière-plan."), "section", NOW);
  const answer = answerFromSources([document], "Qu'est-ce qu'un service ?");
  assert.equal(citationLabel([document], answer.studioCitations[0]), "Cours Linux, section 1");
});

test("scanned or empty files are refused instead of inventing text", () => {
  assert.throws(() => buildImportedDocument("x", META, [{ pageNumber: 1, text: "   " }], "page", NOW), (error) => error instanceof ImportError && /OCR/.test(error.message));
  assert.throws(() => buildImportedDocument("x", META, Array.from({ length: 401 }, (_, i) => ({ pageNumber: i + 1, text: "a" })), "page", NOW), ImportError);
});

test("mock exam interleaves documents, is reproducible and timed", () => {
  const exam = buildMockExam(DOCS, 9, 42, NOW);
  assert.equal(exam.questions.length, 9);
  assert.equal(exam.durationSeconds, 9 * SECONDS_PER_QUESTION);
  const sources = exam.questions.map((question) => question.citations[0].documentId);
  assert.ok(sources.slice(0, 3).every((id, index, all) => all.indexOf(id) === index), "first round takes one question per document");
  assert.deepEqual(buildMockExam(DOCS, 9, 42, NOW).questions.map((q) => q.id), exam.questions.map((q) => q.id));
  assert.notDeepEqual(buildMockExam(DOCS, 9, 7, NOW).questions.map((q) => q.id), exam.questions.map((q) => q.id));
  for (const question of exam.questions) assert.ok(question.choices.includes(question.answer));
});

test("mock exam grading reports score, calibration and overconfidence, never mastery", () => {
  const exam = buildMockExam(DOCS, 4, 1, NOW);
  const [q1, q2, q3] = exam.questions;
  const wrong = q2.choices.find((choice) => choice !== q2.answer) as string;
  const result = gradeMockExam(exam, { [q1.id]: q1.answer, [q2.id]: wrong, [q3.id]: q3.answer }, { [q1.id]: "SURE", [q2.id]: "SURE", [q3.id]: "UNSURE" },
    NOW, new Date(NOW.getTime() + 90_000));
  assert.equal(result.score, 2);
  assert.equal(result.unanswered, 1);
  assert.equal(result.timedOut, false);
  assert.deepEqual(result.overconfident, [q2.answer]);
  assert.deepEqual(result.calibration.find((row) => row.confidence === "SURE"), { confidence: "SURE", correct: 1, total: 2 });
  assert.equal(result.attempt.canonical, false);
  assert.equal(result.attempt.evidenceKind, "DERIVED_PRACTICE");
  assert.equal(result.attempt.assisted, false);
  assert.equal(result.attempt.mode, "MOCK_EXAM");
  assert.equal(gradeMockExam(exam, {}, {}, NOW, new Date(NOW.getTime() + 10 * 60_000)).timedOut, true);
});

test("LaTeX spacing accents are recomposed", () => {
  assert.equal(cleanExtractedText("La condition de jointure est exprim ́ ee dans la clause WHERE."), "La condition de jointure est exprimée dans la clause WHERE.");
  assert.equal(cleanExtractedText("donn ́ ees, syst ` eme, contr ˆ ole"), "données, système, contrôle");
  assert.equal(cleanExtractedText("café déjà vu"), "café déjà vu");
});
