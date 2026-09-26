import { mapLegacyClassification } from "../classification";
import { sha256, stableJson } from "../export/integrity";
import { parseCanonicalEvent } from "../events";
import type { CanonicalLearningRepository } from "../repository";
import { createSyncIdempotencyKey, parseSyncQueueJob } from "../sync-job";
import type {
  AssistanceProvenance,
  AttemptId,
  CanonicalEvent,
  DefinitionId,
  DefinitionIdentity,
  DeviceId,
  ErrorOccurrenceId,
  EventId,
  EvidenceId,
  JobId,
  LearnerRef,
  OpaqueContentReference,
  ReviewResultId,
} from "../types";
import type { EvidenceDeletionRecord, EvidenceRecord } from "../../learning-records/types";
import type { ErrorSignal, ReviewItem, ReviewResultRecord } from "../../review-engine/types";

export type LegacyShadowIdentity = Readonly<{ learnerRef: LearnerRef; deviceRef: DeviceId }>;

async function stableUuidV7(namespace: string, legacyId: string): Promise<string> {
  const digest = (await sha256(`${namespace}\u0000${legacyId}`)).slice("sha256:".length);
  const variant = ((Number.parseInt(digest[3], 16) & 0x3) | 0x8).toString(16);
  return `00000000-0000-7${digest.slice(0, 3)}-${variant}${digest.slice(4, 7)}-${digest.slice(7, 19)}`;
}

async function domainId<Id extends string>(namespace: string, legacyId: string): Promise<Id> {
  return stableUuidV7(namespace, legacyId) as Promise<Id>;
}

async function definitionIdentity(missionId: string, missionVersion: number): Promise<DefinitionIdentity> {
  return Object.freeze({
    definitionId: await domainId<DefinitionId>("definition", missionId),
    definitionVersion: missionVersion,
    definitionHash: await sha256(stableJson({ namespace: "legacy-mission", missionId, missionVersion })),
  });
}

function assistance(record: Pick<EvidenceRecord, "assistance" | "evaluationResult">): AssistanceProvenance {
  const modes: AssistanceProvenance["modes"] = record.evaluationResult.assistanceMode === "EXTERNAL_AI"
    ? ["EXTERNAL_AI"]
    : record.evaluationResult.assistanceMode === "IN_APP_SCAFFOLD"
      ? ["GUIDED"]
      : record.assistance.hintCount > 0 ? ["HINT"] : ["NONE"];
  return Object.freeze({ modes, hintCount: record.assistance.hintCount, retryCount: record.assistance.retryCount });
}

function evaluation(record: EvidenceRecord) {
  const outcome = record.evaluationResult.outcome;
  const status = record.verificationStatus === "VALID" ? "VALID"
    : record.verificationStatus === "INVALID" ? "INVALID"
      : outcome === "INCOMPLETE" ? "PARTIAL" : "UNVERIFIED";
  return Object.freeze({ status, outcomeCode: outcome, criteria: Object.freeze([]) });
}

async function opaqueReference(namespace: string, legacyId: string): Promise<OpaqueContentReference> {
  return Object.freeze({
    referenceId: await stableUuidV7(namespace, legacyId),
    storagePolicy: "LOCAL_ONLY",
    contentIncluded: false,
  });
}

function base(identity: LegacyShadowIdentity, eventId: EventId, eventType: CanonicalEvent["eventType"], at: number) {
  return {
    id: eventId,
    schemaVersion: 1 as const,
    learnerRef: identity.learnerRef,
    deviceRef: identity.deviceRef,
    occurredAt: at,
    recordedAt: at,
    deviceLocalOrder: at,
    classification: mapLegacyClassification("PERSONAL", "METADATA_ONLY"),
    eventType,
  };
}

