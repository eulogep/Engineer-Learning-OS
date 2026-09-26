import { createCheckpointId } from "../ids";
import { parseCanonicalEvent, serializeCanonicalEvent } from "../events";
import { definitionIdentityEquals, validateDefinitionIdentity } from "../definitions";
import {
  CanonicalEventConflictError, DefinitionConflictError, InvalidSyncJobError,
  RepositoryInvariantError, SyncJobConflictError, TombstonedEntityError,
} from "../repository-errors";
import { parseSyncQueueJob, serializeSyncQueueJob } from "../sync-job";
import type { SyncQueueJob } from "../sync-job";
import type {
  AppendEventResult, AppendEventWithOutboxResult, CanonicalLearningRepository,
  DefinitionReference, HistoryPage, LocalCheckpoint, RepositoryCheckpoint,
} from "../repository";
import type {
  AttemptId, CanonicalEvent, CanonicalEventType, CheckpointId,
  DefinitionIdentity, EventId, EvidenceId, JobId,
} from "../types";

export const CANONICAL_DATABASE_NAME = "elos-canonical-learning-history";
export const CANONICAL_DATABASE_VERSION = 1;

export type CanonicalStorageFailure =
  | "UNAVAILABLE" | "QUOTA_EXCEEDED" | "ABORTED" | "VERSION_MISMATCH"
  | "UPGRADE_BLOCKED" | "OPEN_TIMEOUT" | "STORAGE_FAILURE";

export class CanonicalStorageError extends RepositoryInvariantError {
  readonly reason: CanonicalStorageFailure;
  constructor(reason: CanonicalStorageFailure) {
    super("Canonical local storage: " + reason);
    this.name = "CanonicalStorageError";
    this.reason = reason;
  }
}

export function mapCanonicalStorageError(error: unknown): RepositoryInvariantError {
  if (error instanceof RepositoryInvariantError) return error;
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  const reason = name === "QuotaExceededError" ? "QUOTA_EXCEEDED"
    : name === "AbortError" ? "ABORTED"
      : name === "VersionError" ? "VERSION_MISMATCH"
        : name === "SecurityError" || name === "NotSupportedError" ? "UNAVAILABLE" : "STORAGE_FAILURE";
  // Browser exception objects and their potentially sensitive messages stay inside the adapter.
  return new CanonicalStorageError(reason);
}

export type CanonicalPersistenceStatus = "PERSISTED" | "BEST_EFFORT" | "UNAVAILABLE";
type PersistenceManager = { persisted?: () => Promise<boolean>; persist?: () => Promise<boolean> };

/** Explicit opt-in only; opening a repository never requests browser permission. */
export async function canonicalPersistenceStatus(
  requestPersistence = false,
  storage: PersistenceManager | undefined = typeof navigator === "undefined" ? undefined : navigator.storage,
): Promise<CanonicalPersistenceStatus> {
  if (!storage) return "UNAVAILABLE";
  try {
    if (await storage.persisted?.()) return "PERSISTED";
    if (requestPersistence && await storage.persist?.()) return "PERSISTED";
  } catch {
    // Denial or unsupported persistence does not disable IndexedDB.
  }
  return "BEST_EFFORT";
}

const EVENTS = "canonicalEvents";
const OUTBOX = "syncQueue";
const CHECKPOINTS = "checkpoints";
const DEFINITIONS = "definitionIdentities";

type EventRecord = {
  position?: number;
  eventId: EventId;
  eventType: CanonicalEventType;
  attemptId?: AttemptId;
  evidenceIds: readonly EvidenceId[];
  definitionKey?: string;
  deletionTarget?: string;
  checkpoint: RepositoryCheckpoint;
  event: CanonicalEvent;
  serialized: string;
};
type JobRecord = { id: JobId; eventId: EventId; idempotencyKey: string; job: SyncQueueJob; serialized: string };
type SavedCheckpoint = LocalCheckpoint & { localPosition: number };
type AtomicPhase = "BEFORE_EVENT_WRITE" | "AFTER_EVENT_WRITE" | "BEFORE_JOB_WRITE" | "AFTER_JOB_WRITE";

function definitionKey(value: DefinitionReference): string {
  return JSON.stringify([value.definitionId, value.definitionVersion]);
}

