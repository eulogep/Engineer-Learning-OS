declare const domainIdBrand: unique symbol;

export type DomainId<Name extends string> = string & {
  readonly [domainIdBrand]: Name;
};

export type EventId = DomainId<"EventId">;
export type AttemptId = DomainId<"AttemptId">;
export type EvidenceId = DomainId<"EvidenceId">;
export type ErrorOccurrenceId = DomainId<"ErrorOccurrenceId">;
export type ReviewResultId = DomainId<"ReviewResultId">;
export type DefinitionId = DomainId<"DefinitionId">;
export type DeviceId = DomainId<"DeviceId">;
export type LearnerRef = DomainId<"LearnerRef">;
export type JobId = DomainId<"JobId">;
export type CheckpointId = DomainId<"CheckpointId">;
export type TombstoneId = DomainId<"TombstoneId">;
export type DerivedArtifactId = DomainId<"DerivedArtifactId">;

export const CANONICAL_EVENT_SCHEMA_VERSION = 1 as const;

export const CANONICAL_EVENT_TYPES = [
  "ATTEMPT_STARTED",
  "ATTEMPT_ANSWERED",
  "ATTEMPT_COMPLETED",
  "EVIDENCE_CREATED",
  "ERROR_OBSERVED",
  "REVIEW_COMPLETED",
  "HINT_USED",
  "MISSION_COMPLETED",
  "ASSESSMENT_SCORED",
  "CONFIDENCE_RECORDED",
  "DELETION_REQUESTED",
] as const;

export type CanonicalEventType = (typeof CANONICAL_EVENT_TYPES)[number];
export type PedagogicalEventType = Exclude<CanonicalEventType, "DELETION_REQUESTED">;
export type CanonicalClassification = "SYNC_ALLOWED" | "LOCAL_ONLY" | "UNKNOWN_BLOCKED";

export type DefinitionIdentity = Readonly<{
  definitionId: DefinitionId;
  definitionVersion: number;
  definitionHash: string;
}>;

export type OpaqueContentReference = Readonly<{
  referenceId: string;
  storagePolicy: "LOCAL_ONLY" | "REMOTE_ENCRYPTED_FUTURE";
  contentIncluded: false;
  sha256?: string;
}>;

export type AssistanceMode =
  | "NONE"
  | "HINT"
  | "GUIDED"
  | "PARTIAL_SOLUTION"
  | "FULL_SOLUTION"
  | "EXTERNAL_AI"
  | "OTHER";

export type AssistanceProvenance = Readonly<{
  modes: readonly AssistanceMode[];
  hintCount: number;
  retryCount: number;
}>;

export type CriterionResult = Readonly<{
  criterionId: string;
  status: "VALID" | "PARTIAL" | "INVALID" | "UNVERIFIED";
}>;

export type EvaluationResult = Readonly<{
  status: "VALID" | "PARTIAL" | "INVALID" | "UNVERIFIED";
  outcomeCode: string;
  criteria: readonly CriterionResult[];
}>;

export type AttemptStartedPayload = Readonly<Record<string, never>>;

export type AttemptAnsweredPayload = Readonly<{
  stepRef: string;
  responseKind: "CHOICE" | "SHORT_TEXT" | "LONG_TEXT" | "AUDIO" | "FILE" | "VISUAL";
  responseRef: OpaqueContentReference;
  outcome: "SUBMITTED" | "ACCEPTED" | "REJECTED" | "UNEVALUATED";
  assistance: AssistanceProvenance;
}>;

export type AttemptCompletedPayload = Readonly<{
  completion: "COMPLETED" | "ABANDONED";
  assistance: AssistanceProvenance;
}>;

export type EvidenceCreatedPayload = Readonly<{
  evidenceId: EvidenceId;
  evidenceType: string;
  conceptIds: readonly string[];
  competencyIds: readonly string[];
  result: EvaluationResult;
  assistance: AssistanceProvenance;
  evidenceClassification: CanonicalClassification;
  artifactRefs: readonly OpaqueContentReference[];
  sourceRefs: readonly OpaqueContentReference[];
}>;

