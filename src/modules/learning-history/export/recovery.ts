import { validateDefinitionIdentity } from "../definitions";
import { parseCanonicalEvent } from "../events";
import { parseSyncQueueJob } from "../sync-job";
import { UUIDV7_CANONICAL_PATTERN } from "../schemas";
import type { SyncQueueJob } from "../sync-job";
import type { CanonicalClassification, CanonicalEvent, DefinitionIdentity } from "../types";
import {
  ELOS_EXPORT_FORMAT_VERSION, ELOS_PROGRAM, EXPORT_PATHS, RecoveryError,
  type CanonicalRecoveryRepository, type ClassificationSummary,
  type LocalReferenceRecoveryRecord, type RecoveryBundle, type RecoveryFileEntry,
  type RecoveryManifest,
} from "./export-format";
import { sha256, stableJson, utf8Length } from "./integrity";

const REQUIRED_DATA_PATHS: readonly string[] = [
  EXPORT_PATHS.events, EXPORT_PATHS.outbox, EXPORT_PATHS.definitions, EXPORT_PATHS.references,
];
const ROSAIRE_SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/;

type Snapshot = {
  events: CanonicalEvent[];
  jobs: SyncQueueJob[];
  definitions: DefinitionIdentity[];
};

export type ExportOptions = Readonly<{
  exportId: string;
  createdAt: number;
  sourceDatabaseVersion: number;
  containsPersonalMetadata: boolean;
  containsCompanyRestrictedMetadata: boolean;
  allowCompanyRestrictedMetadata?: boolean;
  batchSize?: number;
}>;

export type ImportResult = Readonly<{
  status: "IMPORTED" | "IDEMPOTENT";
  manifest: RecoveryManifest;
  canonicalHistoryDigest: string;
  references: readonly LocalReferenceRecoveryRecord[];
}>;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RecoveryError("INVALID_ARCHIVE");
  return value as Record<string, unknown>;
}

function safeInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new RecoveryError("INVALID_ARCHIVE");
  return value as number;
}

function parseManifest(content: string): RecoveryManifest {
  let raw: Record<string, unknown>;
  try { raw = asRecord(JSON.parse(content)); } catch (error) {
    if (error instanceof RecoveryError) throw error;
    throw new RecoveryError("INVALID_ARCHIVE");
  }
  if (raw.exportFormatVersion !== ELOS_EXPORT_FORMAT_VERSION || raw.schemaVersion !== 1 || raw.sourceDatabaseVersion !== 1) {
    throw new RecoveryError("UNSUPPORTED_EXPORT_VERSION");
  }
  if (raw.program !== ELOS_PROGRAM || typeof raw.exportId !== "string" || !UUIDV7_CANONICAL_PATTERN.test(raw.exportId)
    || typeof raw.overallDigest !== "string" || !ROSAIRE_SHA256_DIGEST.test(raw.overallDigest)
    || typeof raw.canonicalHistoryDigest !== "string" || !ROSAIRE_SHA256_DIGEST.test(raw.canonicalHistoryDigest)
    || raw.checkpointStrategy !== "RECONSTRUCT_LOCAL_POSITIONS"
    || raw.localReferencePolicy !== "METADATA_ONLY_REQUIRES_RELINK") {
    throw new RecoveryError("INVALID_ARCHIVE");
  }
  safeInteger(raw.createdAt); safeInteger(raw.canonicalEventCount); safeInteger(raw.syncQueueCount);
  safeInteger(raw.definitionCount); safeInteger(raw.checkpointCount); safeInteger(raw.localReferenceCount);
  if (raw.checkpointCount !== 0 || !Array.isArray(raw.fileEntries)) throw new RecoveryError("INVALID_ARCHIVE");
  const paths = new Set<string>();
  for (const entryValue of raw.fileEntries) {
    const entry = asRecord(entryValue);
    if (typeof entry.path !== "string" || !REQUIRED_DATA_PATHS.includes(entry.path)
      || paths.has(entry.path) || typeof entry.sha256 !== "string" || !ROSAIRE_SHA256_DIGEST.test(entry.sha256)) {
      throw new RecoveryError("INVALID_ARCHIVE");
    }
    paths.add(entry.path); safeInteger(entry.recordCount); safeInteger(entry.byteLength);
  }
  if (paths.size !== REQUIRED_DATA_PATHS.length || REQUIRED_DATA_PATHS.some((path) => !paths.has(path))) {
    throw new RecoveryError("MISSING_REQUIRED_FILE");
  }
  const classification = asRecord(raw.classificationSummary);
  for (const key of ["SYNC_ALLOWED", "LOCAL_ONLY", "UNKNOWN_BLOCKED"]) safeInteger(classification[key]);
  const security = asRecord(raw.exportSecurityClassification);
  if (typeof security.containsPersonalMetadata !== "boolean"
    || typeof security.containsLocalOnlyMetadata !== "boolean"
    || typeof security.containsCompanyRestrictedMetadata !== "boolean"
    || security.warning !== "SENSITIVE_PEDAGOGICAL_METADATA_LOCAL_RECOVERY_ONLY") {
    throw new RecoveryError("INVALID_ARCHIVE");
  }
  return raw as RecoveryManifest;
}

