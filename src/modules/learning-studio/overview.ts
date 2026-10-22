import { deriveFlashcards } from "./core";
import { conceptKey, derivePrerequisites, remediationPath } from "./prerequisites";
import type { StudioCitation, StudioDocument } from "./types";

/**
 * Audio overview built only from the selected sources (no generative model):
 * what the sources cover, the key notions with their definitions, how notions
 * depend on each other, common confusions, then retrieval questions with a
 * pause before each answer. Every spoken definition keeps its citation.
 */

export type OverviewSegment = Readonly<{
  kind: "INTRO" | "NOTION" | "LINK" | "CONFUSION" | "QUESTION" | "ANSWER" | "OUTRO";
  text: string;
  citation?: StudioCitation;
  /** Silence after this segment, in milliseconds (thinking time before an answer). */
  pauseAfterMs: number;
}>;

export type AudioOverview = Readonly<{ segments: readonly OverviewSegment[]; materialKind: "DERIVED_MATERIAL"; canonical: false }>;

const MAX_NOTIONS = 12;
const MAX_QUESTIONS = 3;
export const THINKING_PAUSE_MS = 4000;

function list(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} et ${items[items.length - 1]}`;
}

export function buildAudioOverview(documents: readonly StudioDocument[]): AudioOverview {
  const cards = deriveFlashcards(documents).slice(0, MAX_NOTIONS);
  const segments: OverviewSegment[] = [];
  if (documents.length === 0 || cards.length === 0) {
    return { segments: [{ kind: "INTRO", text: "Les sources sélectionnées ne contiennent pas encore de définitions exploitables pour un résumé audio.", pauseAfterMs: 0 }], materialKind: "DERIVED_MATERIAL", canonical: false };
  }
  const subjects = [...new Set(documents.map((document) => document.subjectLabel))];
  segments.push({ kind: "INTRO", pauseAfterMs: 600,
    text: `Résumé audio de ${documents.length} source${documents.length > 1 ? "s" : ""} en ${list(subjects)} : ${list(documents.map((document) => document.title))}. ${cards.length} notions clés.` });
  for (const card of cards) segments.push({ kind: "NOTION", text: `${card.term} : ${card.definition}.`, citation: card.citations[0], pauseAfterMs: 500 });

  const relations = derivePrerequisites(cards);
  for (const relation of relations.slice(0, 4)) {
    const from = cards.find((card) => conceptKey(card.term) === relation.from);
    const to = cards.find((card) => conceptKey(card.term) === relation.to);
    if (from && to) segments.push({ kind: "LINK", text: `Pour comprendre ${to.term}, il faut d’abord maîtriser ${from.term}.`, citation: relation.citation ?? undefined, pauseAfterMs: 500 });
  }
  const confusions = new Set<string>();
  for (const card of cards) {
    for (const other of remediationPath(card.term, cards, relations).confusedWith) {
      const key = [card.term, other].sort().join("|");
      if (confusions.has(key)) continue;
      confusions.add(key);
      segments.push({ kind: "CONFUSION", text: `Attention à ne pas confondre ${card.term} et ${other}.`, pauseAfterMs: 500 });
    }
  }
  segments.push({ kind: "QUESTION", text: "Pour finir, teste-toi. Réponds dans ta tête avant la réponse.", pauseAfterMs: 400 });
  cards.slice(0, MAX_QUESTIONS).forEach((card, index) => {
    segments.push({ kind: "QUESTION", text: `Question ${index + 1} : que désigne ${card.term} ?`, pauseAfterMs: THINKING_PAUSE_MS });
    segments.push({ kind: "ANSWER", text: `Réponse : ${card.term} ${card.definition}.`, citation: card.citations[0], pauseAfterMs: 700 });
  });
  segments.push({ kind: "OUTRO", text: "Fin du résumé. Les définitions citées sont dans la fiche, avec leur page.", pauseAfterMs: 0 });
  return { segments, materialKind: "DERIVED_MATERIAL", canonical: false };
}
