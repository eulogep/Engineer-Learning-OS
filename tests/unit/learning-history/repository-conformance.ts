import assert from "node:assert/strict";
import test from "node:test";

import {
  CanonicalEventConflictError,
  DefinitionConflictError,
  InvalidSyncJobError,
  RepositoryInvariantError,
  SyncJobConflictError,
  TombstonedEntityError,
  createCheckpointId,
  deserializeCanonicalEvent,
  deserializeSyncQueueJob,
  parseCanonicalEvent,
  parseSyncQueueJob,
  serializeCanonicalEvent,
  serializeSyncQueueJob,
} from "../../../src/modules/learning-history/index";
import type {
  CanonicalEvent,
  CanonicalLearningRepository,
  DefinitionIdentity,
  SyncQueueJob,
} from "../../../src/modules/learning-history/index";

export type CanonicalRepositoryConformanceHarness = Readonly<{
  repository: CanonicalLearningRepository;
  failNextAtomicWriteAfterEvent(): void;
}>;

export type CanonicalRepositoryConformanceFactory =
  () => CanonicalRepositoryConformanceHarness | Promise<CanonicalRepositoryConformanceHarness>;

const uuid = (suffix: number) => "00000000-0000-7000-8000-" + suffix.toString().padStart(12, "0");
const hashA = "sha256:" + "a".repeat(64);
const hashB = "sha256:" + "b".repeat(64);
const noAssistance = { modes: ["NONE"] as const, hintCount: 0, retryCount: 0 };
const localReference = {
  referenceId: "synthetic-response",
  storagePolicy: "LOCAL_ONLY" as const,
  contentIncluded: false as const,
  sha256: hashA,
};

function definition(suffix = 4, hash = hashA): DefinitionIdentity {
  return {
    definitionId: uuid(suffix) as DefinitionIdentity["definitionId"],
    definitionVersion: 1,
    definitionHash: hash,
  };
}

function answeredEvent(
  eventSuffix: number,
  options: {
    attemptSuffix?: number;
    occurredAt?: number;
    outcome?: "SUBMITTED" | "ACCEPTED" | "REJECTED" | "UNEVALUATED";
    classification?: "SYNC_ALLOWED" | "LOCAL_ONLY" | "UNKNOWN_BLOCKED";
    definitionHash?: string;
  } = {},
): CanonicalEvent {
  const classification = options.classification ?? "SYNC_ALLOWED";
  return parseCanonicalEvent({
    id: uuid(eventSuffix),
    schemaVersion: 1,
    eventType: "ATTEMPT_ANSWERED",
    learnerRef: uuid(900),
    deviceRef: uuid(901),
    occurredAt: options.occurredAt ?? eventSuffix * 100,
    recordedAt: eventSuffix * 100 + 1,
    deviceLocalOrder: eventSuffix,
    classification,
    definitionIdentity: definition(4, options.definitionHash),
    attemptId: uuid(options.attemptSuffix ?? 100),
    payload: {
      stepRef: "synthetic-step",
      responseKind: "SHORT_TEXT",
      responseRef: localReference,
      outcome: options.outcome ?? "SUBMITTED",
      assistance: noAssistance,
    },
  });
}

function evidenceEvent(eventSuffix: number, evidenceSuffix: number, attemptSuffix = 100): CanonicalEvent {
  return parseCanonicalEvent({
    id: uuid(eventSuffix),
    schemaVersion: 1,
    eventType: "EVIDENCE_CREATED",
    learnerRef: uuid(900),
    deviceRef: uuid(901),
    occurredAt: eventSuffix * 100,
    recordedAt: eventSuffix * 100 + 1,
    deviceLocalOrder: eventSuffix,
    classification: "SYNC_ALLOWED",
    definitionIdentity: definition(),
    attemptId: uuid(attemptSuffix),
    payload: {
      evidenceId: uuid(evidenceSuffix),
      evidenceType: "SYNTHETIC_MISSION_ATTEMPT",
      conceptIds: ["SYNTHETIC_CONCEPT"],
      competencyIds: ["SYNTHETIC_COMPETENCY"],
      result: { status: "VALID", outcomeCode: "SYNTHETIC_SUCCESS", criteria: [] },
      assistance: noAssistance,
      evidenceClassification: "SYNC_ALLOWED",
      artifactRefs: [],
      sourceRefs: [],
    },
  });
}