function ndjson(values: readonly unknown[]): string {
  return values.length === 0 ? "" : values.map(stableJson).join("\n") + "\n";
}

function parseNdjson(content: string): unknown[] {
  if (content === "") return [];
  if (!content.endsWith("\n")) throw new RecoveryError("INVALID_ARCHIVE");
  const lines = content.slice(0, -1).split("\n");
  if (lines.some((line) => line.length === 0)) throw new RecoveryError("INVALID_ARCHIVE");
  try { return lines.map((line) => JSON.parse(line) as unknown); }
  catch { throw new RecoveryError("INVALID_ARCHIVE"); }
}

function classificationSummary(events: readonly CanonicalEvent[]): ClassificationSummary {
  const summary: Record<CanonicalClassification, number> = { SYNC_ALLOWED: 0, LOCAL_ONLY: 0, UNKNOWN_BLOCKED: 0 };
  for (const event of events) summary[event.classification]++;
  return summary;
}

function definitionKey(identity: DefinitionIdentity): string {
  return identity.definitionId + "@" + identity.definitionVersion;
}

function localReferences(events: readonly CanonicalEvent[]): LocalReferenceRecoveryRecord[] {
  const found = new Map<string, LocalReferenceRecoveryRecord>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const child of value) visit(child); return; }
    const record = value as Record<string, unknown>;
    if (record.contentIncluded === false && typeof record.referenceId === "string"
      && (record.storagePolicy === "LOCAL_ONLY" || record.storagePolicy === "REMOTE_ENCRYPTED_FUTURE")) {
      const reference: LocalReferenceRecoveryRecord = {
        referenceId: record.referenceId, storagePolicy: record.storagePolicy, contentIncluded: false,
        ...(typeof record.sha256 === "string" ? { sha256: record.sha256 } : {}), restoreStatus: "REQUIRES_RELINK",
      };
      const existing = found.get(reference.referenceId);
      if (existing && stableJson(existing) !== stableJson(reference)) throw new RecoveryError("CROSS_REFERENCE_FAILURE");
      found.set(reference.referenceId, reference);
    }
    for (const child of Object.values(record)) visit(child);
  };
  for (const event of events) visit(event);
  return [...found.values()].sort((left, right) => left.referenceId.localeCompare(right.referenceId));
}

async function snapshot(repository: CanonicalRecoveryRepository, batchSize: number): Promise<Snapshot> {
  const events: CanonicalEvent[] = [];
  const jobs: SyncQueueJob[] = [];
  const definitions = new Map<string, DefinitionIdentity>();
  for await (const value of repository.iterateEventsForExport(batchSize)) {
    const event = parseCanonicalEvent(value); events.push(event);
    if (event.eventType !== "DELETION_REQUESTED") definitions.set(definitionKey(event.definitionIdentity), event.definitionIdentity);
  }
  for await (const value of repository.iterateOutboxJobsForRecovery(batchSize)) jobs.push(parseSyncQueueJob(value));
  for await (const value of repository.iterateDefinitionsForRecovery(batchSize)) {
    const identity = validateDefinitionIdentity(value);
    const key = definitionKey(identity); const existing = definitions.get(key);
    if (existing && stableJson(existing) !== stableJson(identity)) throw new RecoveryError("CROSS_REFERENCE_FAILURE");
    definitions.set(key, identity);
  }
  return { events, jobs, definitions: [...definitions.values()].sort((a, b) => definitionKey(a).localeCompare(definitionKey(b))) };
}

