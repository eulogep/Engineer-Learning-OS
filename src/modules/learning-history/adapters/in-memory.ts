import {
  CanonicalEventConflictError,
  DefinitionConflictError,
  InvalidSyncJobError,
  RepositoryInvariantError,
  SyncJobConflictError,
  TombstonedEntityError,
} from "../repository-errors";
import type {
  AppendEventResult,
  AppendEventWithOutboxResult,
  CanonicalLearningRepository,
  DefinitionReference,
  HistoryPage,
  LocalCheckpoint,
  RepositoryCheckpoint,
} from "../repository";
import {
  parseSyncQueueJob,
  serializeSyncQueueJob,
} from "../sync-job";
import type { SyncQueueJob } from "../sync-job";
import {
  parseCanonicalEvent,
  serializeCanonicalEvent,
} from "../events";
import {
  definitionIdentityEquals,
  validateDefinitionIdentity,
} from "../definitions";
import type {
  AttemptId,
  CanonicalEvent,
  CanonicalEventType,
  CheckpointId,
  DefinitionIdentity,
  EventId,
  EvidenceId,
  JobId,
} from "../types";

type StoredEvent = Readonly<{
  event: CanonicalEvent;
  serialized: string;
  position: number;
}>;

type StoredJob = Readonly<{
  job: SyncQueueJob;
  serialized: string;
}>;

type RepositoryState = {
  events: Map<EventId, StoredEvent>;
  eventOrder: EventId[];
  jobs: Map<JobId, StoredJob>;
  jobByEvent: Map<EventId, JobId>;
  jobByIdempotencyKey: Map<string, JobId>;
  tombstones: Set<string>;
  definitions: Map<string, DefinitionIdentity>;
  checkpointByPosition: Map<number, RepositoryCheckpoint>;
  positionByCheckpoint: Map<RepositoryCheckpoint, number>;
  savedCheckpoints: Map<CheckpointId, LocalCheckpoint>;
};

function emptyState(): RepositoryState {
  return {
    events: new Map(),
    eventOrder: [],
    jobs: new Map(),
    jobByEvent: new Map(),
    jobByIdempotencyKey: new Map(),
    tombstones: new Set(),
    definitions: new Map(),
    checkpointByPosition: new Map(),
    positionByCheckpoint: new Map(),
    savedCheckpoints: new Map(),
  };
}

function cloneState(source: RepositoryState): RepositoryState {
  return {
    events: new Map(source.events),
    eventOrder: [...source.eventOrder],
    jobs: new Map(source.jobs),
    jobByEvent: new Map(source.jobByEvent),
    jobByIdempotencyKey: new Map(source.jobByIdempotencyKey),
    tombstones: new Set(source.tombstones),
    definitions: new Map(source.definitions),
    checkpointByPosition: new Map(source.checkpointByPosition),
    positionByCheckpoint: new Map(source.positionByCheckpoint),
    savedCheckpoints: new Map(source.savedCheckpoints),
  };
}

function definitionKey(reference: DefinitionReference | DefinitionIdentity): string {
  return reference.definitionId + "@" + reference.definitionVersion;
}

function tombstoneKey(targetType: string, targetId: string): string {
  return targetType + ":" + targetId;
}

function logicalReferences(event: CanonicalEvent): readonly Readonly<{ targetType: string; targetId: string }>[] {
  const references: Array<Readonly<{ targetType: string; targetId: string }>> = [
    { targetType: "EVENT", targetId: event.id },
  ];
  if (event.eventType === "DELETION_REQUESTED") return references;

  references.push({ targetType: "ATTEMPT", targetId: event.attemptId });
  if (event.eventType === "EVIDENCE_CREATED") {
    references.push({ targetType: "EVIDENCE", targetId: event.payload.evidenceId });
  }
  if (event.eventType === "ERROR_OBSERVED" && event.payload.evidenceId) {
    references.push({ targetType: "EVIDENCE", targetId: event.payload.evidenceId });
  }
  if (event.eventType === "REVIEW_COMPLETED") {
    references.push({ targetType: "REVIEW_RESULT", targetId: event.payload.reviewResultId });
    for (const evidenceId of event.payload.sourceEvidenceIds) {
      references.push({ targetType: "EVIDENCE", targetId: evidenceId });
    }
  }
  return references;
}