export type ErrorObservedPayload = Readonly<{
  errorOccurrenceId: ErrorOccurrenceId;
  evidenceId?: EvidenceId;
  conceptIds: readonly string[];
  competencyIds: readonly string[];
  errorType: string;
  errorCode: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  context: Readonly<{
    stepRef?: string;
    criterionRef?: string;
    sourceRefs: readonly OpaqueContentReference[];
  }>;
}>;

export type ReviewCompletedPayload = Readonly<{
  reviewResultId: ReviewResultId;
  sourceEvidenceIds: readonly EvidenceId[];
  sourceErrorOccurrenceIds: readonly ErrorOccurrenceId[];
  conceptIds: readonly string[];
  competencyIds: readonly string[];
  outcome: "CORRECT" | "PARTIAL" | "INCORRECT";
  responseMode: "CHOICE" | "TEXT" | "AUDIO" | "VISUAL";
  durationMs: number | null;
  confidence: number | null;
  assistance: AssistanceProvenance;
}>;

export type HintUsedPayload = Readonly<{
  stepRef: string;
  hintRef: string;
  level: 1 | 2 | 3;
}>;

export type MissionCompletedPayload = Readonly<{
  missionRef: string;
  completion: "COMPLETED";
  assistance: AssistanceProvenance;
}>;

export type AssessmentScoredPayload = Readonly<{
  assessmentRef: string;
  result: EvaluationResult;
}>;

export type ConfidenceRecordedPayload = Readonly<{
  subjectRef: string;
  subjectType: "ATTEMPT" | "STEP" | "REVIEW" | "MISSION";
  value: 1 | 2 | 3 | 4 | 5;
}>;

export type DeletionRequestedPayload = Readonly<{
  targetType: "EVENT" | "ATTEMPT" | "EVIDENCE" | "REVIEW_RESULT" | "DERIVED_ARTIFACT" | "SOURCE_METADATA";
  targetId: string;
  scope: "LOCAL_AND_REMOTE" | "LOCAL_ONLY";
  requestedBy: "LEARNER" | "SYSTEM_POLICY";
  reasonCode?: "LEARNER_REQUEST" | "RETENTION_EXPIRED" | "INVALID_DATA";
}>;

export type CanonicalEventPayloadMap = {
  ATTEMPT_STARTED: AttemptStartedPayload;
  ATTEMPT_ANSWERED: AttemptAnsweredPayload;
  ATTEMPT_COMPLETED: AttemptCompletedPayload;
  EVIDENCE_CREATED: EvidenceCreatedPayload;
  ERROR_OBSERVED: ErrorObservedPayload;
  REVIEW_COMPLETED: ReviewCompletedPayload;
  HINT_USED: HintUsedPayload;
  MISSION_COMPLETED: MissionCompletedPayload;
  ASSESSMENT_SCORED: AssessmentScoredPayload;
  CONFIDENCE_RECORDED: ConfidenceRecordedPayload;
  DELETION_REQUESTED: DeletionRequestedPayload;
};

type CanonicalEventEnvelope = Readonly<{
  id: EventId;
  schemaVersion: typeof CANONICAL_EVENT_SCHEMA_VERSION;
  learnerRef: LearnerRef;
  deviceRef: DeviceId;
  occurredAt: number;
  recordedAt: number;
  deviceLocalOrder: number;
  classification: CanonicalClassification;
}>;

type PedagogicalCanonicalEvent<EventType extends PedagogicalEventType> = CanonicalEventEnvelope & Readonly<{
  eventType: EventType;
  definitionIdentity: DefinitionIdentity;
  attemptId: AttemptId;
  payload: CanonicalEventPayloadMap[EventType];
}>;

export type DeletionRequestedEvent = CanonicalEventEnvelope & Readonly<{
  eventType: "DELETION_REQUESTED";
  payload: DeletionRequestedPayload;
}>;

export type CanonicalEvent = {
  [EventType in PedagogicalEventType]: PedagogicalCanonicalEvent<EventType>;
}[PedagogicalEventType] | DeletionRequestedEvent;

export type CanonicalEntityMatrixRow = Readonly<{
  entity: string;
  canonical: boolean;
  why: string;
  reconstructible: boolean;
  source: string;
}>;

