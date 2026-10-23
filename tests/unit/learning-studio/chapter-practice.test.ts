import assert from "node:assert/strict";
import test from "node:test";
import { chapterCards, chapterSourceQuiz, cleanTerm, isCorrectChoice, readableSentence, subjectDocuments } from "../../../src/modules/learning-studio/chapter-practice.ts";
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

const projet = doc("file:projet.md", "Communication-gestion-projet", [
  "Chaque sprint dure au maximum trois semaines et se termine par une démonstration au client.",
  "Le backlog regroupe les fonctionnalités attendues, classées par valeur pour le client.",
  "[12:04.5 - 12:09.1] Le sprint commence lundi matin avec toute l’équipe réunie.",
  "Tableau Sprint Durée Livrable Objectif Valeur Semaine Repère Responsable Statut Sprint.",
  "Le programme est écrit dans un langage orienté objet très répandu aujourd’hui.",
].join("\n\n"));
const agile = { subject: "Gestion de projet", title: "Planification agile et sprints", concepts: [{ label: "sprint" }, { label: "backlog" }],
  related: ["AMDEC", "McCall", "cahier des charges", "objet"], context: "Le backlog est découpé en sprints courts ; chaque démonstration au client valide la valeur produite." };

test("sentence questions: blanked notion, quoted sentence, same-subject wrong answers", () => {
  const quiz = chapterSourceQuiz([projet], agile, 10);
  assert.equal(quiz.length, 2);
  for (const question of quiz) {
    assert.match(question.prompt, /_____/);
    assert.ok(!new RegExp(`\\b${question.answer}\\b`, "i").test(question.prompt), "the answer is hidden");
    assert.equal(question.choices.length, 4);
    assert.ok(question.citations[0].quote.includes(question.answer));
  }
});

test("timestamps, glued slide headings and duplicate sentences never become questions", () => {
  assert.equal(readableSentence("[12:04.5 - 12:09.1] Le sprint commence lundi matin avec toute l’équipe."), null);
  assert.equal(readableSentence("Tableau Sprint Durée Livrable Objectif Valeur Semaine Repère Responsable Statut Sprint."), null);
  assert.equal(readableSentence("CREATE TABLE Client (id NUMBER, nom VARCHAR2(50));"), null);
  assert.equal(readableSentence("• Chaque sprint dure trois semaines."), "Chaque sprint dure trois semaines.");
  const twice = doc("file:double.md", "Communication-gestion-projet", "Chaque sprint dure au maximum trois semaines et se termine par une démonstration au client.");
  assert.equal(chapterSourceQuiz([projet, twice], agile, 10).filter((question) => question.answer === "sprint").length, 1);
});

test("a common word is only asked in the chapter's sense", () => {
  const email = { subject: "Communication", title: "Rédaction des courriels professionnels", concepts: [{ label: "objet" }],
    related: ["sprint", "backlog", "AMDEC"], context: "L’objet du courriel résume la demande en quelques mots." };
  assert.deepEqual(chapterSourceQuiz([projet], email, 10), [], "« langage orienté objet » is another sense");
});
