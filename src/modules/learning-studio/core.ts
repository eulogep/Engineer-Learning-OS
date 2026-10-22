import type { AskCourseAnswer } from "../academic-workspace/types";
import { addDays, applyReview, type DayKey, type ReviewOutcome, type ReviewState } from "../daily-english/spaced-review";
import type {
  FeynmanFeedback, Flashcard, MindMapNode, PassageHit, QuizQuestion, SheetEntry, SocraticPrompt,
  StudioCitation, StudioDocument, StudioQuizAttempt,
} from "./types";

/** Studio practice is never canonical evidence (see learning-records for mastery rules). */
export const STUDIO_CREATES_CANONICAL_EVIDENCE = false as const;

// ---------------------------------------------------------------------------
// Text processing (French course material)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set((
  "a au aux avec ce ces cet cette d de des du elle en est et il ils je l la le les leur lui ma mais me meme mes moi mon ne nos notre nous on ou par pas pour qu que qui sa se ses son sont sur ta te tes toi ton tu un une vos votre vous y "
  + "quoi quel quelle quels quelles comment pourquoi quand combien dans entre plus moins tres sert servent permet fait est-ce selon cours c ca"
).split(" "));

export function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, " ");
}

export function tokenize(text: string): string[] {
  return (normalizeText(text).match(/[a-z0-9/.]+/g) ?? [])
    .map((token) => token.replace(/^[./]+|[./]+$/g, ""))
    .filter((token) => token.length > 1 && !STOPWORDS.has(token))
    .map((token) => (token.length > 4 ? token.replace(/(?:s|x)$/, "") : token));
}

export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Library and retrieval (BM25 over passages)
// ---------------------------------------------------------------------------

export function allPassages(documents: readonly StudioDocument[]) {
  return documents.flatMap((document) => document.pages.flatMap((page) => page.passages.map((passage) => ({ document, page, passage }))));
}

export function citationFor(document: StudioDocument, pageNumber: number, passageId: string, quote: string): StudioCitation {
  return { documentId: document.id, pageNumber, passageId, quote, documentVersion: document.version,
    ...(document.provenance ? { sourceSha256: document.provenance.sha256 } : {}) };
}

export function citationLabel(documents: readonly StudioDocument[], citation: StudioCitation): string {
  const document = documents.find((item) => item.id === citation.documentId);
  if (!document) return "Source inconnue";
  return document.unit === "section" ? `${document.title}, section ${citation.pageNumber}` : `${document.title}, p. ${citation.pageNumber}`;
}

/** A citation is valid only if its quote appears verbatim in the cited passage. */
export function verifyCitation(documents: readonly StudioDocument[], citation: StudioCitation): boolean {
  const document = documents.find((item) => item.id === citation.documentId);
  if (!document || (citation.documentVersion !== undefined && citation.documentVersion !== document.version)
    || (citation.sourceSha256 !== undefined && citation.sourceSha256 !== document.provenance?.sha256)) return false;
  const passage = document.pages.find((page) => page.pageNumber === citation.pageNumber)
    ?.passages.find((item) => item.id === citation.passageId);
  return !!passage && citation.quote.trim().length > 0 && passage.text.includes(citation.quote.trim());
}

export function searchPassages(documents: readonly StudioDocument[], query: string, limit = 5): PassageHit[] {
  const terms = [...new Set(tokenize(query))];
  const entries = allPassages(documents).map((entry) => ({ ...entry, tokens: tokenize(entry.passage.text) }));
  if (terms.length === 0 || entries.length === 0) return [];
  const averageLength = entries.reduce((sum, entry) => sum + entry.tokens.length, 0) / entries.length;
  const k1 = 1.2, b = 0.75;
  const documentFrequency = new Map(terms.map((term) => [term, entries.filter((entry) => entry.tokens.includes(term)).length]));
  return entries
    .map((entry) => {
      const score = terms.reduce((sum, term) => {
        const frequency = entry.tokens.filter((token) => token === term).length;
        if (frequency === 0) return sum;
        const df = documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (entries.length - df + 0.5) / (df + 0.5));
        return sum + idf * (frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * entry.tokens.length / averageLength));
      }, 0);
      return { document: entry.document, page: entry.page, passage: entry.passage, score };
    })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Local tutor: extractive, source-only answers in the existing AskCourse contract