function referencesEvidence(event: CanonicalEvent, evidenceId: EvidenceId): boolean {
  if (event.eventType === "EVIDENCE_CREATED") return event.payload.evidenceId === evidenceId;
  if (event.eventType === "ERROR_OBSERVED") return event.payload.evidenceId === evidenceId;
  if (event.eventType === "REVIEW_COMPLETED") return event.payload.sourceEvidenceIds.includes(evidenceId);
  return false;
}

function parseEventBoundary(value: CanonicalEvent): CanonicalEvent {
  try {
    return parseCanonicalEvent(value);
  } catch (cause) {
    throw new RepositoryInvariantError("Canonical event failed runtime validation.", { cause });
  }
}

function parseJobBoundary(value: SyncQueueJob): SyncQueueJob {
  try {
    return parseSyncQueueJob(value);
  } catch (cause) {
    throw new InvalidSyncJobError("Sync queue job failed runtime validation.", { cause });
  }
}

function validateLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1_000) {
    throw new RepositoryInvariantError("History page limit must be an integer between 1 and 1000.");
  }
}

export class InMemoryCanonicalLearningRepository implements CanonicalLearningRepository {
  private state = emptyState();
  private failAfterEventBeforeOutbox = false;

  /** Test-only fault hook used by the reusable conformance suite. */
  failNextAtomicWriteAfterEvent(): void {
    this.failAfterEventBeforeOutbox = true;
  }

  private checkpointFor(state: RepositoryState, position: number): RepositoryCheckpoint {
    const existing = state.checkpointByPosition.get(position);
    if (existing) return existing;
    const checkpoint = ("memory-checkpoint-" + position.toString(36).padStart(8, "0")) as RepositoryCheckpoint;
    state.checkpointByPosition.set(position, checkpoint);
    state.positionByCheckpoint.set(checkpoint, position);
    return checkpoint;
  }

  private positionFor(state: RepositoryState, checkpoint: RepositoryCheckpoint | null): number {
    if (checkpoint === null) return 0;
    const position = state.positionByCheckpoint.get(checkpoint);
    if (position === undefined) {
      throw new RepositoryInvariantError("Checkpoint is unknown to this repository.");
    }
    return position;
  }

  private assertNotTombstoned(state: RepositoryState, event: CanonicalEvent): void {
    if (event.eventType === "DELETION_REQUESTED") return;
    for (const reference of logicalReferences(event)) {
      if (state.tombstones.has(tombstoneKey(reference.targetType, reference.targetId))) {
        throw new TombstonedEntityError(reference.targetType, reference.targetId);
      }
    }
  }

  private appendEventTo(state: RepositoryState, event: CanonicalEvent): AppendEventResult {
    const serialized = serializeCanonicalEvent(event);
    const existing = state.events.get(event.id);
    if (existing) {
      if (existing.serialized !== serialized) throw new CanonicalEventConflictError(event.id);
      return {
        eventStatus: "IDEMPOTENT",
        checkpoint: this.checkpointFor(state, existing.position),
      };
    }

    this.assertNotTombstoned(state, event);
    const position = state.eventOrder.length + 1;
    state.events.set(event.id, { event, serialized, position });
    state.eventOrder.push(event.id);
    if (event.eventType === "DELETION_REQUESTED") {
      state.tombstones.add(tombstoneKey(event.payload.targetType, event.payload.targetId));
    }
    return {
      eventStatus: "APPENDED",
      checkpoint: this.checkpointFor(state, position),
    };
  }

  private validateJobForEvent(event: CanonicalEvent, job: SyncQueueJob): void {
    if (job.eventId !== event.id) {
      throw new InvalidSyncJobError("Sync queue job must reference the event committed in the same operation.");
    }
    if (event.classification !== "SYNC_ALLOWED" || job.classification !== "SYNC_ALLOWED") {
      throw new InvalidSyncJobError("Only SYNC_ALLOWED events may create an outbox job.");
    }
    if (job.classification !== event.classification) {
      throw new InvalidSyncJobError("Event and sync queue job classifications must match.");
    }
  }

