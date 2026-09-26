import type {
  AttemptId,
  CanonicalEvent,
  CanonicalEventType,
  CheckpointId,
  DefinitionId,
  DefinitionIdentity,
  EventId,
  EvidenceId,
  JobId,
} from "./types";
import type { SyncQueueJob } from "./sync-job";

declare const repositoryCheckpointBrand: unique symbol;

export type RepositoryCheckpoint = string & {
  readonly [repositoryCheckpointBrand]: "RepositoryCheckpoint";
};

export type AppendEventResult = Readonly<{
  eventStatus: "APPENDED" | "IDEMPOTENT";
  checkpoint: RepositoryCheckpoint;
}>;

export type AppendEventWithOutboxResult = AppendEventResult & Readonly<{
  outboxStatus: "APPENDED" | "IDEMPOTENT";
}>;

export type HistoryPage = Readonly<{
  events: readonly CanonicalEvent[];
  checkpoint: RepositoryCheckpoint | null;
  hasMore: boolean;
}>;

export type DefinitionReference = Readonly<{
  definitionId: DefinitionId;
  definitionVersion: number;
}>;

export type LocalCheckpoint = Readonly<{
  id: CheckpointId;
  position: RepositoryCheckpoint;
  updatedAt: number;
}>;

export interface CanonicalHistoryRepository {
  appendEvent(event: CanonicalEvent): Promise<AppendEventResult>;
  appendEventWithOutbox(event: CanonicalEvent, job: SyncQueueJob): Promise<AppendEventWithOutboxResult>;
  getEventById(eventId: EventId): Promise<CanonicalEvent | null>;
  hasEvent(eventId: EventId): Promise<boolean>;
  readEventsAfter(checkpoint: RepositoryCheckpoint | null, limit: number): Promise<HistoryPage>;
  readEventsByAttemptId(attemptId: AttemptId): Promise<readonly CanonicalEvent[]>;
  readEventsByEvidenceId(evidenceId: EvidenceId): Promise<readonly CanonicalEvent[]>;
  readEventsByType(eventType: CanonicalEventType): Promise<readonly CanonicalEvent[]>;
  readTombstones(): Promise<readonly CanonicalEvent[]>;
  countEvents(): Promise<number>;
  iterateEventsForExport(batchSize?: number): AsyncIterable<CanonicalEvent>;
  getOutboxJobById(jobId: JobId): Promise<SyncQueueJob | null>;
  getOutboxJobByEventId(eventId: EventId): Promise<SyncQueueJob | null>;
  countOutboxJobs(): Promise<number>;
}

export interface DefinitionRepository {
  putDefinition(identity: DefinitionIdentity): Promise<"STORED" | "IDEMPOTENT">;
  getDefinition(reference: DefinitionReference): Promise<DefinitionIdentity | null>;
  verifyDefinitionHash(reference: DefinitionReference, expectedHash: string): Promise<boolean>;
  listReferencedDefinitions(): Promise<readonly DefinitionIdentity[]>;
}

export interface CheckpointRepository {
  saveCheckpoint(checkpoint: LocalCheckpoint): Promise<void>;
  getCheckpoint(checkpointId: CheckpointId): Promise<LocalCheckpoint | null>;
}

export interface CanonicalLearningRepository
  extends CanonicalHistoryRepository, DefinitionRepository, CheckpointRepository {}