// ---------------------------------------------------------------------------

/**
 * Answerability does not use an absolute BM25 score (its IDF collapses on small
 * personal documents): the best passage must cover at least half of the
 * question's distinct terms. BM25 only ranks the candidates.
 */
const MIN_QUERY_COVERAGE = 0.5;

function queryCoverage(hit: PassageHit, query: string): number {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return 0;
  const tokens = new Set(tokenize(hit.passage.text));
  return terms.filter((term) => tokens.has(term)).length / terms.length;
}

function isAnswerable(hit: PassageHit | undefined, query: string): hit is PassageHit {
  return !!hit && queryCoverage(hit, query) >= MIN_QUERY_COVERAGE;
}

function bestSentences(hit: PassageHit, query: string, max = 2): string[] {
  const terms = new Set(tokenize(query));
  return splitSentences(hit.passage.text)
    .map((sentence, index) => ({ sentence, index, overlap: tokenize(sentence).filter((token) => terms.has(token)).length }))
    .filter((item) => item.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap || a.index - b.index)
    .slice(0, max)
    .sort((a, b) => a.index - b.index)
    .map((item) => item.sentence);
}

export type GroundedAnswer = AskCourseAnswer & Readonly<{ studioCitations: readonly StudioCitation[] }>;

/**
 * Answers only with sentences quoted from the selected sources. When nothing
 * relevant is found it says so instead of inventing an answer.
 */
export function answerFromSources(documents: readonly StudioDocument[], question: string): GroundedAnswer {
  const hits = searchPassages(documents, question, 4);
  const top = hits[0]?.score ?? 0;
  const relevant = isAnswerable(hits[0], question)
    ? hits.filter((hit) => hit.score >= top * 0.6 && queryCoverage(hit, question) >= MIN_QUERY_COVERAGE / 2).slice(0, 2)
    : [];
  const quoted = relevant.flatMap((hit) => bestSentences(hit, question).map((sentence) => ({ hit, sentence })));
  if (quoted.length === 0) {
    return { answer: "Je ne trouve pas cette information dans les sources sélectionnées.", citations: [], studioCitations: [],
      uncertainty: "Aucun passage suffisamment pertinent : reformulez ou sélectionnez d’autres documents.", claims: [] };
  }
  const studioCitations = quoted.map(({ hit, sentence }) => citationFor(hit.document, hit.page.pageNumber, hit.passage.id, sentence));
  return {
    answer: quoted.map(({ sentence }) => sentence).join(" "),
    citations: quoted.map(({ hit }) => ({ sourceId: hit.document.id, sectionId: `${hit.document.id}#${hit.passage.id}`, sourceReference: `${hit.document.title}, p. ${hit.page.pageNumber}` })),
    studioCitations,
    uncertainty: null,
    claims: quoted.map(({ sentence }) => ({ text: sentence, basis: "SOURCE" as const })),
  };
}

/** Socratic mode: a guiding question first, then graduated hints, the answer last. */
export function socraticPrompt(documents: readonly StudioDocument[], question: string): SocraticPrompt | null {
  const hit = searchPassages(documents, question, 1)[0];
  if (!isAnswerable(hit, question)) return null;
  const sentence = bestSentences(hit, question, 1)[0] ?? splitSentences(hit.passage.text)[0];
  const inPassage = deriveFlashcards([hit.document]).filter((item) => item.citations[0].passageId === hit.passage.id && item.citations[0].pageNumber === hit.page.pageNumber);
  const card = inPassage.find((item) => item.citations[0].quote === sentence) ?? inPassage[0];
  const quote = card?.citations[0].quote ?? sentence;
  return {
    question: card ? `Avant de lire la réponse : avec tes mots, à quoi correspond « ${card.term} » ?` : "Avant de lire la réponse : que sais-tu déjà sur ce point ?",
    hints: [
      { level: 1, text: `Regarde « ${hit.document.title} », page ${hit.page.pageNumber}.` },
      { level: 2, text: `${quote.split(/\s+/).slice(0, 6).join(" ")}…` },
      { level: 3, text: quote },
    ],
    materialKind: "DERIVED_MATERIAL", canonical: false,
    citations: [citationFor(hit.document, hit.page.pageNumber, hit.passage.id, quote)],
  };
}