export async function canonicalHistoryDigest(snapshotValue: Snapshot): Promise<string> {
  return sha256(stableJson({
    events: snapshotValue.events.map(stableJson).sort(),
    jobs: snapshotValue.jobs.map(stableJson).sort(),
    definitions: snapshotValue.definitions.map(stableJson).sort(),
  }));
}

async function fileEntry(path: string, content: string, recordCount: number): Promise<RecoveryFileEntry> {
  return { path, recordCount, sha256: await sha256(content), byteLength: utf8Length(content) };
}

export async function exportCanonicalHistory(
  repository: CanonicalRecoveryRepository, options: ExportOptions,
): Promise<RecoveryBundle> {
  if (typeof options.containsCompanyRestrictedMetadata !== "boolean"
    || typeof options.containsPersonalMetadata !== "boolean") {
    throw new RecoveryError("EXPORT_POLICY_BLOCKED");
  }
  if (options.containsCompanyRestrictedMetadata && !options.allowCompanyRestrictedMetadata) {
    throw new RecoveryError("EXPORT_POLICY_BLOCKED");
  }
  if (!Number.isSafeInteger(options.createdAt) || options.createdAt < 0 || options.sourceDatabaseVersion !== 1
    || !UUIDV7_CANONICAL_PATTERN.test(options.exportId) || !Number.isSafeInteger(options.batchSize ?? 100)
    || (options.batchSize ?? 100) < 1 || (options.batchSize ?? 100) > 1000) {
    throw new RecoveryError("INVALID_ARCHIVE");
  }
  const records = await snapshot(repository, options.batchSize ?? 100);
  if (records.events.length !== await repository.countEvents() || records.jobs.length !== await repository.countOutboxJobs()) {
    throw new RecoveryError("RESTORE_VERIFICATION_FAILED");
  }
  validateCrossReferences(records);
  const references = localReferences(records.events);
  const data: Record<string, string> = {
    [EXPORT_PATHS.events]: ndjson(records.events),
    [EXPORT_PATHS.outbox]: ndjson(records.jobs),
    [EXPORT_PATHS.definitions]: ndjson(records.definitions),
    [EXPORT_PATHS.references]: ndjson(references),
  };
  const entries = await Promise.all([
    fileEntry(EXPORT_PATHS.events, data[EXPORT_PATHS.events], records.events.length),
    fileEntry(EXPORT_PATHS.outbox, data[EXPORT_PATHS.outbox], records.jobs.length),
    fileEntry(EXPORT_PATHS.definitions, data[EXPORT_PATHS.definitions], records.definitions.length),
    fileEntry(EXPORT_PATHS.references, data[EXPORT_PATHS.references], references.length),
  ]);
  const summary = classificationSummary(records.events);
  const manifest: RecoveryManifest = {
    exportFormatVersion: 1, program: ELOS_PROGRAM, exportId: options.exportId, createdAt: options.createdAt,
    schemaVersion: 1, sourceDatabaseVersion: options.sourceDatabaseVersion,
    canonicalEventCount: records.events.length, syncQueueCount: records.jobs.length,
    definitionCount: records.definitions.length, checkpointCount: 0, localReferenceCount: references.length,
    classificationSummary: summary, fileEntries: entries,
    overallDigest: await sha256(stableJson(entries)), canonicalHistoryDigest: await canonicalHistoryDigest(records),
    checkpointStrategy: "RECONSTRUCT_LOCAL_POSITIONS", localReferencePolicy: "METADATA_ONLY_REQUIRES_RELINK",
    exportSecurityClassification: {
      containsPersonalMetadata: options.containsPersonalMetadata || records.events.length > 0,
      containsLocalOnlyMetadata: summary.LOCAL_ONLY > 0 || summary.UNKNOWN_BLOCKED > 0
        || references.some((reference) => reference.storagePolicy === "LOCAL_ONLY"),
      containsCompanyRestrictedMetadata: options.containsCompanyRestrictedMetadata,
      warning: "SENSITIVE_PEDAGOGICAL_METADATA_LOCAL_RECOVERY_ONLY",
    },
  };
  return Object.freeze({ ...data, [EXPORT_PATHS.manifest]: stableJson(manifest) + "\n" });
}