function references(event: CanonicalEvent): Array<[string, string]> {
  const result: Array<[string, string]> = [["EVENT", event.id]];
  if (event.eventType === "DELETION_REQUESTED") return result;
  result.push(["ATTEMPT", event.attemptId]);
  if (event.eventType === "EVIDENCE_CREATED") result.push(["EVIDENCE", event.payload.evidenceId]);
  if (event.eventType === "ERROR_OBSERVED" && event.payload.evidenceId) result.push(["EVIDENCE", event.payload.evidenceId]);
  if (event.eventType === "REVIEW_COMPLETED") {
    result.push(["REVIEW_RESULT", event.payload.reviewResultId]);
    for (const id of event.payload.sourceEvidenceIds) result.push(["EVIDENCE", id]);
  }
  return result;
}

function recordFor(event: CanonicalEvent): EventRecord {
  return {
    eventId: event.id, eventType: event.eventType, event,
    serialized: serializeCanonicalEvent(event),
    checkpoint: ("idb-checkpoint-" + createCheckpointId()) as RepositoryCheckpoint,
    evidenceIds: [...new Set(references(event).filter(([type]) => type === "EVIDENCE").map(([, id]) => id as EvidenceId))],
    ...(event.eventType === "DELETION_REQUESTED"
      ? { deletionTarget: JSON.stringify([event.payload.targetType, event.payload.targetId]) }
      : { attemptId: event.attemptId, definitionKey: definitionKey(event.definitionIdentity) }),
  };
}

function request<Value>(value: IDBRequest<Value>): Promise<Value> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(mapCanonicalStorageError(value.error));
  });
}

function validateLimit(limit: number): void {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new RepositoryInvariantError("History page limit must be an integer between 1 and 1000.");
  }
}

/** Infrastructure only. No existing learner store or application flow uses this adapter. */
export class IndexedDbCanonicalLearningRepository implements CanonicalLearningRepository {
  private database?: IDBDatabase;
  private opening?: Promise<IDBDatabase>;
  private cancelOpening?: () => void;
  private readonly factory: IDBFactory | undefined;
  readonly databaseName: string;
  private readonly openTimeoutMs: number;

  constructor(options: { databaseName?: string; factory?: IDBFactory; openTimeoutMs?: number } = {}) {
    this.databaseName = options.databaseName ?? CANONICAL_DATABASE_NAME;
    try { this.factory = options.factory ?? globalThis.indexedDB; }
    catch (error) { throw mapCanonicalStorageError(error); }
    this.openTimeoutMs = options.openTimeoutMs ?? 5000;
    if (!this.databaseName.trim() || !Number.isFinite(this.openTimeoutMs) || this.openTimeoutMs <= 0) {
      throw new RepositoryInvariantError("A database name and positive open timeout are required.");
    }
  }

  async initialize(): Promise<void> { await this.connection(); }

  close(): void {
    this.cancelOpening?.();
    this.opening = undefined;
    this.database?.close();
    this.database = undefined;
  }