async function evidenceEvent(identity: LegacyShadowIdentity, record: EvidenceRecord): Promise<CanonicalEvent> {
  const eventId = await domainId<EventId>("event:EVIDENCE_CREATED", record.id);
  const attemptId = await domainId<AttemptId>("attempt", record.attemptId);
  const evidenceId = await domainId<EvidenceId>("evidence", record.id);
  const artifactRefs = record.artifactReference
    ? [await opaqueReference("artifact", record.artifactReference.id)] : [];
  const sourceIds = new Set([
    ...(record.evaluationResult.academicSourceIds ?? []),
    ...(record.evaluationResult.academicPageReferences ?? []).map((page) => page.sourceId),
  ]);
  const sourceRefs = await Promise.all([...sourceIds].sort().map((id) => opaqueReference("source", id)));
  return parseCanonicalEvent({
    ...base(identity, eventId, "EVIDENCE_CREATED", record.createdAt),
    definitionIdentity: await definitionIdentity(record.missionId, record.missionVersion),
    attemptId,
    payload: {
      evidenceId,
      evidenceType: record.evidenceType,
      conceptIds: [...(record.evaluationResult.academicConceptIds ?? [])],
      competencyIds: [...record.competencyIds],
      result: evaluation(record),
      assistance: assistance(record),
      evidenceClassification: mapLegacyClassification("PERSONAL", "METADATA_ONLY"),
      artifactRefs,
      sourceRefs,
    },
  });
}

async function attemptEvents(identity: LegacyShadowIdentity, records: readonly EvidenceRecord[]): Promise<CanonicalEvent[]> {
  const byAttempt = new Map<string, EvidenceRecord[]>();
  for (const record of records) byAttempt.set(record.attemptId, [...(byAttempt.get(record.attemptId) ?? []), record]);
  const result: CanonicalEvent[] = [];
  for (const [legacyAttemptId, attemptRecords] of byAttempt) {
    const ordered = [...attemptRecords].sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
    const representative = ordered.at(-1)!;
    const combined = assistance(representative);
    const attemptId = await domainId<AttemptId>("attempt", legacyAttemptId);
    const definition = await definitionIdentity(representative.missionId, representative.missionVersion);
    result.push(parseCanonicalEvent({
      ...base(identity, await domainId<EventId>("event:ATTEMPT_COMPLETED", legacyAttemptId), "ATTEMPT_COMPLETED", representative.createdAt),
      definitionIdentity: definition,
      attemptId,
      payload: { completion: "COMPLETED", assistance: combined },
    }));
    result.push(parseCanonicalEvent({
      ...base(identity, await domainId<EventId>("event:MISSION_COMPLETED", legacyAttemptId), "MISSION_COMPLETED", representative.createdAt),
      definitionIdentity: definition,
      attemptId,
      payload: { missionRef: representative.missionId, completion: "COMPLETED", assistance: combined },
    }));
  }
  return result;
}

async function errorEvent(
  identity: LegacyShadowIdentity,
  signal: ErrorSignal,
  canonicalEvidenceIds: ReadonlySet<string>,
): Promise<CanonicalEvent> {
  const occurrenceId = await domainId<ErrorOccurrenceId>("error-occurrence", signal.id);
  const sourceRefs = signal.academicSourceId ? [await opaqueReference("source", signal.academicSourceId)] : [];
  return parseCanonicalEvent({
    ...base(identity, await domainId<EventId>("event:ERROR_OBSERVED", signal.id), "ERROR_OBSERVED", signal.observedAt),
    definitionIdentity: await definitionIdentity(signal.missionId, 1),
    attemptId: await domainId<AttemptId>("attempt", signal.attemptId),
    payload: {
      errorOccurrenceId: occurrenceId,
      ...(canonicalEvidenceIds.has(signal.sourceEvidenceId)
        ? { evidenceId: await domainId<EvidenceId>("evidence", signal.sourceEvidenceId) } : {}),
      conceptIds: [signal.concept],
      competencyIds: [signal.competencyId],
      errorType: signal.errorType,
      errorCode: signal.concept,
      severity: signal.severity,
      context: { sourceRefs },
    },
  });
}

