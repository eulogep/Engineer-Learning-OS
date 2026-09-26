export class RepositoryInvariantError extends Error {
  readonly code = "REPOSITORY_INVARIANT";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RepositoryInvariantError";
  }
}

export class CanonicalEventConflictError extends RepositoryInvariantError {
  readonly eventId: string;

  constructor(eventId: string) {
    super("Canonical event " + eventId + " already exists with different content.");
    this.name = "CanonicalEventConflictError";
    this.eventId = eventId;
  }
}

export class DefinitionConflictError extends RepositoryInvariantError {
  readonly definitionId: string;
  readonly definitionVersion: number;

  constructor(definitionId: string, definitionVersion: number) {
    super("Definition " + definitionId + "@" + definitionVersion + " is immutable and already has different content.");
    this.name = "DefinitionConflictError";
    this.definitionId = definitionId;
    this.definitionVersion = definitionVersion;
  }
}

export class InvalidSyncJobError extends RepositoryInvariantError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "InvalidSyncJobError";
  }
}

export class SyncJobConflictError extends RepositoryInvariantError {
  readonly identity: string;

  constructor(identity: string) {
    super("Sync job identity " + identity + " already exists with different content.");
    this.name = "SyncJobConflictError";
    this.identity = identity;
  }
}

export class TombstonedEntityError extends RepositoryInvariantError {
  readonly targetType: string;
  readonly targetId: string;

  constructor(targetType: string, targetId: string) {
    super("A stale event cannot recreate deleted " + targetType + " " + targetId + ".");
    this.name = "TombstonedEntityError";
    this.targetType = targetType;
    this.targetId = targetId;
  }
}