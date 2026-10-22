import { prerequisitePath, relatedConcepts, validateConceptRelations } from "../scientific-pedagogy/core";
import { ELOS_CONCEPT_RELATIONS } from "../scientific-pedagogy/decisions";
import type { ConceptRelation } from "../scientific-pedagogy/types";
import { normalizeText, tokenize } from "./core";
import type { Flashcard, StudioCitation } from "./types";

/**
 * Prerequisite map for the Studio (SCI-006 adapted to imported courses).
 *
 * A notion whose definition mentions another notion of the same sources depends on
 * it: "une clé étrangère fait référence à la clé primaire" makes "clé primaire" a
 * prerequisite of "clé étrangère". Each relation keeps the quoted sentence as
 * provenance. Confusions come from the curated ELOS relations. Relations are
 * DERIVED: they explain a remediation path, they do not prove a learning
 * dependency (SCI-006 limitation) and never change a competency state.
 */

export type StudioRelation = ConceptRelation & Readonly<{ citation: StudioCitation | null }>;

export function conceptKey(term: string): string {
  return normalizeText(term).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").toUpperCase();
}

function mentions(definition: string, term: string): boolean {
  const termTokens = tokenize(term);
  if (termTokens.length === 0) return false;
  const tokens = tokenize(definition);
  return tokens.some((_, index) => termTokens.every((token, offset) => tokens[index + offset] === token));
}

function reaches(edges: ReadonlyMap<string, readonly string[]>, from: string, to: string): boolean {
  const stack = [from];
  const seen = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current === to) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(edges.get(current) ?? []));
  }
  return false;
}

/** Deterministic, acyclic: an edge that would close a cycle is skipped (the first, by card order, wins). */
export function derivePrerequisites(cards: readonly Flashcard[]): StudioRelation[] {
  const unique = cards.filter((card, index) => cards.findIndex((other) => conceptKey(other.term) === conceptKey(card.term)) === index);
  const edges = new Map<string, string[]>();
  const relations: StudioRelation[] = [];
  for (const dependent of unique) {
    for (const prerequisite of unique) {
      const from = conceptKey(prerequisite.term);
      const to = conceptKey(dependent.term);
      if (from === to || !mentions(dependent.definition, prerequisite.term)) continue;
      // Skip "TCP" inside "TCP/IP"-like overlaps where one term contains the other.
      if (tokenize(dependent.term).join(" ").includes(tokenize(prerequisite.term).join(" "))) continue;
      if (reaches(edges, to, from)) continue;
      edges.set(from, [...(edges.get(from) ?? []), to]);
      relations.push({ from, to, type: "PREREQUISITE_OF", provenance: `Définition citée : ${dependent.citations[0].quote}`, citation: dependent.citations[0] });
    }
  }
  validateConceptRelations(relations);
  return relations;
}

export type PrerequisiteStep = Readonly<{ term: string; card: Flashcard | null }>;
export type RemediationPath = Readonly<{
  term: string;
  /** Prerequisites to review first, deepest first. */
  prerequisites: readonly PrerequisiteStep[];
  confusedWith: readonly string[];
  materialKind: "DERIVED_MATERIAL";
  canonical: false;
}>;

export function remediationPath(term: string, cards: readonly Flashcard[], relations: readonly StudioRelation[]): RemediationPath {
  const byKey = new Map(cards.map((card) => [conceptKey(card.term), card]));
  const key = conceptKey(term);
  const prerequisites = prerequisitePath(key, relations).map((id) => ({ term: byKey.get(id)?.term ?? id, card: byKey.get(id) ?? null }));
  const curated = validateConceptRelations(ELOS_CONCEPT_RELATIONS);
  const confusedWith = relatedConcepts(key, "CONFUSED_WITH", curated)
    .map((id) => byKey.get(id)?.term ?? null)
    .filter((value): value is string => value !== null);
  return { term, prerequisites, confusedWith, materialKind: "DERIVED_MATERIAL", canonical: false };
}
