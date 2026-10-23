import { deriveFlashcards, normalizeText, tokenize } from "./core";
import { conceptKey, remediationPath } from "./prerequisites";
import type { Flashcard, QuizQuestion, StudioDocument } from "./types";

/**
 * Cited multiple-choice questions for a programme chapter, built from the learner's
 * own course sources instead of the generated bank.
 *
 * The notions of the chapter are matched against definitions found in the sources;
 * each question quotes its definition with the page. Wrong answers are notions a
 * learner can really confuse with the right one (curated confusions, then the same
 * document and nearby pages), with a length close to the right answer so that the
 * longest option is not a giveaway. DERIVED_MATERIAL: practice, never mastery.
 */

export type ChapterNotions = Readonly<{ subject: string; title: string; concepts: readonly Readonly<{ label: string }>[] }>;

const MIN_LABEL_CHARS = 3;
const CHOICES = 4;

function phrase(value: string): string {
  return ` ${tokenize(value).join(" ")} `;
}

// Extracted "terms" often carry list bullets or start a clause ("Si le protocole A", "Ce système").
const LEADING_MARKS = /^(?:[^\p{L}\p{N}@]|Ø(?=\s))+/u;
const LEADING_ARTICLE = /^(?:(?:le|la|les|un|une|des|du)\s+|l[’']\s?)/i;
const CLAUSE_START = /^(?:si|donc|on|ce|cet|cette|ces|chaque|elle|elles|il|ils|cela|ça|tout|toute|tous|alors|mais)(?:\s|$)/i;
const CLAUSE_END = /(?:^|\s)(?:ne|n[’']|se|s[’']|qui|que|qu[’']|de|d[’']|à|en|y|et|ou)$/i;

export function cleanTerm(term: string): string | null {
  const stripped = term.replace(LEADING_MARKS, "").trim();
  if (CLAUSE_START.test(stripped) || CLAUSE_END.test(stripped)) return null;
  const cleaned = stripped.replace(LEADING_ARTICLE, "").trim();
  if (cleaned.replace(/[^\p{L}\p{N}]/gu, "").length < 2) return null;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function cleanCards(documents: readonly StudioDocument[]): Flashcard[] {
  return deriveFlashcards(documents).flatMap((card) => {
    const term = cleanTerm(card.term);
    return term ? [{ ...card, term }] : [];
  });
}

/** Documents of the chapter's subject (folder names sharing a word with it); all documents when none does. */
export function subjectDocuments(documents: readonly StudioDocument[], subject: string): readonly StudioDocument[] {
  const words = new Set(tokenize(subject));
  const matching = documents.filter((document) => tokenize(document.subjectLabel.replace(/[-_]+/g, " ")).some((word) => words.has(word)));
  return matching.length > 0 ? matching : documents;
}

/** A source notion belongs to the chapter when its term contains a chapter notion, or the reverse. */
export function chapterCards(documents: readonly StudioDocument[], chapter: ChapterNotions): Flashcard[] {
  const labels = chapter.concepts.map((concept) => concept.label).filter((label) => normalizeText(label).length >= MIN_LABEL_CHARS).map(phrase);
  if (labels.length === 0) return [];
  const seen = new Set<string>();
  return cleanCards(subjectDocuments(documents, chapter.subject)).filter((card) => {
    const term = phrase(card.term);
    const key = conceptKey(card.term);
    if (seen.has(key) || !labels.some((label) => term.includes(label) || label.includes(term))) return false;
    seen.add(key);
    return true;
  });
}

function stableIndex(value: string, modulo: number): number {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % modulo;
}

function distractorsFor(card: Flashcard, pool: readonly Flashcard[], inChapter: ReadonlySet<string>): string[] {
  const key = conceptKey(card.term);
  const confused = new Set(remediationPath(card.term, pool, []).confusedWith.map(conceptKey));
  const page = card.citations[0]?.pageNumber ?? 0;
  const answer = phrase(card.term);
  const candidates = new Map<string, { term: string; score: number }>();
  for (const other of pool) {
    const otherKey = conceptKey(other.term);
    const term = phrase(other.term);
    // A wrong answer that contains the right one (or the reverse) would be ambiguous.
    if (otherKey === key || term.includes(answer) || answer.includes(term)) continue;
    const sameDocument = other.documentId === card.documentId;
    const score = (confused.has(otherKey) ? 8 : 0) + (inChapter.has(otherKey) ? 4 : 0) + (sameDocument ? 2 : 0)
      + (sameDocument && Math.abs((other.citations[0]?.pageNumber ?? 0) - page) <= 3 ? 1 : 0)
      - Math.abs(other.term.length - card.term.length) / Math.max(other.term.length, card.term.length);
    if ((candidates.get(otherKey)?.score ?? -Infinity) < score) candidates.set(otherKey, { term: other.term, score });
  }
  return [...candidates.values()].sort((a, b) => b.score - a.score || a.term.localeCompare(b.term)).slice(0, CHOICES - 1).map((item) => item.term);
}

export function chapterSourceQuiz(documents: readonly StudioDocument[], chapter: ChapterNotions, count = 5): QuizQuestion[] {
  const cards = chapterCards(documents, chapter);
  const pool = cleanCards(subjectDocuments(documents, chapter.subject));
  const inChapter = new Set(cards.map((card) => conceptKey(card.term)));
  return cards.slice(0, count).flatMap((card) => {
    const distractors = distractorsFor(card, pool, inChapter);
    if (distractors.length < CHOICES - 1) return [];
    const position = stableIndex(card.id, CHOICES);
    const choices = [...distractors];
    choices.splice(position, 0, card.term);
    return [{
      id: `quiz:${card.id}`, cardId: card.id, answer: card.term, choices,
      prompt: `Quelle notion correspond à cette définition du cours : « … ${card.definition}. » ?`,
      materialKind: "DERIVED_MATERIAL" as const, canonical: false as const, citations: card.citations,
    }];
  });
}

/** Accepts the option letter (A–D), its number (1–4) or the option text. */
export function isCorrectChoice(question: QuizQuestion, answer: string): boolean {
  const value = answer.trim();
  const letter = /^[A-Da-d]$/.test(value) ? value.toUpperCase().charCodeAt(0) - 65 : /^[1-4]$/.test(value) ? Number(value) - 1 : -1;
  const chosen = letter >= 0 ? question.choices[letter] : question.choices.find((choice) => normalizeText(choice) === normalizeText(value));
  return chosen === question.answer;
}