function uniqueBy<Value>(values: readonly Value[], keyOf: (value: Value) => string): Map<string, Value> {
  const result = new Map<string, Value>();
  for (const value of values) {
    const key = keyOf(value); const existing = result.get(key);
    if (existing) throw new RecoveryError(stableJson(existing) === stableJson(value) ? "INVALID_ARCHIVE" : "CROSS_REFERENCE_FAILURE");
    result.set(key, value);
  }
  return result;
}

function validateCrossReferences(records: Snapshot): void {
  const events = uniqueBy(records.events, (event) => event.id);
  const definitions = uniqueBy(records.definitions, definitionKey);
  const jobs = uniqueBy(records.jobs, (job) => job.id);
  const jobEvents = new Set<string>(); const jobKeys = new Set<string>();
  for (const event of records.events) {
    if (event.eventType !== "DELETION_REQUESTED") {
      const definition = definitions.get(definitionKey(event.definitionIdentity));
      if (!definition || stableJson(definition) !== stableJson(event.definitionIdentity)) throw new RecoveryError("CROSS_REFERENCE_FAILURE");
    }
  }
  for (const job of jobs.values()) {
    const event = events.get(job.eventId);
    if (!event || event.classification !== "SYNC_ALLOWED" || job.classification !== "SYNC_ALLOWED"
      || jobEvents.has(job.eventId) || jobKeys.has(job.idempotencyKey)) throw new RecoveryError("CROSS_REFERENCE_FAILURE");
    jobEvents.add(job.eventId); jobKeys.add(job.idempotencyKey);
  }
}

async function readVerifiedBundle(bundle: RecoveryBundle): Promise<{
  manifest: RecoveryManifest; records: Snapshot; references: LocalReferenceRecoveryRecord[];
}> {
  if (!(EXPORT_PATHS.manifest in bundle)) throw new RecoveryError("MISSING_MANIFEST");
  const manifest = parseManifest(bundle[EXPORT_PATHS.manifest]);
  for (const path of REQUIRED_DATA_PATHS) if (!(path in bundle)) throw new RecoveryError("MISSING_REQUIRED_FILE");
  for (const entry of manifest.fileEntries) {
    const content = bundle[entry.path];
    if (utf8Length(content) !== entry.byteLength || await sha256(content) !== entry.sha256) {
      throw new RecoveryError("CHECKSUM_MISMATCH");
    }
  }
  if (await sha256(stableJson(manifest.fileEntries)) !== manifest.overallDigest) throw new RecoveryError("CHECKSUM_MISMATCH");
  let events: CanonicalEvent[]; let jobs: SyncQueueJob[]; let definitions: DefinitionIdentity[];
  try {
    events = parseNdjson(bundle[EXPORT_PATHS.events]).map(parseCanonicalEvent);
    jobs = parseNdjson(bundle[EXPORT_PATHS.outbox]).map(parseSyncQueueJob);
    definitions = parseNdjson(bundle[EXPORT_PATHS.definitions]).map(validateDefinitionIdentity);
  } catch (error) {
    if (error instanceof RecoveryError) throw error;
    throw new RecoveryError("INVALID_ARCHIVE");
  }
  const references = parseNdjson(bundle[EXPORT_PATHS.references]).map((value) => {
    const record = asRecord(value);
    if (typeof record.referenceId !== "string" || !record.referenceId
      || (record.storagePolicy !== "LOCAL_ONLY" && record.storagePolicy !== "REMOTE_ENCRYPTED_FUTURE")
      || record.contentIncluded !== false || record.restoreStatus !== "REQUIRES_RELINK"
      || (record.sha256 !== undefined && (typeof record.sha256 !== "string" || !ROSAIRE_SHA256_DIGEST.test(record.sha256)))) {
      throw new RecoveryError("INVALID_ARCHIVE");
    }
    return record as LocalReferenceRecoveryRecord;
  });
  const records = { events, jobs, definitions };
  validateCrossReferences(records);
  const summary = classificationSummary(events);
  const entryCounts = new Map(manifest.fileEntries.map((entry) => [entry.path, entry.recordCount]));
  if (events.length !== manifest.canonicalEventCount || jobs.length !== manifest.syncQueueCount
    || definitions.length !== manifest.definitionCount || references.length !== manifest.localReferenceCount
    || entryCounts.get(EXPORT_PATHS.events) !== events.length
    || entryCounts.get(EXPORT_PATHS.outbox) !== jobs.length
    || entryCounts.get(EXPORT_PATHS.definitions) !== definitions.length
    || entryCounts.get(EXPORT_PATHS.references) !== references.length
    || stableJson(summary) !== stableJson(manifest.classificationSummary)
    || stableJson(localReferences(events)) !== stableJson(references)
    || await canonicalHistoryDigest(records) !== manifest.canonicalHistoryDigest) {
    throw new RecoveryError("RESTORE_VERIFICATION_FAILED");
  }
  return { manifest, records, references };
}

