import assert from "node:assert/strict";
import test from "node:test";
import { deriveFlashcards, verifyCitation } from "../../../src/modules/learning-studio/core.ts";
import { SYNTHETIC_DOCUMENTS } from "../../../src/modules/learning-studio/fixtures.ts";
import { conceptKey, derivePrerequisites, remediationPath } from "../../../src/modules/learning-studio/prerequisites.ts";
import { prerequisitePath } from "../../../src/modules/scientific-pedagogy/core.ts";
import type { Flashcard } from "../../../src/modules/learning-studio/types.ts";

const cards = deriveFlashcards(SYNTHETIC_DOCUMENTS);

function card(term: string, definition: string): Flashcard {
  return { id: `x:${term}`, term, definition, documentId: "x", materialKind: "DERIVED_MATERIAL", canonical: false,
    citations: [{ documentId: "x", pageNumber: 1, passageId: "p", quote: `${term} ${definition}` }] };
}

test("a notion mentioned in another notion's definition becomes its prerequisite, with the quote as provenance", () => {
  const relations = derivePrerequisites(cards);
  assert.deepEqual(relations.map((relation) => `${relation.from}>${relation.to}`), ["CLE_PRIMAIRE>CLE_ETRANGERE", "CLE_ETRANGERE>INTEGRITE_REFERENTIELLE"]);
  assert.ok(relations.every((relation) => relation.citation && verifyCitation(SYNTHETIC_DOCUMENTS, relation.citation)));
  assert.ok(relations.every((relation) => relation.provenance.startsWith("Définition citée")));
});

test("the remediation path lists the deepest prerequisite first, through the SCI-006 traversal", () => {
  const path = remediationPath("intégrité référentielle", cards, derivePrerequisites(cards));
  assert.deepEqual(path.prerequisites.map((step) => step.term), ["clé primaire", "clé étrangère"]);
  assert.ok(path.prerequisites.every((step) => step.card));
  assert.equal(path.canonical, false);
});

test("curated SCI-006 confusions are reused when the course contains both notions", () => {
  assert.deepEqual(remediationPath("TCP", cards, derivePrerequisites(cards)).confusedWith, ["UDP"]);
  assert.deepEqual(remediationPath("UDP", cards, derivePrerequisites(cards)).confusedWith, ["TCP"]);
});

test("mutual mentions never create a cycle and the traversal never throws", () => {
  const loop = [card("serveur", "est une machine qui répond à un client"), card("client", "est une machine qui interroge un serveur")];
  const relations = derivePrerequisites(loop);
  assert.equal(relations.length, 1);
  assert.doesNotThrow(() => loop.forEach((item) => prerequisitePath(conceptKey(item.term), relations)));
});

test("a term is not its own prerequisite and partial words do not match", () => {
  const items = [card("port", "identifie une application"), card("portail", "est une page d’accueil"), card("passerelle", "est un routeur relié au portail")];
  const relations = derivePrerequisites(items);
  assert.deepEqual(relations.map((relation) => `${relation.from}>${relation.to}`), ["PORTAIL>PASSERELLE"]);
});

test("concept keys ignore accents, case and punctuation", () => {
  assert.equal(conceptKey("Clé étrangère"), "CLE_ETRANGERE");
  assert.equal(conceptKey("contrainte NOT NULL"), "CONTRAINTE_NOT_NULL");
});