/** Feynman check: which key ideas of the source passage the learner's own explanation covers. */
export function feynmanFeedback(passageText: string, explanation: string, keyTermCount = 5): FeynmanFeedback {
  const counts = new Map<string, number>();
  for (const token of tokenize(passageText)) if (token.length > 3) counts.set(token, (counts.get(token) ?? 0) + 1);
  const keyTerms = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).slice(0, keyTermCount).map(([term]) => term);
  const said = new Set(tokenize(explanation));
  const covered = keyTerms.filter((term) => said.has(term));
  return { covered, missing: keyTerms.filter((term) => !said.has(term)), ratio: keyTerms.length ? covered.length / keyTerms.length : 0 };
}

// ---------------------------------------------------------------------------
// Learning tools (all DERIVED, each item cited)
// ---------------------------------------------------------------------------

const DEFINING_VERBS = "est|désigne|sert à|assure|garantit|interdit|exprime|identifie|correspond à";
const DEFINITION = new RegExp(`^(?:(?:Le|La|Les|Un|Une)\\s+|L[’']\\s?)?(.+?)\\s+(${DEFINING_VERBS})\\s+(.{8,})$`);

function slug(text: string): string {
  return normalizeText(text).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Definition sentences ("X est …", "X sert à …") become cards; other sentences are ignored. */
export function deriveFlashcards(documents: readonly StudioDocument[]): Flashcard[] {
  const cards: Flashcard[] = [];
  for (const { document, page, passage } of allPassages(documents)) {
    for (const sentence of splitSentences(passage.text)) {
      const match = DEFINITION.exec(sentence);
      if (!match) continue;
      const term = match[1].trim();
      if (term.split(/\s+/).length > 5 || /[:,]/.test(term)) continue;
      const definition = `${match[2]} ${match[3]}`.replace(/\.$/, "");
      cards.push({
        id: `${document.id}:${slug(term)}`, term, definition, documentId: document.id,
        materialKind: "DERIVED_MATERIAL", canonical: false, citations: [citationFor(document, page.pageNumber, passage.id, sentence)],
      });
    }
  }
  return cards.filter((card, index) => cards.findIndex((other) => other.id === card.id) === index);
}

export function revisionSheet(documents: readonly StudioDocument[]): SheetEntry[] {
  return deriveFlashcards(documents).map(({ term, definition, citations }) => ({ term, definition, materialKind: "DERIVED_MATERIAL", canonical: false, citations }));
}

/** Multiple choice: "which notion matches this definition?", distractors from the same pool. */
export function deriveQuiz(documents: readonly StudioDocument[], count = 5): QuizQuestion[] {
  const cards = deriveFlashcards(documents);
  if (cards.length < 2) return [];
  return cards.slice(0, count).map((card, index) => {
    const distractors = cards.filter((other) => other.id !== card.id).map((other) => other.term)
      .filter((term, i, all) => all.indexOf(term) === i)
      .slice(index % Math.max(1, cards.length - 3), index % Math.max(1, cards.length - 3) + 3);
    const choices = [...distractors, card.term];
    const rotation = index % choices.length;
    return {
      id: `quiz:${card.id}`, cardId: card.id, answer: card.term,
      prompt: `Quelle notion complète la définition : « … ${card.definition}. » ?`,
      choices: [...choices.slice(rotation), ...choices.slice(0, rotation)],
      materialKind: "DERIVED_MATERIAL", canonical: false, citations: card.citations,
    };
  });
}

export function mindMap(document: StudioDocument): MindMapNode {
  const cards = deriveFlashcards([document]);
  return {
    label: document.title,
    children: document.pages.map((page) => ({
      label: `Page ${page.pageNumber}`,
      children: cards.filter((card) => card.citations[0].pageNumber === page.pageNumber)
        .map((card) => ({ label: card.term, children: [], citation: card.citations[0] })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Practice and revision planning (non-canonical)
// ---------------------------------------------------------------------------

export function gradeQuiz(questions: readonly QuizQuestion[], answers: Readonly<Record<string, string>>, at: Date, assisted: boolean, id: string): StudioQuizAttempt {
  return {
    id, at: at.toISOString(), evidenceKind: "DERIVED_PRACTICE", canonical: false, assisted,
    items: questions.map((question) => ({ questionId: question.id, cardId: question.cardId, correct: answers[question.id] === question.answer })),
  };
}

export function reviewCard(state: ReviewState | undefined, outcome: ReviewOutcome, today: DayKey): ReviewState {
  const next = applyReview(state ?? { lastReviewedDay: null, nextReviewDay: null }, outcome, today);
  return { lastReviewedDay: next.lastReviewedDay, nextReviewDay: next.nextReviewDay };
}

/** Cards due per day for the coming week; never-reviewed cards are due today. */
export function revisionPlan(cardIds: readonly string[], reviews: Readonly<Record<string, ReviewState>>, today: DayKey, days = 7): { day: DayKey; due: string[] }[] {
  return Array.from({ length: days }, (_, offset) => {
    const day = addDays(today, offset);
    const due = cardIds.filter((id) => {
      const next = reviews[id]?.nextReviewDay ?? today;
      return offset === 0 ? next <= day : next === day;
    });
    return { day, due };
  });
}

/** Difficulty board: terms ranked by errors across Studio attempts. */
export function difficulties(attempts: readonly StudioQuizAttempt[], cards: readonly Flashcard[]): { term: string; errors: number; attempts: number }[] {
  const stats = new Map<string, { errors: number; attempts: number }>();
  for (const item of attempts.flatMap((attempt) => attempt.items)) {
    const entry = stats.get(item.cardId) ?? { errors: 0, attempts: 0 };
    stats.set(item.cardId, { errors: entry.errors + (item.correct ? 0 : 1), attempts: entry.attempts + 1 });
  }
  return [...stats.entries()]
    .map(([cardId, entry]) => ({ term: cards.find((card) => card.id === cardId)?.term ?? cardId, ...entry }))
    .filter((entry) => entry.errors > 0)
    .sort((a, b) => b.errors - a.errors || a.term.localeCompare(b.term));
}

// ---------------------------------------------------------------------------
// Local persistence (browser storage, bounded)
// ---------------------------------------------------------------------------

export const STUDIO_STATE_KEY = "engineer-learning-os:learning-studio:v1";
const MAX_ATTEMPTS = 50;

export type StudioState = Readonly<{ version: 1; reviews: Readonly<Record<string, ReviewState>>; attempts: readonly StudioQuizAttempt[] }>;
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;
const EMPTY: StudioState = { version: 1, reviews: {}, attempts: [] };

export function readStudioState(storage: KeyValueStorage | null): StudioState {
  try {
    const parsed = JSON.parse(storage?.getItem(STUDIO_STATE_KEY) ?? "null") as Partial<StudioState> | null;
    if (!parsed || parsed.version !== 1 || typeof parsed.reviews !== "object" || !Array.isArray(parsed.attempts)) return EMPTY;
    return { version: 1, reviews: parsed.reviews ?? {}, attempts: parsed.attempts.filter((attempt) => attempt?.canonical === false) };
  } catch {
    return EMPTY;
  }
}

export function writeStudioState(storage: KeyValueStorage | null, state: StudioState): void {
  try {
    storage?.setItem(STUDIO_STATE_KEY, JSON.stringify({ ...state, attempts: state.attempts.slice(-MAX_ATTEMPTS) }));
  } catch {
    // Storage full or blocked: the session keeps working in memory.
  }
}
