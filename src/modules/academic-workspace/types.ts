import type { CompetencyId } from "../learning-records/types";
import type { DataClassification, SourceRecord } from "../source-engine/types";

export type AcademicSourceIndexStatus = "CURRENT_PRIMARY" | "CURRENT_SECONDARY" | "PROGRAM_ONLY" | "HISTORICAL_REFERENCE" | "UNVERIFIED";
export type AcademicSourceIndexEntry = Readonly<{
  id: string;
  course: string;
  type: string;
  path: string;
  academicYear?: string;
  status: AcademicSourceIndexStatus;
  canonical: boolean;
  provenanceRole: "ORIGINAL_SOURCE";
  dataClassification: DataClassification;
  repositoryVisibility: "TRACKED" | "LOCAL_ONLY";
  sha256: string;
  notes?: string;
}>;
export type AcademicSourceIndex = Readonly<{
  schemaVersion: 1;
  generatedAt: string;
  provenancePolicy: Readonly<{
    originalSourceRole: "ORIGINAL_SOURCE";
    derivedArtifactRole: "DERIVED";
    derivedDirectory: "knowledge/.derived";
    masteryFromSourcePresence: false;
  }>;
  sources: readonly AcademicSourceIndexEntry[];
  missingButKnownInChatGPT: readonly string[];
}>;

export type SubjectRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: "ACTIVE" | "PLANNED";
  competencyIds: CompetencyId[];
  moduleIds: string[];
};

export type ModuleRecord = {
  id: string;
  subjectId: string;
  title: string;
  description: string;
  status: "ACTIVE" | "PLANNED";
  sourceIds: string[];
  sectionIds: string[];
};

export type CourseFormat = "PDF" | "DOCX" | "MARKDOWN" | "TEXT" | "CSV";
export type CourseExtractionStatus = "EXTRACTED" | "PARTIALLY_EXTRACTED" | "EXTRACTION_FAILED" | "METADATA_ONLY";
export type PdfType = "TEXT_PDF" | "SCANNED_PDF" | "MIXED_PDF" | "UNKNOWN";
export type PdfExtractionStatus = "SUCCESS" | "PARTIAL" | "NO_TEXT" | "OCR_REQUIRED" | "CORRUPTED" | "UNSUPPORTED" | "FAILED";
export type PdfPageStatus = "EXTRACTED" | "NO_TEXT" | "FAILED";
export type PdfSectionStatus = "VERIFIED" | "NEEDS_REVIEW";

export type PdfExtractedPage = {
  pageNumber: number;
  text: string;
  characterCount: number;
  status: PdfPageStatus;
};

export type PdfExtractedSection = {
  id: string;
  sourceId: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  extractionMethod: string;
  createdAt: string;
  verificationStatus: PdfSectionStatus;
  text: string;
};

export type PdfExtractionResult = {
  sourceId: string;
  status: PdfExtractionStatus;
  pdfType: PdfType;
  pageCount: number;
  pages: PdfExtractedPage[];
  sections: PdfExtractedSection[];
  warnings: string[];
  extractionMethod: string;
};

export type CourseIngestionRecord = {
  id: string;
  sourceId: string;
  format: CourseFormat;
  status: CourseExtractionStatus;
  extractionMethod: "DOCX_XML_LOCAL" | "PDFJS_DIST_LOCAL" | "PLAIN_TEXT_LOCAL" | "CSV_LOCAL" | "NONE";
  extractedSectionIds: string[];
  failureReason: string | null;
  binaryCommitted: false;
};

export type AcademicSection = {
  materialKind: "DERIVED_MATERIAL";
  canonical: false;
  id: string;
  moduleId: string;
  sourceId: string;
  title: string;
  order: number;
  sourceReference: string;
  summary: string[];
  conceptIds: string[];
  verificationStatus: "VERIFIED_FROM_LOCAL_EXTRACTION" | "UNVERIFIED";
};

export type AcademicConceptCandidate = {
  materialKind: "DERIVED_MATERIAL";
  canonical: false;
  id: string;
  label: string;
  definition: string;
  sourceIds: string[];
  sectionIds: string[];
  status: "VALIDATED" | "CANDIDATE" | "REJECTED";
};

export type AcademicQuizQuestion = {
  id: string;
  prompt: string;
  responseType: "MULTIPLE_CHOICE" | "SHORT_TEXT";
  choices?: Array<{ id: string; label: string }>;
  expectedResponse: string;
  acceptedKeywords?: string[];
  successFeedback: string;
  retryFeedback: string;
  hint: string;
  retrievalPrompt?: string;
  sourceId: string;
  pageStart?: number;
  pageEnd?: number;
  sectionId: string;
  conceptIds: string[];
  generationMethod: "MANUAL_GROUNDED";
  verificationStatus: "VERIFIED";
};

export type AcademicQuizDefinition = {
  id: string;
  version: number;
  title: string;
  subjectId: string;
  moduleId: string;
  competencyIds: CompetencyId[];
  questions: AcademicQuizQuestion[];
  maxCompetencyState: "PRACTICED";
  mode?: AcademicQuizMode;
  sectionCoverage: SectionQuizCoverage;
  sourceBundle: AcademicSourceBundle;
};