function deletionEvent(eventSuffix: number, targetType: "ATTEMPT" | "EVENT", targetId: string): CanonicalEvent {
  return parseCanonicalEvent({
    id: uuid(eventSuffix),
    schemaVersion: 1,
    eventType: "DELETION_REQUESTED",
    learnerRef: uuid(900),
    deviceRef: uuid(901),
    occurredAt: eventSuffix * 100,
    recordedAt: eventSuffix * 100 + 1,
    deviceLocalOrder: eventSuffix,
    classification: "SYNC_ALLOWED",
    payload: {
      targetType,
      targetId,
      scope: "LOCAL_AND_REMOTE",
      requestedBy: "LEARNER",
      reasonCode: "LEARNER_REQUEST",
    },
  });
}

function jobFor(
  event: CanonicalEvent,
  jobSuffix: number,
  idempotencyKey = "sync-" + jobSuffix,
  classification = event.classification,
): SyncQueueJob {
  return parseSyncQueueJob({
    id: uuid(jobSuffix),
    eventId: event.id,
    idempotencyKey,
    state: "PENDING",
    createdAt: jobSuffix * 100,
    attempts: 0,
    classification,
  });
}

export function runCanonicalRepositoryConformance(
  adapterName: string,
  factory: CanonicalRepositoryConformanceFactory,
): void {
  const title = (label: string) => adapterName + " — " + label;

  test(title("A. appends a valid event"), async () => {
    const { repository } = await factory();
    const event = answeredEvent(1);
    const result = await repository.appendEvent(event);
    assert.equal(result.eventStatus, "APPENDED");
    assert.equal(await repository.countEvents(), 1);
  });

  test(title("B. reads an event by EventId"), async () => {
    const { repository } = await factory();
    const event = answeredEvent(2);
    await repository.appendEvent(event);
    assert.deepEqual(await repository.getEventById(event.id), event);
    assert.equal(await repository.hasEvent(event.id), true);
  });

  test(title("C. treats an identical EventId delivery as idempotent"), async () => {
    const { repository } = await factory();
    const event = answeredEvent(3);
    await repository.appendEvent(event);
    const repeated = await repository.appendEvent(event);
    assert.equal(repeated.eventStatus, "IDEMPOTENT");
    assert.equal(await repository.countEvents(), 1);
  });

  test(title("D. rejects conflicting content under the same EventId"), async () => {
    const { repository } = await factory();
    const event = answeredEvent(4);
    const conflict = answeredEvent(4, { outcome: "REJECTED" });
    await repository.appendEvent(event);
    await assert.rejects(repository.appendEvent(conflict), CanonicalEventConflictError);
    assert.deepEqual(await repository.getEventById(event.id), event);
  });

  test(title("E. exposes no event update or overwrite semantics"), async () => {
    const { repository } = await factory();
    assert.equal("updateEvent" in repository, false);
    assert.equal("deleteEvent" in repository, false);
    const event = answeredEvent(5);
    await repository.appendEvent(event);
    await assert.rejects(
      repository.appendEvent(answeredEvent(5, { occurredAt: 999_999 })),
      CanonicalEventConflictError,
    );
  });

  test(title("F. queries by AttemptId"), async () => {
    const { repository } = await factory();
    const matching = answeredEvent(6, { attemptSuffix: 106 });
    if (matching.eventType !== "ATTEMPT_ANSWERED") assert.fail("Expected an ATTEMPT_ANSWERED fixture.");
    await repository.appendEvent(matching);
    await repository.appendEvent(answeredEvent(7, { attemptSuffix: 107 }));
    assert.deepEqual(await repository.readEventsByAttemptId(matching.attemptId), [matching]);
  });

  test(title("G. queries every canonical reference to an EvidenceId"), async () => {
    const { repository } = await factory();
    const event = evidenceEvent(8, 208);
    if (event.eventType !== "EVIDENCE_CREATED") assert.fail("Expected an EVIDENCE_CREATED fixture.");
    await repository.appendEvent(event);
    assert.deepEqual(await repository.readEventsByEvidenceId(event.payload.evidenceId), [event]);
  });

  test(title("H. queries by eventType"), async () => {
    const { repository } = await factory();
    const first = answeredEvent(9);
    const second = answeredEvent(10);
    await repository.appendEvent(first);
    await repository.appendEvent(second);
    assert.deepEqual(await repository.readEventsByType("ATTEMPT_ANSWERED"), [first, second]);
  });

  test(title("I. scans deterministically after an opaque checkpoint"), async () => {
    const { repository } = await factory();
    const first = answeredEvent(11, { occurredAt: 9_000 });
    const second = answeredEvent(12, { occurredAt: 1_000 });
    const third = answeredEvent(13, { occurredAt: 5_000 });
    await repository.appendEvent(first);
    await repository.appendEvent(second);
    await repository.appendEvent(third);
    const page1 = await repository.readEventsAfter(null, 2);
    const page2 = await repository.readEventsAfter(page1.checkpoint, 2);
    assert.deepEqual(page1.events, [first, second]);
    assert.deepEqual(page2.events, [third]);
    assert.equal(page1.hasMore, true);
    assert.equal(page2.hasMore, false);
  });

  test(title("J. keeps checkpoint position opaque to callers"), async () => {
    const { repository } = await factory();
    await repository.appendEvent(answeredEvent(14));
    const page = await repository.readEventsAfter(null, 1);
    assert.equal(typeof page.checkpoint, "string");
    assert.equal(Object.prototype.hasOwnProperty.call(page.checkpoint, "sequence"), false);
    await assert.rejects(
      repository.readEventsAfter("foreign-checkpoint" as NonNullable<typeof page.checkpoint>, 1),
      RepositoryInvariantError,
    );
  });

  test(title("K. atomically commits CanonicalEvent and SyncQueueJob"), async () => {
    const { repository } = await factory();
    const event = answeredEvent(15);
    const job = jobFor(event, 315);
    const result = await repository.appendEventWithOutbox(event, job);
    assert.deepEqual({ event: result.eventStatus, job: result.outboxStatus }, { event: "APPENDED", job: "APPENDED" });
    assert.deepEqual(await repository.getOutboxJobByEventId(event.id), job);
    assert.equal(await repository.countEvents(), 1);
    assert.equal(await repository.countOutboxJobs(), 1);
  });

  test(title("L. injected failure commits neither event nor outbox job"), async () => {
    const harness = await factory();
    const event = answeredEvent(16);
    harness.failNextAtomicWriteAfterEvent();
    await assert.rejects(
      harness.repository.appendEventWithOutbox(event, jobFor(event, 316)),
      RepositoryInvariantError,
    );
    assert.equal(await harness.repository.hasEvent(event.id), false);
    assert.equal(await harness.repository.countOutboxJobs(), 0);
  });

  test(title("M. invalid required job commits neither side"), async () => {
    const { repository } = await factory();
    const event = answeredEvent(17);
    const otherEvent = answeredEvent(18);
    const mismatchedJob = jobFor(otherEvent, 317);
    await assert.rejects(repository.appendEventWithOutbox(event, mismatchedJob), InvalidSyncJobError);
    assert.equal(await repository.hasEvent(event.id), false);
    assert.equal(await repository.countOutboxJobs(), 0);
  });

  test(title("N. handles duplicate sync idempotency keys deterministically"), async () => {
    const { repository } = await factory();
    const first = answeredEvent(19);
    const second = answeredEvent(20);
    await repository.appendEventWithOutbox(first, jobFor(first, 319, "same-sync-key"));
    await assert.rejects(
      repository.appendEventWithOutbox(second, jobFor(second, 320, "same-sync-key")),
      SyncJobConflictError,
    );
    assert.equal(await repository.hasEvent(second.id), false);
    assert.equal(await repository.countEvents(), 1);
    assert.equal(await repository.countOutboxJobs(), 1);
  });

  test(title("O. records an idempotent tombstone"), async () => {
    const { repository } = await factory();
    const tombstone = deletionEvent(21, "ATTEMPT", uuid(121));
    await repository.appendEvent(tombstone);
    const repeated = await repository.appendEvent(tombstone);
    assert.equal(repeated.eventStatus, "IDEMPOTENT");
    assert.deepEqual(await repository.readTombstones(), [tombstone]);
  });

  test(title("P. prevents a stale event from resurrecting a deleted entity"), async () => {
    const { repository } = await factory();
    await repository.appendEvent(deletionEvent(22, "ATTEMPT", uuid(122)));
    await assert.rejects(
      repository.appendEvent(answeredEvent(23, { attemptSuffix: 122 })),
      TombstonedEntityError,
    );
    assert.equal(await repository.countEvents(), 1);
  });

  test(title("Q. accepts immutable definition metadata idempotently"), async () => {
    const { repository } = await factory();
    const identity = definition(24);
    assert.equal(await repository.putDefinition(identity), "STORED");
    assert.equal(await repository.putDefinition(identity), "IDEMPOTENT");
    assert.deepEqual(await repository.getDefinition(identity), identity);
    assert.equal(await repository.verifyDefinitionHash(identity, hashA), true);
  });

  test(title("R. rejects a definition hash conflict"), async () => {
    const { repository } = await factory();
    await repository.putDefinition(definition(25, hashA));
    await assert.rejects(repository.putDefinition(definition(25, hashB)), DefinitionConflictError);
  });

  test(title("S. preserves event classification"), async () => {
    const { repository } = await factory();
    const event = answeredEvent(26, { classification: "LOCAL_ONLY" });
    await repository.appendEvent(event);
    assert.equal((await repository.getEventById(event.id))?.classification, "LOCAL_ONLY");
  });

  test(title("T. stores LOCAL_ONLY canonical history without making it syncable"), async () => {
    const { repository } = await factory();
    const event = answeredEvent(27, { classification: "LOCAL_ONLY" });
    await repository.appendEvent(event);
    await assert.rejects(
      repository.appendEventWithOutbox(event, jobFor(event, 327, "local-only", "LOCAL_ONLY")),
      InvalidSyncJobError,
    );
    assert.equal(await repository.hasEvent(event.id), true);
    assert.equal(await repository.countOutboxJobs(), 0);
  });

  test(title("U. blocks UNKNOWN_BLOCKED from the outbox while retaining local truth"), async () => {
    const { repository } = await factory();
    const event = answeredEvent(28, { classification: "UNKNOWN_BLOCKED" });
    await repository.appendEvent(event);
    await assert.rejects(
      repository.appendEventWithOutbox(event, jobFor(event, 328, "unknown", "UNKNOWN_BLOCKED")),
      InvalidSyncJobError,
    );
    assert.equal(await repository.hasEvent(event.id), true);
    assert.equal(await repository.countOutboxJobs(), 0);
  });

  test(title("V. preserves event and job serialization round-trips"), async () => {
    const event = answeredEvent(29);
    const job = jobFor(event, 329);
    assert.deepEqual(deserializeCanonicalEvent(serializeCanonicalEvent(event)), event);
    assert.deepEqual(deserializeSyncQueueJob(serializeSyncQueueJob(job)), job);
  });

  test(title("W. keeps identity/query correctness independent of insertion order"), async () => {
    const left = await factory();
    const right = await factory();
    const first = answeredEvent(30, { occurredAt: 9_000 });
    const second = answeredEvent(31, { occurredAt: 1_000 });
    await left.repository.appendEvent(first);
    await left.repository.appendEvent(second);
    await right.repository.appendEvent(second);
    await right.repository.appendEvent(first);
    assert.deepEqual(await left.repository.getEventById(first.id), await right.repository.getEventById(first.id));
    assert.deepEqual(await left.repository.getEventById(second.id), await right.repository.getEventById(second.id));
    assert.equal(await left.repository.countEvents(), await right.repository.countEvents());
  });

  test(title("also streams exports and stores monotonic named checkpoints"), async () => {
    const { repository } = await factory();
    const first = answeredEvent(32);
    if (first.eventType !== "ATTEMPT_ANSWERED") assert.fail("Expected an ATTEMPT_ANSWERED fixture.");
    const second = answeredEvent(33);
    await repository.appendEvent(first);
    await repository.appendEvent(second);
    const firstPage = await repository.readEventsAfter(null, 1);
    const secondPage = await repository.readEventsAfter(firstPage.checkpoint, 1);
    const checkpointId = createCheckpointId();
    await repository.saveCheckpoint({ id: checkpointId, position: secondPage.checkpoint!, updatedAt: 100 });
    assert.deepEqual(await repository.getCheckpoint(checkpointId), {
      id: checkpointId,
      position: secondPage.checkpoint,
      updatedAt: 100,
    });
    await assert.rejects(
      repository.saveCheckpoint({ id: checkpointId, position: firstPage.checkpoint!, updatedAt: 200 }),
      RepositoryInvariantError,
    );
    const exported: CanonicalEvent[] = [];
    for await (const event of repository.iterateEventsForExport(1)) exported.push(event);
    assert.deepEqual(exported, [first, second]);
    assert.deepEqual(await repository.listReferencedDefinitions(), [first.definitionIdentity]);
  });
}