export async function importCanonicalHistory(
  bundle: RecoveryBundle,
  target: CanonicalRecoveryRepository & { close?: () => void; initialize?: () => Promise<void> },
): Promise<ImportResult> {
  const verified = await readVerifiedBundle(bundle);
  const before = await snapshot(target, 100);
  if (before.events.length || before.jobs.length || before.definitions.length) {
    if (await canonicalHistoryDigest(before) === verified.manifest.canonicalHistoryDigest
      && before.events.length === verified.records.events.length
      && before.jobs.length === verified.records.jobs.length
      && before.definitions.length === verified.records.definitions.length) {
      return { status: "IDEMPOTENT", manifest: verified.manifest,
        canonicalHistoryDigest: verified.manifest.canonicalHistoryDigest, references: Object.freeze(verified.references) };
    }
    throw new RecoveryError("TARGET_CONFLICT");
  }
  for (const definition of verified.records.definitions) await target.putDefinition(definition);
  const jobs = new Map(verified.records.jobs.map((job) => [job.eventId, job]));
  for (const event of verified.records.events) {
    const job = jobs.get(event.id);
    if (job) await target.appendEventWithOutbox(event, job); else await target.appendEvent(event);
  }
  if (target.close && target.initialize) { target.close(); await target.initialize(); }
  const restored = await snapshot(target, 100);
  if (await canonicalHistoryDigest(restored) !== verified.manifest.canonicalHistoryDigest
    || restored.events.length !== verified.records.events.length
    || restored.jobs.length !== verified.records.jobs.length
    || restored.definitions.length !== verified.records.definitions.length) {
    throw new RecoveryError("RESTORE_VERIFICATION_FAILED");
  }
  for (const event of verified.records.events) {
    if (stableJson(await target.getEventById(event.id)) !== stableJson(event)) {
      throw new RecoveryError("RESTORE_VERIFICATION_FAILED");
    }
  }
  for (const job of verified.records.jobs) {
    if (stableJson(await target.getOutboxJobById(job.id)) !== stableJson(job)) {
      throw new RecoveryError("RESTORE_VERIFICATION_FAILED");
    }
  }
  for (const definition of verified.records.definitions) {
    if (stableJson(await target.getDefinition(definition)) !== stableJson(definition)) {
      throw new RecoveryError("RESTORE_VERIFICATION_FAILED");
    }
  }
  return { status: "IMPORTED", manifest: verified.manifest,
    canonicalHistoryDigest: verified.manifest.canonicalHistoryDigest, references: Object.freeze(verified.references) };
}
