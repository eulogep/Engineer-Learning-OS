/**
 * Learning Studio: source-grounded study workspace.
 *
 * Everything produced here is DERIVED material. It never writes canonical
 * learning events and never grants a competency state: mastery stays governed
 * by the evidence rules of learning-records / learning-history.
 */

export type StudioDocType = "COURS" | "TD" | "TP" | "TRANSCRIPTION";

export type StudioPassage = Readonly<{ id: string; text: string }>;
export type StudioPage = Readonly<{ pageNumber: number; passages: readonly StudioPassage[] }>;

export type StudioDocument = Readonly<{
  id: string;
  title: string;
  subjectId: string;
  subjectLabel: string;
  chapter: string;
  docType: StudioDocType;
  version: number;
  /** Fixtures are synthetic teaching material written for the prototype. */
  synthetic: boolean;
  classification: "PUBLIC" | "PERSONAL";
  pages: readonly StudioPage[];
}>;

/** A verifiable pointer: the quote must appear verbatim in the cited passage. */
export type StudioCitation = Readonly<{
  documentId: string;
  pageNumber: number;
  passageId: string;
  quote: string;
}>;

export type Derived<T> = T & Readonly<{ materialKind: "DERIVED_MATERIAL"; canonical: false; citations: readonly StudioCitation[] }>;

export type PassageHit = Readonly<{ document: StudioDocument; page: StudioPage; passage: StudioPassage; score: number }>;

export type Flashcard = Derived<{ id: string; term: string; definition: string; documentId: string }>;
export type QuizQuestion = Derived<{ id: string; prompt: string; choices: readonly string[]; answer: string; cardId: string }>;
export type SheetEntry = Derived<{ term: string; definition: string }>;
export type MindMapNode = Readonly<{ label: string; children: readonly MindMapNode[]; citation?: StudioCitation }>;

export type TutorHint = Readonly<{ level: 1 | 2 | 3; text: string }>;
export type SocraticPrompt = Derived<{ question: string; hints: readonly TutorHint[] }>;

export type FeynmanFeedback = Readonly<{ covered: readonly string[]; missing: readonly string[]; ratio: number }>;

/** Practice done in the Studio: kept apart from canonical evidence on purpose. */
export type StudioQuizAttempt = Readonly<{
  id: string;
  at: string;
  evidenceKind: "DERIVED_PRACTICE";
  canonical: false;
  assisted: boolean;
  items: readonly Readonly<{ questionId: string; cardId: string; correct: boolean }>[];
}>;