  private connection(): Promise<IDBDatabase> {
    if (this.database) return Promise.resolve(this.database);
    if (this.opening) return this.opening;
    if (!this.factory) return Promise.reject(new CanonicalStorageError("UNAVAILABLE"));
    const factory = this.factory;
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      let settled = false;
      let openRequest: IDBOpenDBRequest;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.cancelOpening = undefined;
        reject(mapCanonicalStorageError(error));
      };
      const timer = setTimeout(() => fail(new CanonicalStorageError("OPEN_TIMEOUT")), this.openTimeoutMs);
      this.cancelOpening = () => fail(new CanonicalStorageError("ABORTED"));
      try { openRequest = factory.open(this.databaseName, CANONICAL_DATABASE_VERSION); }
      catch (error) { fail(error); return; }
      openRequest.onblocked = () => fail(new CanonicalStorageError("UPGRADE_BLOCKED"));
      openRequest.onerror = () => fail(openRequest.error);
      openRequest.onupgradeneeded = (event) => {
        if (settled) { openRequest.transaction?.abort(); return; }
        try {
          if (event.oldVersion !== 0) throw new CanonicalStorageError("VERSION_MISMATCH");
          const db = openRequest.result;
          const events = db.createObjectStore(EVENTS, { keyPath: "position", autoIncrement: true });
          events.createIndex("eventId", "eventId", { unique: true });
          events.createIndex("checkpoint", "checkpoint", { unique: true });
          events.createIndex("attemptId", "attemptId");
          events.createIndex("evidenceIds", "evidenceIds", { multiEntry: true });
          events.createIndex("eventType", "eventType");
          events.createIndex("definitionKey", "definitionKey");
          events.createIndex("deletionTarget", "deletionTarget");
          const outbox = db.createObjectStore(OUTBOX, { keyPath: "id" });
          outbox.createIndex("eventId", "eventId", { unique: true });
          outbox.createIndex("idempotencyKey", "idempotencyKey", { unique: true });
          db.createObjectStore(CHECKPOINTS, { keyPath: "id" });
          db.createObjectStore(DEFINITIONS, { keyPath: ["definitionId", "definitionVersion"] });
        } catch (error) { openRequest.transaction?.abort(); fail(error); }
      };
      openRequest.onsuccess = () => {
        const db = openRequest.result;
        if (settled) { db.close(); return; }
        settled = true;
        clearTimeout(timer);
        this.cancelOpening = undefined;
        db.onversionchange = () => {
          db.close();
          if (this.database === db) this.database = undefined;
        };
        db.onclose = () => { if (this.database === db) this.database = undefined; };
        this.database = db;
        resolve(db);
      };
    });
    this.opening = pending;
    void pending.then(
      () => { if (this.opening === pending) this.opening = undefined; },
      () => { if (this.opening === pending) this.opening = undefined; },
    );
    return pending;
  }

  private async transaction<Value>(stores: string[], mode: IDBTransactionMode,
    operation: (transaction: IDBTransaction) => Promise<Value>): Promise<Value> {
    try {
      const db = await this.connection();
      const tx = db.transaction(stores, mode);
      const completion = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(mapCanonicalStorageError(tx.error ?? { name: "AbortError" }));
        // Request errors abort by default; settlement must wait for onabort/oncomplete.
        tx.onerror = () => {};
      });
      // Attach immediately, including when an IDB request rejects first.
      void completion.catch(() => {});
      try {
        // Only IDB requests are awaited inside operations: no network, timers or arbitrary async work.
        const result = await operation(tx);
        await completion;
        return result;
      } catch (error) {
        try { tx.abort(); } catch { /* Already aborted/completed. */ }
        await completion.catch(() => {});
        throw error;
      }
    } catch (error) { throw mapCanonicalStorageError(error); }
  }

  private parseEvent(value: CanonicalEvent): CanonicalEvent {
    try { return parseCanonicalEvent(value); }
    catch { throw new RepositoryInvariantError("Canonical event failed runtime validation."); }
  }

  private async append(tx: IDBTransaction, event: CanonicalEvent): Promise<AppendEventResult> {
    const store = tx.objectStore(EVENTS);
    const existing: EventRecord | undefined = await request(store.index("eventId").get(event.id));
    if (existing) {
      if (existing.serialized !== serializeCanonicalEvent(event)) throw new CanonicalEventConflictError(event.id);
      return { eventStatus: "IDEMPOTENT", checkpoint: existing.checkpoint };
    }
    if (event.eventType !== "DELETION_REQUESTED") {
      for (const [type, id] of references(event)) {
        if (await request(store.index("deletionTarget").count(JSON.stringify([type, id])))) {
          throw new TombstonedEntityError(type, id);
        }
      }
    }
    const record = recordFor(event);
    await request(store.add(record));
    return { eventStatus: "APPENDED", checkpoint: record.checkpoint };
  }

  async appendEvent(value: CanonicalEvent): Promise<AppendEventResult> {
    const event = this.parseEvent(value);
    return this.transaction([EVENTS], "readwrite", (tx) => this.append(tx, event));
  }

  /** Synchronous seam for test subclasses only; no public runtime failure switch. */
  protected onAtomicWritePhase(_phase: AtomicPhase): void {}

  async appendEventWithOutbox(value: CanonicalEvent, jobValue: SyncQueueJob): Promise<AppendEventWithOutboxResult> {
    const event = this.parseEvent(value);
    let job: SyncQueueJob;
    try { job = parseSyncQueueJob(jobValue); }
    catch { throw new InvalidSyncJobError("Sync queue job failed runtime validation."); }
    if (job.eventId !== event.id) throw new InvalidSyncJobError("Sync queue job must reference its atomic event.");
    if (event.classification !== "SYNC_ALLOWED" || job.classification !== "SYNC_ALLOWED") {
      throw new InvalidSyncJobError("Only SYNC_ALLOWED events may create an outbox job.");
    }
    return this.transaction([EVENTS, OUTBOX], "readwrite", async (tx) => {
      this.onAtomicWritePhase("BEFORE_EVENT_WRITE");
      const result = await this.append(tx, event);
      this.onAtomicWritePhase("AFTER_EVENT_WRITE");
      const store = tx.objectStore(OUTBOX);
      const serialized = serializeSyncQueueJob(job);
      const existing: JobRecord | undefined = await request(store.get(job.id));
      if (existing) {
        if (existing.serialized !== serialized) throw new SyncJobConflictError(job.id);
        return { ...result, outboxStatus: "IDEMPOTENT" };
      }
      if (await request(store.index("eventId").count(job.eventId))) throw new SyncJobConflictError(job.eventId);
      if (await request(store.index("idempotencyKey").count(job.idempotencyKey))) throw new SyncJobConflictError(job.idempotencyKey);
      this.onAtomicWritePhase("BEFORE_JOB_WRITE");
      await request(store.add({ id: job.id, eventId: job.eventId, idempotencyKey: job.idempotencyKey, job, serialized } satisfies JobRecord));
      this.onAtomicWritePhase("AFTER_JOB_WRITE");
      return { ...result, outboxStatus: "APPENDED" };
    });
  }

  async getEventById(id: EventId): Promise<CanonicalEvent | null> {
    return this.transaction([EVENTS], "readonly", async (tx) => {
      const record: EventRecord | undefined = await request(tx.objectStore(EVENTS).index("eventId").get(id));
      return record ? this.parseEvent(record.event) : null;
    });
  }
  async hasEvent(id: EventId): Promise<boolean> { return (await this.getEventById(id)) !== null; }
  async countEvents(): Promise<number> {
    return this.transaction([EVENTS], "readonly", (tx) => request(tx.objectStore(EVENTS).count()));
  }

  private query(index: string, key: IDBValidKey): Promise<readonly CanonicalEvent[]> {
    return this.transaction([EVENTS], "readonly", async (tx) => {
      const records: EventRecord[] = await request(tx.objectStore(EVENTS).index(index).getAll(key));
      return Object.freeze(records.map((record) => this.parseEvent(record.event)));
    });
  }
  readEventsByAttemptId(id: AttemptId): Promise<readonly CanonicalEvent[]> { return this.query("attemptId", id); }
  readEventsByEvidenceId(id: EvidenceId): Promise<readonly CanonicalEvent[]> { return this.query("evidenceIds", id); }
  readEventsByType(type: CanonicalEventType): Promise<readonly CanonicalEvent[]> { return this.query("eventType", type); }
  readTombstones(): Promise<readonly CanonicalEvent[]> { return this.readEventsByType("DELETION_REQUESTED"); }

  private async position(store: IDBObjectStore, checkpoint: RepositoryCheckpoint): Promise<number> {
    const record: EventRecord | undefined = await request(store.index("checkpoint").get(checkpoint));
    if (record?.position === undefined) throw new RepositoryInvariantError("Unknown repository checkpoint.");
    return record.position;
  }
  async readEventsAfter(checkpoint: RepositoryCheckpoint | null, limit: number): Promise<HistoryPage> {
    validateLimit(limit);
    return this.transaction([EVENTS], "readonly", async (tx) => {
      const store = tx.objectStore(EVENTS);
      const position = checkpoint === null ? 0 : await this.position(store, checkpoint);
      const records: EventRecord[] = await request(store.getAll(IDBKeyRange.lowerBound(position, true), limit + 1));
      const page = records.slice(0, limit);
      return Object.freeze({ events: Object.freeze(page.map((record) => this.parseEvent(record.event))),
        checkpoint: page.at(-1)?.checkpoint ?? checkpoint, hasMore: records.length > limit });
    });
  }
  async *iterateEventsForExport(batchSize = 100): AsyncIterable<CanonicalEvent> {
    validateLimit(batchSize);
    let checkpoint: RepositoryCheckpoint | null = null;
    for (;;) {
      const page = await this.readEventsAfter(checkpoint, batchSize);
      for (const event of page.events) yield event;
      if (!page.hasMore) return;
      checkpoint = page.checkpoint;
    }
  }

  async getOutboxJobById(id: JobId): Promise<SyncQueueJob | null> {
    return this.transaction([OUTBOX], "readonly", async (tx) => {
      const record: JobRecord | undefined = await request(tx.objectStore(OUTBOX).get(id));
      return record ? parseSyncQueueJob(record.job) : null;
    });
  }
  async getOutboxJobByEventId(id: EventId): Promise<SyncQueueJob | null> {
    return this.transaction([OUTBOX], "readonly", async (tx) => {
      const record: JobRecord | undefined = await request(tx.objectStore(OUTBOX).index("eventId").get(id));
      return record ? parseSyncQueueJob(record.job) : null;
    });
  }
  async countOutboxJobs(): Promise<number> {
    return this.transaction([OUTBOX], "readonly", (tx) => request(tx.objectStore(OUTBOX).count()));
  }

  async *iterateOutboxJobsForRecovery(batchSize = 100): AsyncIterable<SyncQueueJob> {
    validateLimit(batchSize);
    let after: IDBValidKey | undefined;
    for (;;) {
      const records = await this.transaction([OUTBOX], "readonly", (tx) => request(
        tx.objectStore(OUTBOX).getAll(after === undefined ? undefined : IDBKeyRange.lowerBound(after, true), batchSize),
      )) as JobRecord[];
      for (const record of records) yield parseSyncQueueJob(record.job);
      if (records.length < batchSize) return;
      after = records.at(-1)!.id;
    }
  }

  async *iterateDefinitionsForRecovery(batchSize = 100): AsyncIterable<DefinitionIdentity> {
    validateLimit(batchSize);
    let after: IDBValidKey | undefined;
    for (;;) {
      const identities = await this.transaction([DEFINITIONS], "readonly", (tx) => request(
        tx.objectStore(DEFINITIONS).getAll(
          after === undefined ? undefined : IDBKeyRange.lowerBound(after, true), batchSize,
        ),
      )) as DefinitionIdentity[];
      for (const identity of identities) yield validateDefinitionIdentity(identity);
      if (identities.length < batchSize) return;
      const last = identities.at(-1)!;
      after = [last.definitionId, last.definitionVersion];
    }
  }

  async putDefinition(value: DefinitionIdentity): Promise<"STORED" | "IDEMPOTENT"> {
    let identity: DefinitionIdentity;
    try { identity = validateDefinitionIdentity(value); }
    catch { throw new RepositoryInvariantError("Definition identity failed runtime validation."); }
    return this.transaction([DEFINITIONS], "readwrite", async (tx) => {
      const store = tx.objectStore(DEFINITIONS);
      const existing: DefinitionIdentity | undefined = await request(store.get([identity.definitionId, identity.definitionVersion]));
      if (existing) {
        if (!definitionIdentityEquals(existing, identity)) throw new DefinitionConflictError(identity.definitionId, identity.definitionVersion);
        return "IDEMPOTENT";
      }
      await request(store.add(identity));
      return "STORED";
    });
  }
  async getDefinition(reference: DefinitionReference): Promise<DefinitionIdentity | null> {
    return this.transaction([DEFINITIONS], "readonly", async (tx) => {
      const value = await request(tx.objectStore(DEFINITIONS).get([reference.definitionId, reference.definitionVersion]));
      return value ? validateDefinitionIdentity(value) : null;
    });
  }
  async verifyDefinitionHash(reference: DefinitionReference, hash: string): Promise<boolean> {
    return (await this.getDefinition(reference))?.definitionHash === hash;
  }
  async listReferencedDefinitions(): Promise<readonly DefinitionIdentity[]> {
    return this.transaction([EVENTS], "readonly", async (tx) => {
      const result: Array<{ identity: DefinitionIdentity; position: number }> = [];
      const cursor = tx.objectStore(EVENTS).index("definitionKey").openCursor(null, "nextunique");
      await new Promise<void>((resolve, reject) => {
        cursor.onerror = () => reject(mapCanonicalStorageError(cursor.error));
        cursor.onsuccess = () => {
          try {
            if (!cursor.result) { resolve(); return; }
            const record: EventRecord = cursor.result.value;
            const event = this.parseEvent(record.event);
            if (event.eventType !== "DELETION_REQUESTED") result.push({ identity: event.definitionIdentity, position: record.position! });
            cursor.result.continue();
          } catch (error) { reject(error); }
        };
      });
      return Object.freeze(result.sort((left, right) => left.position - right.position).map((entry) => entry.identity));
    });
  }
  async saveCheckpoint(checkpoint: LocalCheckpoint): Promise<void> {
    const snapshot = { ...checkpoint };
    if (!Number.isSafeInteger(snapshot.updatedAt) || snapshot.updatedAt < 0) {
      throw new RepositoryInvariantError("Checkpoint updatedAt must be a non-negative safe integer.");
    }
    return this.transaction([EVENTS, CHECKPOINTS], "readwrite", async (tx) => {
      const localPosition = await this.position(tx.objectStore(EVENTS), snapshot.position);
      const store = tx.objectStore(CHECKPOINTS);
      const existing: SavedCheckpoint | undefined = await request(store.get(snapshot.id));
      if (existing && localPosition < existing.localPosition) throw new RepositoryInvariantError("Checkpoint cannot move backwards.");
      await request(store.put({ ...snapshot, localPosition } satisfies SavedCheckpoint));
    });
  }
  async getCheckpoint(id: CheckpointId): Promise<LocalCheckpoint | null> {
    return this.transaction([CHECKPOINTS], "readonly", async (tx) => {
      const value: SavedCheckpoint | undefined = await request(tx.objectStore(CHECKPOINTS).get(id));
      return value ? Object.freeze({ id: value.id, position: value.position, updatedAt: value.updatedAt }) : null;
    });
  }
}