export type AcademicQuizMode = "QUICK_REVIEW" | "STANDARD" | "DEEP_MASTERY" | "INDEPENDENT_TEST";
export type SectionQuizCoverage = "FULL" | "PARTIAL" | "INSUFFICIENT";

export type AcademicSourceBundle = {
  id: string;
  sourceIds: string[];
  sectionIds: string[];
  pageRanges: Array<{ sourceId: string; pageStart: number; pageEnd: number }>;
  verificationStatus: "VERIFIED";
};

export type RemediationMethodId =
  | "SIMPLE_EXPLANATION"
  | "ANALOGY"
  | "WORKED_EXAMPLE"
  | "FEYNMAN"
  | "MIND_MAP"
  | "MNEMONIC"
  | "FLASHCARDS"
  | "SOURCE_REVIEW"
  | "GUIDED_PRACTICE"
  | "VISUAL_RECONSTRUCTION";

export type RemediationMethod = {
  id: RemediationMethodId;
  label: string;
  purpose: string;
  conceptIds: string[];
  sourceIds: string[];
  generationMethod: "DETERMINISTIC_SOURCE_GROUNDED" | "PEDAGOGICAL_DERIVATION";
  requiresAI: false;
  evidencePolicy: "GUIDED_PRACTICE_ONLY";
  route?: string;
};

export type AcademicRemediationRecord = {
  questionId: string;
  conceptIds: string[];
  sourceId: string;
  sectionId: string;
  offeredAt: number;
  selectedMethod: RemediationMethodId | null;
  selectedAt: number | null;
  supportClosedAt: number | null;
  postRemediationResult: "PENDING" | "SUCCESS" | "FAILURE";
};

export type RemediationPolicy = {
  offerAfterWrongAnswers: number;
  contextualHintAfterWrongAnswers: number;
};

export type ExtractorCapabilities = {
  text: boolean;
  pageProvenance: boolean;
  sectionDetection: boolean;
  tables: "NONE" | "LIMITED" | "SUPPORTED";
  scannedPdf: "OCR_REQUIRED" | "SUPPORTED" | "NOT_APPLICABLE";
};

export type AcademicExtractorDescriptor = {
  format: CourseFormat;
  supported: boolean;
  localOnly: true;
  version: string;
  capabilities: ExtractorCapabilities;
  limitations: string[];
};

export type DuplicateClassification = "EXACT_DUPLICATE" | "POSSIBLE_DUPLICATE" | "NEW_SOURCE";
export type PotentialAcademicSource = {
  fileName: string;
  format: CourseFormat;
  possibleSubject: string;
  extractionSupport: "SUPPORTED" | "PARTIAL" | "UNSUPPORTED";
  status: "POTENTIAL" | "CATALOGUED" | "INGESTED" | DuplicateClassification;
};

export type AcademicQuizFeedback = { correct: boolean; message: string };
export type AcademicQuizAttempt = {
  id: string;
  definitionId: string;
  definitionVersion: number;
  status: "READY" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";
  currentQuestionIndex: number;
  responses: Record<string, string>;
  feedback: Record<string, AcademicQuizFeedback>;
  attempts: Record<string, number>;
  retries: Record<string, number>;
  hintsUsed: Record<string, number>;
  completedQuestionIds: string[];
  remediations: Record<string, AcademicRemediationRecord>;
  retrievalQuestionIds: string[];
  startedAt: number | null;
  completedAt: number | null;
  updatedAt: number;
};

export type AcademicWorkspaceRegistry = {
  subjects: SubjectRecord[];
  modules: ModuleRecord[];
  sources: SourceRecord[];
  ingestions: CourseIngestionRecord[];
  sections: AcademicSection[];
  concepts: AcademicConceptCandidate[];
  quizzes: AcademicQuizDefinition[];
};

export type CourseClassificationDraft = {
  fileName: string;
  format: CourseFormat;
  subjectId: string;
  moduleId: string;
  classification: Extract<DataClassification, "PUBLIC" | "ACADEMIC_PERSONAL_USE" | "PERSONAL" | "UNKNOWN">;
  language: string;
  copyrightStatus: "KNOWN" | "UNKNOWN" | "RESTRICTED";
};

export type AskCourseRequest = { question: string; allowedSourceIds: string[]; allowedSectionIds: string[] };
export type AskCourseCitation = { sourceId: string; sectionId: string; sourceReference: string };
export type AskCourseAnswer = {
  answer: string;
  citations: AskCourseCitation[];
  uncertainty: string | null;
  claims: Array<{ text: string; basis: "SOURCE" | "INFERENCE" }>;
};

export type AITaskType = "SOURCE_SUMMARY" | "CONCEPT_CANDIDATES" | "GROUNDED_QUIZ" | "ASK_COURSE";
export interface AIProvider {
  readonly id: string;
  readonly configured: boolean;
  execute(task: AITaskType, input: unknown): Promise<unknown>;
}