async function reviewEvent(
  identity: LegacyShadowIdentity,
  result: ReviewResultRecord,
  item: ReviewItem | undefined,
  signals: readonly ErrorSignal[],
  canonicalEvidenceIds: ReadonlySet<string>,
): Promise<CanonicalEvent> {
  const related = signals.filter((signal) => result.sourceEvidenceIds.includes(signal.sourceEvidenceId)
    && (!item || signal.concept === item.concept));
  const responseMode = item?.reviewType.startsWith("VISUAL_") ? "VISUAL"
    : item?.reviewType === "MULTIPLE_CHOICE" ? "CHOICE" : "TEXT";
  return parseCanonicalEvent({
    ...base(identity, await domainId<EventId>("event:REVIEW_COMPLETED", result.id), "REVIEW_COMPLETED", result.completedAt),
    definitionIdentity: await definitionIdentity(`review:${item?.missionId ?? result.competencyId}`, 1),
    attemptId: await domainId<AttemptId>("review-attempt", result.id),
    payload: {
      reviewResultId: await domainId<ReviewResultId>("review-result", result.id),
      sourceEvidenceIds: await Promise.all(result.sourceEvidenceIds
        .filter((id) => canonicalEvidenceIds.has(id))
        .map((id) => domainId<EvidenceId>("evidence", id))),
      sourceErrorOccurrenceIds: await Promise.all(related.map((signal) => domainId<ErrorOccurrenceId>("error-occurrence", signal.id))),
      conceptIds: [item?.concept ?? result.competencyId],
      competencyIds: [result.competencyId],
      outcome: result.correct ? "CORRECT" : "INCORRECT",
      responseMode,
      durationMs: result.durationMs,
      confidence: result.confidence,
      assistance: {
        modes: result.hintCount > 0 ? ["HINT"] : ["NONE"],
        hintCount: result.hintCount,
        retryCount: result.retryCount,
      },
    },
  });
}

async function jobFor(event: CanonicalEvent) {
  return parseSyncQueueJob({
    id: await domainId<JobId>("sync-job", event.id),
    eventId: event.id,
    idempotencyKey: createSyncIdempotencyKey(`legacy-shadow:${event.id}`),
    state: "PENDING",
    createdAt: event.recordedAt,
    attempts: 0,
    classification: event.classification,
  });
}

async function deletionEvent(identity: LegacyShadowIdentity, deletion: EvidenceDeletionRecord): Promise<CanonicalEvent> {
  return parseCanonicalEvent({
    ...base(identity, await domainId<EventId>("event:DELETION_REQUESTED", deletion.id), "DELETION_REQUESTED", deletion.requestedAt),
    payload: {
      targetType: "EVIDENCE",
      targetId: await domainId<EvidenceId>("evidence", deletion.evidenceId),
      scope: "LOCAL_AND_REMOTE",
      requestedBy: "LEARNER",
      reasonCode: "LEARNER_REQUEST",
    },
  });
}

export async function reconcileLegacyLearningHistory(input: Readonly<{
  repository: CanonicalLearningRepository;
  identity: LegacyShadowIdentity;
  evidence: readonly EvidenceRecord[];
  deletions: readonly EvidenceDeletionRecord[];
  errorSignals: readonly ErrorSignal[];
  reviewItems: readonly ReviewItem[];
  reviewResults: readonly ReviewResultRecord[];
}>): Promise<Readonly<{ events: number; outboxJobs: number }>> {
  const items = new Map(input.reviewItems.map((item) => [item.id, item]));
  const stableEvidence = input.evidence.filter((record) => [
    "SUCCESSFUL_GUIDED", "SUCCESSFUL_TRANSFER", "REVIEW_SUCCESS", "REVIEW_FAILURE",
  ].includes(record.evaluationResult.outcome));
  const canonicalEvidenceIds = new Set(stableEvidence.map((record) => record.id));
  const events = [
    ...await attemptEvents(input.identity, stableEvidence),
    ...await Promise.all(stableEvidence.map((record) => evidenceEvent(input.identity, record))),
    ...await Promise.all(input.errorSignals.map((signal) => errorEvent(input.identity, signal, canonicalEvidenceIds))),
    ...await Promise.all(input.reviewResults.map((result) => reviewEvent(
      input.identity, result, items.get(result.reviewItemId), input.errorSignals, canonicalEvidenceIds,
    ))),
    ...await Promise.all(input.deletions.map((deletion) => deletionEvent(input.identity, deletion))),
  ].sort((left, right) => left.occurredAt - right.occurredAt || left.id.localeCompare(right.id));
  const definitions = new Map<string, DefinitionIdentity>();
  for (const event of events) {
    if (event.eventType !== "DELETION_REQUESTED") {
      definitions.set(`${event.definitionIdentity.definitionId}:${event.definitionIdentity.definitionVersion}`, event.definitionIdentity);
    }
  }
  for (const definition of definitions.values()) await input.repository.putDefinition(definition);
  for (const event of events) await input.repository.appendEventWithOutbox(event, await jobFor(event));
  return Object.freeze({ events: events.length, outboxJobs: events.length });
}