  private appendJobTo(state: RepositoryState, job: SyncQueueJob): "APPENDED" | "IDEMPOTENT" {
    const serialized = serializeSyncQueueJob(job);
    const existing = state.jobs.get(job.id);
    if (existing) {
      if (existing.serialized !== serialized) throw new SyncJobConflictError(job.id);
      return "IDEMPOTENT";
    }

    const byEvent = state.jobByEvent.get(job.eventId);
    if (byEvent) throw new SyncJobConflictError(job.eventId);
    const byKey = state.jobByIdempotencyKey.get(job.idempotencyKey);
    if (byKey) throw new SyncJobConflictError(job.idempotencyKey);

    state.jobs.set(job.id, { job, serialized });
    state.jobByEvent.set(job.eventId, job.id);
    state.jobByIdempotencyKey.set(job.idempotencyKey, job.id);
    return "APPENDED";
  }

  async appendEvent(value: CanonicalEvent): Promise<AppendEventResult> {
    const event = parseEventBoundary(value);
    const staged = cloneState(this.state);
    const result = this.appendEventTo(staged, event);
    this.state = staged;
    return Object.freeze(result);
  }

  async appendEventWithOutbox(
    eventValue: CanonicalEvent,
    jobValue: SyncQueueJob,
  ): Promise<AppendEventWithOutboxResult> {
    const event = parseEventBoundary(eventValue);
    const job = parseJobBoundary(jobValue);
    this.validateJobForEvent(event, job);

    const staged = cloneState(this.state);
    const eventResult = this.appendEventTo(staged, event);
    if (this.failAfterEventBeforeOutbox) {
      this.failAfterEventBeforeOutbox = false;
      throw new RepositoryInvariantError("Injected failure after staged event and before staged outbox job.");
    }
    const outboxStatus = this.appendJobTo(staged, job);
    this.state = staged;
    return Object.freeze({ ...eventResult, outboxStatus });
  }

  async getEventById(eventId: EventId): Promise<CanonicalEvent | null> {
    return this.state.events.get(eventId)?.event ?? null;
  }

  async hasEvent(eventId: EventId): Promise<boolean> {
    return this.state.events.has(eventId);
  }

  async readEventsAfter(
    checkpoint: RepositoryCheckpoint | null,
    limit: number,
  ): Promise<HistoryPage> {
    validateLimit(limit);
    const start = this.positionFor(this.state, checkpoint);
    const ids = this.state.eventOrder.slice(start, start + limit);
    const events = ids.map((id) => this.state.events.get(id)!.event);
    const position = start + events.length;
    return Object.freeze({
      events: Object.freeze(events),
      checkpoint: events.length > 0 ? this.checkpointFor(this.state, position) : checkpoint,
      hasMore: position < this.state.eventOrder.length,
    });
  }

  async readEventsByAttemptId(attemptId: AttemptId): Promise<readonly CanonicalEvent[]> {
    return Object.freeze(this.eventsInOrder().filter(
      (event) => event.eventType !== "DELETION_REQUESTED" && event.attemptId === attemptId,
    ));
  }

  async readEventsByEvidenceId(evidenceId: EvidenceId): Promise<readonly CanonicalEvent[]> {
    return Object.freeze(this.eventsInOrder().filter((event) => referencesEvidence(event, evidenceId)));
  }

  async readEventsByType(eventType: CanonicalEventType): Promise<readonly CanonicalEvent[]> {
    return Object.freeze(this.eventsInOrder().filter((event) => event.eventType === eventType));
  }

  async readTombstones(): Promise<readonly CanonicalEvent[]> {
    return this.readEventsByType("DELETION_REQUESTED");
  }

  async countEvents(): Promise<number> {
    return this.state.eventOrder.length;
  }

