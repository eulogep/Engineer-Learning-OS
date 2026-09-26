import type { CompetencyId } from "../learning-records/types";

export type ErrorType =
  | "PROCEDURAL_ERROR"
  | "DATA_INSPECTION_ERROR"
  | "HINT_DEPENDENCE"
  | "RETRY_DEPENDENCE"
  | "LOW_CONFIDENCE"
  | "INCOMPLETE_RESPONSE";

export type ReviewConcept =
  | "CSV_DELIMITER_DIAGNOSIS"
  | "CSV_DELIMITER_VS_ENCODING"
  | "CSV_SEPARATOR_TRANSFER"
  | "ENERGY_MISSING_VALUE_INSPECTION"
  | "TECHNICAL_CSV_EXPLANATION"
  | "OVERCLAIM_WITHOUT_EVIDENCE"
  | "MISSED_DATA_ANOMALY"
  | "NO_NEXT_ACTION"
  | "CONFUSED_FACT_AND_ASSUMPTION"
  | "OSI_LAYER_MISCLASSIFICATION"
  | "TCP_UDP_CONFUSION"
  | "ENCAPSULATION_PDU_CONFUSION"
  | "OSI_LAYER_ORDER_CONFUSION"
  | "OSI_TCPIP_MAPPING_CONFUSION"
  | "TCP_IP_LAYER_RESPONSIBILITY_CONFUSION";
export type ErrorSeverity = "LOW" | "MEDIUM" | "HIGH";
export type ErrorResolutionStatus = "ACTIVE" | "IMPROVING" | "RESOLVED";
export type ReviewStatus = "DUE" | "UPCOMING" | "COMPLETED" | "SUSPENDED";
export type ReviewType =
  | "MULTIPLE_CHOICE"
  | "SHORT_TEXT"
  | "QUICK_DIAGNOSTIC"
  | "CONFIDENCE_RESPONSE"
  | "VISUAL_ORDER_RECONSTRUCTION"
  | "VISUAL_MAPPING_RECONSTRUCTION";

export type AcademicPageReference = { sourceId: string; pageStart: number; pageEnd: number };

export type ErrorSignal = {
  id: string;
  competencyId: CompetencyId;
  sourceEvidenceId: string;
  missionId: string;
  attemptId: string;
  errorType: ErrorType;
  concept: ReviewConcept;
  description: string;
  observedAt: number;
  severity: ErrorSeverity;
  academicSourceId?: string;
  academicSectionId?: string;
  remediationUsed?: boolean;
  remediationMethod?: string | null;
  originErrorPatternId?: string;
  visualAttemptCount?: number;
  visualHintUsage?: number;
  academicPageReferences?: AcademicPageReference[];
};

export type ErrorPattern = {
  id: string;
  competencyId: CompetencyId;
  sourceEvidenceIds: string[];
  missionId: string;
  attemptIds: string[];
  errorType: ErrorType;
  concept: ReviewConcept;
  description: string;
  firstObservedAt: number;
  lastObservedAt: number;
  occurrenceCount: number;
  severity: ErrorSeverity;
  resolvedStatus: ErrorResolutionStatus;
  latestReviewResult: "CORRECT" | "INCORRECT" | null;
  metadata: {
    observedSignalIds: string[];
    successfulReviewCount: number;
    academicSourceIds?: string[];
    academicSectionIds?: string[];
    remediationMethods?: string[];
    originErrorPatternIds?: string[];
    visualAttemptCount?: number;
    visualHintUsage?: number;
    academicPageReferences?: AcademicPageReference[];
  };
  sourceClassification: "PERSONAL";
};

export type ReviewChoice = { id: string; label: string };

export type ReviewItem = {
  id: string;
  competencyId: CompetencyId;
  errorPatternIds: string[];
  sourceEvidenceIds: string[];
  missionId: string;
  concept: ReviewConcept;
  reviewType: ReviewType;
  title: string;
  prompt: string;
  choices?: ReviewChoice[];
  expectedResponse: string;
  acceptedKeywords?: string[];
  hint: string;
  successFeedback: string;
  retryFeedback: string;
  createdAt: number;
  dueAt: number;
  intervalMinutes: number;
  status: ReviewStatus;
  attemptCount: number;
  successCount: number;
  lastReviewedAt: number | null;
  nextReviewAt: number;
  whyDue: string;
  academicSourceIds?: string[];
  academicSectionIds?: string[];
  remediationMethods?: string[];
  origin?: "VISUAL_LEARNING";
  actionRoute?: string;
  academicPageReferences?: AcademicPageReference[];
  sourceClassification: "PERSONAL";
};

export type ReviewResultRecord = {
  id: string;
  reviewItemId: string;
  competencyId: CompetencyId;
  sourceEvidenceIds: string[];
  correct: boolean;
  response: string;
  hintCount: number;
  retryCount: number;
  confidence: number | null;
  durationMs: number | null;
  completedAt: number;
  sourceClassification: "PERSONAL";
};

export type ReviewEventType =
  | "ERROR_PATTERN_CREATED"
  | "ERROR_PATTERN_UPDATED"
  | "REVIEW_ITEM_CREATED"
  | "REVIEW_STARTED"
  | "REVIEW_ANSWER_SUBMITTED"
  | "REVIEW_COMPLETED"
  | "REVIEW_FAILED"
  | "REVIEW_RESCHEDULED"
  | "ERROR_PATTERN_IMPROVING"
  | "ERROR_PATTERN_RESOLVED";

export type ReviewEvent = {
  id: string;
  type: ReviewEventType;
  at: number;
  errorPatternId?: string;
  reviewItemId?: string;
};

export interface ErrorPatternRepository {
  list(): ErrorPattern[];
  replace(patterns: ErrorPattern[]): void;
}

export interface ReviewRepository {
  list(): ReviewItem[];
  replace(items: ReviewItem[]): void;
}
