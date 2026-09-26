import type { CanonicalClassification } from "../learning-history/types";

export type ScientificWorkstreamId = "SCI-001" | "SCI-002" | "SCI-003" | "SCI-004" | "SCI-005" | "SCI-006";
export type ScientificDecision = "ADOPT" | "ADAPT" | "EXPERIMENTAL" | "REJECT";
export type EvidenceLevel = "LEVEL_A" | "LEVEL_B" | "LEVEL_C" | "LEVEL_D" | "LEVEL_E";

export type ScientificSourceRecord = Readonly<{
  id: string;
  title: string;
  authors: readonly string[];
  year: number;
  publicationVenue: string;
  doi: string | null;
  arxivId: string | null;
  url: string;
  openAccessUrl: string | null;
  evidenceLevel: EvidenceLevel;
  studyType: string;
  sample: string;
  population: string;
  learningDomain: string;
  mainFinding: string;
  limitations: string;
  elosRelevance: string;
  retrievedAt: string;
}>;

export type ScientificDecisionRecord = Readonly<{
  id: ScientificWorkstreamId;
  feature: string;
  claim: string;
  evidenceLevel: EvidenceLevel;
  sources: readonly string[];
  supportedMechanism: string;
  implementationDecision: ScientificDecision;
  limitations: readonly string[];
  measurementPlan: readonly string[];
}>;

export type AssistanceLevel =
  | "NONE"
  | "PROMPT"
  | "HINT"
  | "SCAFFOLD"
  | "PARTIAL_EXAMPLE"
  | "WORKED_EXAMPLE"
  | "FULL_SOLUTION";

export type ConfidenceCalibration =
  | "OVERCONFIDENT_ERROR"
  | "UNDERCONFIDENT_SUCCESS"
  | "ASSISTANCE_DEPENDENCE"
  | "STABLE_AUTONOMOUS_SUCCESS"
  | "NEEDS_MORE_EVIDENCE";

export type ConceptRelationType = "PREREQUISITE_OF" | "CONFUSED_WITH" | "RELATED_TO" | "EXAMPLE_OF";
export type ConceptRelation = Readonly<{
  from: string;
  to: string;
  type: ConceptRelationType;
  provenance: string;
}>;

export type PedagogicalAction =
  | "RETRIEVE"
  | "SPACE"
  | "INTERLEAVE"
  | "SELF_EXPLAIN"
  | "WORKED_EXAMPLE"
  | "FADE_SUPPORT"
  | "TRANSFER"
  | "REMEDIATE_PREREQUISITE";

export type PedagogicalObservation = Readonly<{
  observationId: string;
  conceptId: string;
  occurredAt: number;
  correct: boolean;
  confidence: 1 | 2 | 3 | 4 | 5 | null;
  assistance: AssistanceLevel;
  hintCount: number;
  retryCount: number;
  delayedRetrieval: boolean;
  transfer: boolean;
  classification: CanonicalClassification;
}>;

export type LearnerConceptState = Readonly<{
  conceptId: string;
  observations: readonly PedagogicalObservation[];
  correctCount: number;
  errorCount: number;
  autonomousSuccessCount: number;
  transferSuccessCount: number;
  delayedRetrievalSuccessCount: number;
  latestCalibration: ConfidenceCalibration;
}>;

export type PedagogicalPlan = Readonly<{
  policyVersion: 1;
  action: PedagogicalAction;
  conceptId: string;
  relatedConceptId: string | null;
  assistance: AssistanceLevel;
  reasonCodes: readonly string[];
}>;

export type ReviewScheduleInput = Readonly<{
  correct: boolean;
  successfulReviewCount: number;
  confidence: number | null;
  hintCount: number;
  retryCount: number;
  recurringErrorCount: number;
}>;

export type ReviewScheduleDecision = Readonly<{
  intervalMinutes: number;
  reasonCodes: readonly string[];
}>;
