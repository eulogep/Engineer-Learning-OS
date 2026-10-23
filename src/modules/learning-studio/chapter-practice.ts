import { allPassages, citationFor, deriveFlashcards, normalizeText, splitSentences, tokenize } from "./core";
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

export type ChapterNotions = Readonly<{
  subject: string;
  title: string;
  concepts: readonly Readonly<{ label: string }>[];
  /** Notions of the other chapters of the same subject: wrong answers for sentence questions. */
  related?: readonly string[];
  /** Chapter text (summary, example…) used to keep common-word notions in their sense. */
  context?: string;
}>;

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

// --- Sentence questions: a course sentence with the notion blanked out ------------------------
// Slides rarely say "X est…"; they still use the notion in context. The learner finds which
// notion of the subject completes the quoted sentence.

const BLANK = "_____";
const SENTENCE_CHARS = { min: 50, max: 240 };
const MIN_WORDS = 7;
const SENTENCES_PER_NOTION = 3;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Whole-word, case-insensitive: "for" never matches "format". */
function wordPattern(label: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(label)}(?![\\p{L}\\p{N}])`, "giu");
}

const TIMESTAMP = /\[\d{1,2}:\d{2}/;
const PRIVATE_GLYPHS = /[\uE000-\uF8FF]/;
const LEADING_NOISE = /^(?:[^\p{L}\p{N}_]+|\d+[.)]?\s+)+/u;

/** A real sentence: no transcript timestamp, table row, code line or slide heading. */
export function readableSentence(sentence: string): string | null {
  const text = sentence.replace(LEADING_NOISE, "").trim();
  if (TIMESTAMP.test(sentence) || PRIVATE_GLYPHS.test(sentence) || !/[.!]$/.test(text) || !/^[\p{Lu}_]/u.test(text)) return null;
  if ((text.match(/[;(){}=<>]/g) ?? []).length >= 2 || (text.match(/[/·|]/g) ?? []).length >= 2) return null;
  if ((text.match(/\d/g) ?? []).length / text.length > 0.08) return null;
  // Slide headings glued together read as one long title-cased "sentence".
  const words = text.split(/\s+/).slice(1);
  if (words.filter((word) => /^\p{Lu}/u.test(word)).length / Math.max(1, words.length) > 0.25) return null;
  return text;
}

/** A single lowercase word ("objet", "revue") has several senses; acronyms and multi-word terms do not. */
function commonWord(label: string): boolean {
  return !/\s/.test(label.trim()) && label === label.toLowerCase();
}

function clozeQuestions(documents: readonly StudioDocument[], chapter: ChapterNotions): QuizQuestion[] {
  const labels = chapter.concepts.map((concept) => concept.label.trim()).filter((label) => normalizeText(label).length >= MIN_LABEL_CHARS);
  const pool = [...new Set([...(chapter.related ?? []), ...labels].map((label) => label.trim()).filter((label) => normalizeText(label).length >= MIN_LABEL_CHARS))];
  const passages = allPassages(subjectDocuments(documents, chapter.subject));
  const questions: QuizQuestion[] = [];
  const asked = new Set<string>();
  const context = new Set(tokenize(`${chapter.title} ${chapter.context ?? ""}`));
  for (const label of labels) {
    const pattern = wordPattern(label);
    const own = new Set(tokenize(label));
    const inSense = (sentence: string) => !commonWord(label) || tokenize(sentence).some((token) => !own.has(token) && context.has(token));
    let found = 0;
    for (const { document, page, passage } of passages) {
      if (found >= SENTENCES_PER_NOTION) break;
      for (const raw of splitSentences(passage.text)) {
        if (found >= SENTENCES_PER_NOTION) break;
        const sentence = readableSentence(raw);
        if (!sentence || !inSense(sentence) || asked.has(normalizeText(sentence))) continue;
        if (sentence.length < SENTENCE_CHARS.min || sentence.length > SENTENCE_CHARS.max || sentence.includes("?")) continue;
        if (sentence.split(/\s+/).length < MIN_WORDS || (sentence.match(pattern) ?? []).length !== 1) continue;
        const answer = phrase(label);
        const distractors = pool
          .filter((other) => { const term = phrase(other); return !term.includes(answer) && !answer.includes(term) && !wordPattern(other).test(sentence); })
          .sort((a, b) => Math.abs(a.length - label.length) - Math.abs(b.length - label.length) || a.localeCompare(b))
          .slice(0, CHOICES - 1);
        if (distractors.length < CHOICES - 1) continue;
        const id = `cloze:${document.id}:${page.pageNumber}:${passage.id}:${conceptKey(label)}`;
        const choices = [...distractors];
        choices.splice(stableIndex(id, CHOICES), 0, label);
        questions.push({
          id: `quiz:${id}`, cardId: id, answer: label, choices,
          prompt: `Quelle notion complète cette phrase du cours : « ${sentence.replace(pattern, BLANK)} » ?`,
          materialKind: "DERIVED_MATERIAL", canonical: false, citations: [citationFor(document, page.pageNumber, passage.id, sentence)],
        });
        asked.add(normalizeText(sentence));
        found += 1;
      }
    }
  }
  return questions;
}

/** Definition questions first; sentence questions cover chapters whose sources define nothing. */
export function chapterSourceQuiz(documents: readonly StudioDocument[], chapter: ChapterNotions, count = 5): QuizQuestion[] {
  const definitions = definitionQuestions(documents, chapter);
  const covered = (label: string) => definitions.some((question) => phrase(question.answer).includes(phrase(label)));
  const sentences = clozeQuestions(documents, chapter).filter((question) => !covered(question.answer));
  return [...definitions, ...sentences].slice(0, count);
}

function definitionQuestions(documents: readonly StudioDocument[], chapter: ChapterNotions, count = Infinity): QuizQuestion[] {
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
