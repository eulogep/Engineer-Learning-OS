import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { askCourseAnswerIsGrounded } from "../../../src/modules/academic-workspace/core.ts";
import {
  STUDIO_CREATES_CANONICAL_EVIDENCE, STUDIO_STATE_KEY, answerFromSources, deriveFlashcards, deriveQuiz, difficulties,
  feynmanFeedback, gradeQuiz, mindMap, readStudioState, reviewCard, revisionPlan, revisionSheet, searchPassages,
  socraticPrompt, tokenize, verifyCitation, writeStudioState,
} from "../../../src/modules/learning-studio/core.ts";
import { SYNTHETIC_DOCUMENTS as DOCS } from "../../../src/modules/learning-studio/fixtures.ts";

const ids = (answer: { citations: readonly { sourceId: string; sectionId: string }[] }) => ({
  sources: answer.citations.map((citation) => citation.sourceId),
  sections: answer.citations.map((citation) => citation.sectionId),
});

test("fixtures are synthetic and public", () => {
  assert.ok(DOCS.length >= 3);
  assert.ok(DOCS.every((document) => document.synthetic && document.classification === "PUBLIC"));
});

test("search finds the passage that answers the question, with its page", () => {
  const [hit] = searchPassages(DOCS, "À quoi sert le masque de sous-réseau ?");
  assert.equal(hit.document.id, "syn-reseaux-td2-ipv4");
  assert.equal(hit.page.pageNumber, 1);
  assert.deepEqual(searchPassages(DOCS, ""), []);
});

test("answers quote the sources verbatim and pass the existing grounding check", () => {
  for (const question of ["Qu'est-ce que l'encapsulation ?", "Quelle est la différence entre TCP et UDP ?", "Que garantit l'intégrité référentielle ?"]) {
    const answer = answerFromSources(DOCS, question);
    assert.ok(answer.studioCitations.length > 0, question);
    assert.ok(answer.studioCitations.every((citation) => verifyCitation(DOCS, citation)), question);
    assert.ok(answer.claims.every((claim) => claim.basis === "SOURCE" && answer.answer.includes(claim.text)));
    const { sources, sections } = ids(answer);
    assert.equal(askCourseAnswerIsGrounded(answer, sources, sections), true);
  }
});

test("the tutor refuses to answer outside the selected sources", () => {
  const answer = answerFromSources(DOCS, "Comment cuisiner une pizza napolitaine ?");
  assert.equal(answer.citations.length, 0);
  assert.ok(answer.uncertainty);
  assert.equal(askCourseAnswerIsGrounded(answer, [], []), false);
  // Restricting the selection restricts the answer.
  const onlyDatabases = DOCS.filter((document) => document.subjectId === "bdd");
  assert.equal(answerFromSources(onlyDatabases, "Qu'est-ce que l'encapsulation ?").citations.length, 0);
});

test("a citation is rejected when its quote is not in the cited passage", () => {
  const good = answerFromSources(DOCS, "Qu'est-ce que l'encapsulation ?").studioCitations[0];
  assert.equal(verifyCitation(DOCS, good), true);
  assert.equal(verifyCitation(DOCS, { ...good, quote: "Une phrase inventée." }), false);
  assert.equal(verifyCitation(DOCS, { ...good, pageNumber: 99 }), false);
  assert.equal(verifyCitation(DOCS, { ...good, quote: " " }), false);
});

test("socratic mode asks first, then gives graduated hints ending with the source", () => {
  const prompt = socraticPrompt(DOCS, "À quoi sert le masque de sous-réseau ?");
  assert.ok(prompt);
  assert.match(prompt.question, /masque de sous-réseau/);
  assert.deepEqual(prompt.hints.map((hint) => hint.level), [1, 2, 3]);
  assert.ok(prompt.hints[2].text.length > prompt.hints[1].text.length);
  assert.equal(verifyCitation(DOCS, prompt.citations[0]), true);
  assert.equal(socraticPrompt(DOCS, "recette de pizza"), null);
});

test("every derived item is cited, verifiable and explicitly non-canonical", () => {
  const cards = deriveFlashcards(DOCS);
  const quiz = deriveQuiz(DOCS, 10);
  const sheet = revisionSheet(DOCS);
  assert.ok(cards.length >= 12);
  for (const item of [...cards, ...quiz, ...sheet]) {
    assert.equal(item.materialKind, "DERIVED_MATERIAL");
    assert.equal(item.canonical, false);
    assert.ok(item.citations.length > 0 && item.citations.every((citation) => verifyCitation(DOCS, citation)));
  }
  assert.equal(new Set(cards.map((card) => card.id)).size, cards.length);
});

