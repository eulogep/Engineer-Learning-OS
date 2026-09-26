import { z } from "zod";

import type { CanonicalEvent } from "./types";
import { CANONICAL_EVENT_SCHEMA_VERSION } from "./types";

export const UUIDV7_CANONICAL_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SAFE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

const uuidV7Schema = z.string().regex(UUIDV7_CANONICAL_PATTERN);
const safeReferenceSchema = z.string().min(1).max(160).regex(SAFE_REFERENCE_PATTERN);
const classificationSchema = z.enum(["SYNC_ALLOWED", "LOCAL_ONLY", "UNKNOWN_BLOCKED"]);

export const definitionIdentitySchema = z.object({
  definitionId: uuidV7Schema,
  definitionVersion: z.number().int().positive(),
  definitionHash: z.string().regex(SHA256_PATTERN),
}).strict();

export const opaqueContentReferenceSchema = z.object({
  referenceId: safeReferenceSchema,
  storagePolicy: z.enum(["LOCAL_ONLY", "REMOTE_ENCRYPTED_FUTURE"]),
  contentIncluded: z.literal(false),
  sha256: z.string().regex(SHA256_PATTERN).optional(),
}).strict();

export const assistanceProvenanceSchema = z.object({
  modes: z.array(z.enum(["NONE", "HINT", "GUIDED", "PARTIAL_SOLUTION", "FULL_SOLUTION", "EXTERNAL_AI", "OTHER"])).min(1),
  hintCount: z.number().int().nonnegative(),
  retryCount: z.number().int().nonnegative(),
}).strict().superRefine((assistance, context) => {
  const uniqueModes = new Set(assistance.modes);
  if (uniqueModes.size !== assistance.modes.length) {
    context.addIssue({ code: "custom", message: "Assistance modes must be unique." });
  }
  if (uniqueModes.has("NONE") && uniqueModes.size > 1) {
    context.addIssue({ code: "custom", message: "NONE cannot be combined with assistance." });
  }
  if (uniqueModes.has("NONE") && assistance.hintCount > 0) {
    context.addIssue({ code: "custom", message: "NONE cannot include hints." });
  }
});

const criterionResultSchema = z.object({
  criterionId: safeReferenceSchema,
  status: z.enum(["VALID", "PARTIAL", "INVALID", "UNVERIFIED"]),
}).strict();

const evaluationResultSchema = z.object({
  status: z.enum(["VALID", "PARTIAL", "INVALID", "UNVERIFIED"]),
  outcomeCode: safeReferenceSchema,
  criteria: z.array(criterionResultSchema),
}).strict();

const baseEventFields = {
  id: uuidV7Schema,
  schemaVersion: z.literal(CANONICAL_EVENT_SCHEMA_VERSION),
  learnerRef: uuidV7Schema,
  deviceRef: uuidV7Schema,
  occurredAt: z.number().int().nonnegative().safe(),
  recordedAt: z.number().int().nonnegative().safe(),
  deviceLocalOrder: z.number().int().nonnegative().safe(),
  classification: classificationSchema,
};

const pedagogicalFields = {
  definitionIdentity: definitionIdentitySchema,
  attemptId: uuidV7Schema,
};

function pedagogicalEvent<EventType extends string, Payload extends z.ZodType>(
  eventType: EventType,
  payload: Payload,
) {
  return z.object({
    ...baseEventFields,
    ...pedagogicalFields,
    eventType: z.literal(eventType),
    payload,
  }).strict();
}

const attemptStartedSchema = pedagogicalEvent("ATTEMPT_STARTED", z.object({}).strict());

const attemptAnsweredSchema = pedagogicalEvent("ATTEMPT_ANSWERED", z.object({
  stepRef: safeReferenceSchema,
  responseKind: z.enum(["CHOICE", "SHORT_TEXT", "LONG_TEXT", "AUDIO", "FILE", "VISUAL"]),
  responseRef: opaqueContentReferenceSchema,
  outcome: z.enum(["SUBMITTED", "ACCEPTED", "REJECTED", "UNEVALUATED"]),
  assistance: assistanceProvenanceSchema,
}).strict());

const attemptCompletedSchema = pedagogicalEvent("ATTEMPT_COMPLETED", z.object({
  completion: z.enum(["COMPLETED", "ABANDONED"]),
  assistance: assistanceProvenanceSchema,
}).strict());

