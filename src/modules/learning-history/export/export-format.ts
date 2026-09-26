import type { CanonicalLearningRepository } from "../repository";
import type { SyncQueueJob } from "../sync-job";
import type { CanonicalClassification, DefinitionIdentity } from "../types";

export const ELOS_EXPORT_FORMAT_VERSION = 1;
export const ELOS_PROGRAM = "ENGINEER_LEARNING_OS_V1";
export const EXPORT_PATHS = Object.freeze({
  manifest: "manifest.json",
  events: "canonical-events.ndjson",
  outbox: "sync-queue.ndjson",
  definitions: "definitions.ndjson",
  references: "local-references.ndjson",
});

export type RecoveryFileEntry = Readonly<{
  path: string;
  recordCount: number;
  sha256: string;
  byteLength: number;
}>;

export type ExportSecurityClassification = Readonly<{
  containsPersonalMetadata: boolean;
  containsLocalOnlyMetadata: boolean;
  containsCompanyRestrictedMetadata: boolean;
  warning: "SENSITIVE_PEDAGOGICAL_METADATA_LOCAL_RECOVERY_ONLY";
}>;

export type ClassificationSummary = Readonly<Record<CanonicalClassification, number>>;

export type RecoveryManifest = Readonly<{
  exportFormatVersion: 1;
  program: typeof ELOS_PROGRAM;
  exportId: string;
  createdAt: number;
  schemaVersion: 1;
  sourceDatabaseVersion: number;
  canonicalEventCount: number;
  syncQueueCount: number;
  definitionCount: number;
  checkpointCount: 0;
  localReferenceCount: number;
  classificationSummary: ClassificationSummary;
  fileEntries: readonly RecoveryFileEntry[];
  overallDigest: string;
  canonicalHistoryDigest: string;
  checkpointStrategy: "RECONSTRUCT_LOCAL_POSITIONS";
  localReferencePolicy: "METADATA_ONLY_REQUIRES_RELINK";
  exportSecurityClassification: ExportSecurityClassification;
}>;

export type RecoveryBundle = Readonly<Record<string, string>>;

export interface CanonicalRecoveryRepository extends CanonicalLearningRepository {
  iterateOutboxJobsForRecovery(batchSize?: number): AsyncIterable<SyncQueueJob>;
  iterateDefinitionsForRecovery(batchSize?: number): AsyncIterable<DefinitionIdentity>;
}

export type LocalReferenceRecoveryRecord = Readonly<{
  referenceId: string;
  storagePolicy: "LOCAL_ONLY" | "REMOTE_ENCRYPTED_FUTURE";
  contentIncluded: false;
  sha256?: string;
  restoreStatus: "REQUIRES_RELINK";
}>;

export type RecoveryFailure =
  | "MISSING_MANIFEST" | "MISSING_REQUIRED_FILE" | "UNSUPPORTED_EXPORT_VERSION"
  | "CHECKSUM_MISMATCH" | "INVALID_ARCHIVE" | "CROSS_REFERENCE_FAILURE"
  | "TARGET_CONFLICT" | "EXPORT_POLICY_BLOCKED" | "RESTORE_VERIFICATION_FAILED";

export class RecoveryError extends Error {
  readonly code: RecoveryFailure;
  constructor(code: RecoveryFailure) {
    super("Canonical recovery: " + code);
    this.name = "RecoveryError";
    this.code = code;
  }
}
