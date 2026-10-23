import assert from "node:assert/strict";
import test from "node:test";
import { chapterCards, chapterSourceQuiz, cleanTerm, isCorrectChoice, subjectDocuments } from "../../../src/modules/learning-studio/chapter-practice.ts";
import { buildImportedDocument, textToSections } from "../../../src/modules/learning-studio/import.ts";

// Synthetic course files (no real course content).
function doc(id: string, subject: string, text: string) {
  return buildImportedDocument(id, { title: id, subjectLabel: subject, chapter: "", docType: "COURS" }, textToSections(text), "section", new Date(0));
}

const reseaux = doc("file:reseaux.md", "Reseaux", [
  "• Le masque de sous-réseau est la valeur qui sépare la partie réseau de la partie hôte.",
  "Une adresse IPv4 est un identifiant de 32 bits attribué à une interface.",
  "La passerelle désigne le routeur qui relie le réseau local aux autres réseaux.",
  "Le commutateur est un équipement qui relie les machines d'un même réseau local.",
  "Le routeur est un équipement qui achemine les paquets entre plusieurs réseaux.",
  "Si le paquet est trop grand alors il est fragmenté en plusieurs morceaux.",
].join("\n\n"));
const communication = doc("file:com.md", "Communication-gestion-projet", "Le masque de saisie est un gabarit qui contrôle les caractères tapés dans un formulaire.");
const chapter = { subject: "Architecture des réseaux", title: "IPv4 et masques", concepts: [{ label: "IPv4" }, { label: "masque" }] };

test("extracted terms lose bullets and articles; clause fragments are rejected", () => {
  assert.equal(cleanTerm("• Le masque de sous-réseau"), "Masque de sous-réseau");
  assert.equal(cleanTerm("→ L'encapsulation"), "Encapsulation");
  assert.equal(cleanTerm("Si le paquet"), null);
  assert.equal(cleanTerm("IP ne"), null);
});

test("a chapter only uses the course files of its own subject", () => {
  assert.deepEqual(subjectDocuments([reseaux, communication], chapter.subject).map((document) => document.id), ["file:reseaux.md"]);
  assert.deepEqual(chapterCards([reseaux, communication], chapter).map((card) => card.term), ["Masque de sous-réseau", "Adresse IPv4"]);
  assert.equal(subjectDocuments([communication], "Matière inconnue").length, 1, "falls back to every document");
});

test("cited questions: same-subject wrong answers, no ambiguous option, gradable by letter or text", () => {
  const quiz = chapterSourceQuiz([reseaux, communication], chapter);
  assert.equal(quiz.length, 2);
  for (const question of quiz) {
    assert.equal(question.choices.length, 4);
    assert.equal(new Set(question.choices).size, 4);
    assert.ok(question.choices.includes(question.answer));
    assert.ok(!question.choices.some((choice) => /saisie/.test(choice)), "no notion from another subject");
    assert.ok(question.citations[0].quote.length > 0);
    assert.equal(question.materialKind, "DERIVED_MATERIAL");
    const letter = String.fromCharCode(65 + question.choices.indexOf(question.answer));
    assert.equal(isCorrectChoice(question, letter), true);
    assert.equal(isCorrectChoice(question, question.answer.toLowerCase()), true);
    assert.equal(isCorrectChoice(question, question.choices.find((choice) => choice !== question.answer)!), false);
  }
});