const evidenceCreatedSchema = pedagogicalEvent("EVIDENCE_CREATED", z.object({
  evidenceId: uuidV7Schema,
  evidenceType: safeReferenceSchema,
  conceptIds: z.array(safeReferenceSchema),
  competencyIds: z.array(safeReferenceSchema),
  result: evaluationResultSchema,
  assistance: assistanceProvenanceSchema,
  evidenceClassification: classificationSchema,
  artifactRefs: z.array(opaqueContentReferenceSchema),
  sourceRefs: z.array(opaqueContentReferenceSchema),
}).strict());

const errorObservedSchema = pedagogicalEvent("ERROR_OBSERVED", z.object({
  errorOccurrenceId: uuidV7Schema,
  evidenceId: uuidV7Schema.optional(),
  conceptIds: z.array(safeReferenceSchema).min(1),
  competencyIds: z.array(safeReferenceSchema),
  errorType: safeReferenceSchema,
  errorCode: safeReferenceSchema,
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  context: z.object({
    stepRef: safeReferenceSchema.optional(),
    criterionRef: safeReferenceSchema.optional(),
    sourceRefs: z.array(opaqueContentReferenceSchema),
  }).strict(),
}).strict());

const reviewCompletedSchema = pedagogicalEvent("REVIEW_COMPLETED", z.object({
  reviewResultId: uuidV7Schema,
  sourceEvidenceIds: z.array(uuidV7Schema),
  sourceErrorOccurrenceIds: z.array(uuidV7Schema),
  conceptIds: z.array(safeReferenceSchema).min(1),
  competencyIds: z.array(safeReferenceSchema),
  outcome: z.enum(["CORRECT", "PARTIAL", "INCORRECT"]),
  responseMode: z.enum(["CHOICE", "TEXT", "AUDIO", "VISUAL"]),
  durationMs: z.number().int().nonnegative().safe().nullable(),
  confidence: z.number().int().min(1).max(5).nullable(),
  assistance: assistanceProvenanceSchema,
}).strict());

const hintUsedSchema = pedagogicalEvent("HINT_USED", z.object({
  stepRef: safeReferenceSchema,
  hintRef: safeReferenceSchema,
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
}).strict());

const missionCompletedSchema = pedagogicalEvent("MISSION_COMPLETED", z.object({
  missionRef: safeReferenceSchema,
  completion: z.literal("COMPLETED"),
  assistance: assistanceProvenanceSchema,
}).strict());

const assessmentScoredSchema = pedagogicalEvent("ASSESSMENT_SCORED", z.object({
  assessmentRef: safeReferenceSchema,
  result: evaluationResultSchema,
}).strict());

const confidenceRecordedSchema = pedagogicalEvent("CONFIDENCE_RECORDED", z.object({
  subjectRef: safeReferenceSchema,
  subjectType: z.enum(["ATTEMPT", "STEP", "REVIEW", "MISSION"]),
  value: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
}).strict());

const deletionRequestedSchema = z.object({
  ...baseEventFields,
  eventType: z.literal("DELETION_REQUESTED"),
  payload: z.object({
    targetType: z.enum(["EVENT", "ATTEMPT", "EVIDENCE", "REVIEW_RESULT", "DERIVED_ARTIFACT", "SOURCE_METADATA"]),
    targetId: safeReferenceSchema,
    scope: z.enum(["LOCAL_AND_REMOTE", "LOCAL_ONLY"]),
    requestedBy: z.enum(["LEARNER", "SYSTEM_POLICY"]),
    reasonCode: z.enum(["LEARNER_REQUEST", "RETENTION_EXPIRED", "INVALID_DATA"]).optional(),
  }).strict(),
}).strict();

const eventUnionSchema = z.discriminatedUnion("eventType", [
  attemptStartedSchema,
  attemptAnsweredSchema,
  attemptCompletedSchema,
  evidenceCreatedSchema,
  errorObservedSchema,
  reviewCompletedSchema,
  hintUsedSchema,
  missionCompletedSchema,
  assessmentScoredSchema,
  confidenceRecordedSchema,
  deletionRequestedSchema,
]);

export const canonicalEventSchema = eventUnionSchema.superRefine((event, context) => {
  if (event.eventType === "EVIDENCE_CREATED" && event.payload.evidenceClassification !== event.classification) {
    context.addIssue({
      code: "custom",
      path: ["payload", "evidenceClassification"],
      message: "Evidence classification must match its canonical event envelope.",
    });
  }
});

export function validateCanonicalEvent(value: unknown): value is CanonicalEvent {
  return canonicalEventSchema.safeParse(value).success;
}