test("quiz questions have one correct answer among unique choices", () => {
  for (const question of deriveQuiz(DOCS, 10)) {
    assert.equal(question.choices.filter((choice) => choice === question.answer).length, 1);
    assert.equal(new Set(question.choices).size, question.choices.length);
    assert.ok(question.choices.length >= 3);
    assert.ok(!question.prompt.includes(question.answer), "the prompt must not give the answer away");
  }
});

test("mind map follows the document pages and links terms to their citation", () => {
  const map = mindMap(DOCS[0]);
  assert.equal(map.children.length, DOCS[0].pages.length);
  const leaves = map.children.flatMap((page) => page.children);
  assert.ok(leaves.some((leaf) => leaf.label === "encapsulation"));
  assert.ok(leaves.every((leaf) => leaf.citation && verifyCitation(DOCS, leaf.citation)));
});

test("Feynman feedback reports covered and missing key ideas", () => {
  const passage = DOCS[0].pages[1].passages[0].text;
  const weak = feynmanFeedback(passage, "C'est quand on envoie des données.");
  const strong = feynmanFeedback(passage, "Chaque couche ajoute son en-tête aux données de la couche supérieure ; le destinataire fait la décapsulation en retirant les en-têtes.");
  assert.ok(strong.ratio > weak.ratio);
  assert.equal(strong.covered.length + strong.missing.length, 5);
});

test("Studio practice never becomes canonical evidence or mastery", () => {
  assert.equal(STUDIO_CREATES_CANONICAL_EVIDENCE, false);
  const quiz = deriveQuiz(DOCS, 3);
  const attempt = gradeQuiz(quiz, { [quiz[0].id]: quiz[0].answer }, new Date("2026-10-22T10:00:00Z"), false, "a1");
  assert.equal(attempt.canonical, false);
  assert.equal(attempt.evidenceKind, "DERIVED_PRACTICE");
  assert.deepEqual(attempt.items.map((item) => item.correct), [true, false, false]);
  // The module must not reach into canonical history or competency records.
  const dir = path.resolve("src/modules/learning-studio");
  for (const file of readdirSync(dir)) {
    const source = readFileSync(path.join(dir, file), "utf8");
    assert.doesNotMatch(source, /from\s+["'][^"']*(?:learning-history|learning-records|competency-map)/, file);
    assert.doesNotMatch(source, /\b(?:addEvidenceRecords|appendEvent|appendCanonical)\s*\(/, file);
  }
});

test("difficulty board ranks terms by errors", () => {
  const cards = deriveFlashcards(DOCS);
  const quiz = deriveQuiz(DOCS, 3);
  const attempts = [
    gradeQuiz(quiz, {}, new Date(), false, "a1"),
    gradeQuiz(quiz, { [quiz[1].id]: quiz[1].answer, [quiz[2].id]: quiz[2].answer }, new Date(), false, "a2"),
  ];
  const board = difficulties(attempts, cards);
  assert.equal(board[0].term, quiz[0].answer);
  assert.equal(board[0].errors, 2);
});

test("flashcard reviews feed a week-long revision plan", () => {
  const cards = deriveFlashcards(DOCS).slice(0, 3).map((card) => card.id);
  const reviews = { [cards[0]]: reviewCard(undefined, "SUCCESS", "2026-10-22") };
  const plan = revisionPlan(cards, reviews, "2026-10-22");
  assert.equal(plan.length, 7);
  assert.deepEqual(plan[0].due, cards.slice(1));
  assert.deepEqual(plan[1].due, [cards[0]]);
});

test("studio state survives reloads, ignores canonical-looking entries and corrupted storage", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const quiz = deriveQuiz(DOCS, 2);
  writeStudioState(storage, { version: 1, reviews: { x: { lastReviewedDay: "2026-10-22", nextReviewDay: "2026-10-23" } }, attempts: [gradeQuiz(quiz, {}, new Date(), true, "a")] });
  assert.equal(readStudioState(storage).attempts.length, 1);
  const tampered = JSON.parse(values.get(STUDIO_STATE_KEY) as string);
  tampered.attempts.push({ ...tampered.attempts[0], canonical: true });
  values.set(STUDIO_STATE_KEY, JSON.stringify(tampered));
  assert.equal(readStudioState(storage).attempts.length, 1);
  values.set(STUDIO_STATE_KEY, "{broken");
  assert.deepEqual(readStudioState(storage).attempts, []);
});

test("tokenizer ignores accents, case and French stop words", () => {
  assert.deepEqual(tokenize("À quoi sert le Masque de sous-réseau ?"), ["masque", "sous", "reseau"]);
});