  async *iterateEventsForExport(batchSize = 100): AsyncIterable<CanonicalEvent> {
    validateLimit(batchSize);
    let checkpoint: RepositoryCheckpoint | null = null;
    do {
      const page = await this.readEventsAfter(checkpoint, batchSize);
      for (const event of page.events) yield event;
      checkpoint = page.checkpoint;
      if (!page.hasMore) return;
    } while (checkpoint);
  }

  async getOutboxJobById(jobId: JobId): Promise<SyncQueueJob | null> {
    return this.state.jobs.get(jobId)?.job ?? null;
  }

  async getOutboxJobByEventId(eventId: EventId): Promise<SyncQueueJob | null> {
    const jobId = this.state.jobByEvent.get(eventId);
    return jobId ? this.state.jobs.get(jobId)?.job ?? null : null;
  }

  async countOutboxJobs(): Promise<number> {
    return this.state.jobs.size;
  }

  async *iterateOutboxJobsForRecovery(): AsyncIterable<SyncQueueJob> {
    for (const stored of this.state.jobs.values()) yield stored.job;
  }

  async *iterateDefinitionsForRecovery(): AsyncIterable<DefinitionIdentity> {
    for (const identity of this.state.definitions.values()) yield identity;
  }

  async putDefinition(value: DefinitionIdentity): Promise<"STORED" | "IDEMPOTENT"> {
    let identity: DefinitionIdentity;
    try {
      identity = validateDefinitionIdentity(value);
    } catch (cause) {
      throw new RepositoryInvariantError("Definition identity failed runtime validation.", { cause });
    }
    const key = definitionKey(identity);
    const existing = this.state.definitions.get(key);
    if (existing) {
      if (!definitionIdentityEquals(existing, identity)) {
        throw new DefinitionConflictError(identity.definitionId, identity.definitionVersion);
      }
      return "IDEMPOTENT";
    }
    const staged = cloneState(this.state);
    staged.definitions.set(key, identity);
    this.state = staged;
    return "STORED";
  }

  async getDefinition(reference: DefinitionReference): Promise<DefinitionIdentity | null> {
    return this.state.definitions.get(definitionKey(reference)) ?? null;
  }

  async verifyDefinitionHash(reference: DefinitionReference, expectedHash: string): Promise<boolean> {
    const identity = await this.getDefinition(reference);
    return identity?.definitionHash === expectedHash;
  }

  async listReferencedDefinitions(): Promise<readonly DefinitionIdentity[]> {
    const found = new Map<string, DefinitionIdentity>();
    for (const event of this.eventsInOrder()) {
      if (event.eventType !== "DELETION_REQUESTED") {
        found.set(definitionKey(event.definitionIdentity), event.definitionIdentity);
      }
    }
    return Object.freeze([...found.values()]);
  }

  async saveCheckpoint(checkpoint: LocalCheckpoint): Promise<void> {
    const position = this.state.positionByCheckpoint.get(checkpoint.position);
    if (position === undefined) throw new RepositoryInvariantError("Cannot save an unknown repository checkpoint.");
    if (!Number.isSafeInteger(checkpoint.updatedAt) || checkpoint.updatedAt < 0) {
      throw new RepositoryInvariantError("Checkpoint updatedAt must be a non-negative safe integer.");
    }

    const existing = this.state.savedCheckpoints.get(checkpoint.id);
    if (existing) {
      const previousPosition = this.positionFor(this.state, existing.position);
      if (position < previousPosition) throw new RepositoryInvariantError("Checkpoint cannot move backwards.");
    }
    const staged = cloneState(this.state);
    staged.savedCheckpoints.set(checkpoint.id, Object.freeze({ ...checkpoint }));
    this.state = staged;
  }

  async getCheckpoint(checkpointId: CheckpointId): Promise<LocalCheckpoint | null> {
    return this.state.savedCheckpoints.get(checkpointId) ?? null;
  }

  private eventsInOrder(): CanonicalEvent[] {
    return this.state.eventOrder.map((id) => this.state.events.get(id)!.event);
  }
}
