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
  academicSource?: Readonly<{
    id: string;
    path: string;
    sha256: string;
    status: import("../academic-workspace/types").AcademicSourceIndexStatus;
    classification: import("../source-engine/types").DataClassification;
    examScope: "UNCONFIRMED";
  }>;
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
  /** Unit used in citations: PDF pages, or numbered sections for text/Markdown files. */
  unit?: "page" | "section";
  importedAt?: string;
  /** Original-file identity. Extracted passages remain derived, never learner evidence. */
  provenance?: Readonly<{
    sourceId: string;
    sha256: string;
    originalFileName: string;
    extractionMethod: string;
    artifactRole: "DERIVED";
    originalRole: "ORIGINAL_SOURCE";
  }>;
  pages: readonly StudioPage[];
}>;

/** A verifiable pointer: the quote must appear verbatim in the cited passage. */
export type StudioCitation = Readonly<{
  documentId: string;
  pageNumber: number;
  passageId: string;
  quote: string;
  documentVersion?: number;
  sourceSha256?: string;
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
  mode?: "QUIZ" | "MOCK_EXAM";
  durationSeconds?: number;
  items: readonly Readonly<{ questionId: string; cardId: string; correct: boolean; confidence?: Confidence }>[];
}>;

/** Self-reported confidence before seeing the correction (calibration, SCI-002). */
export type Confidence = "SURE" | "UNSURE" | "GUESS";
