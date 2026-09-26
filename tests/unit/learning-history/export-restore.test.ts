import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(specifier + ".ts", context);
    throw error;
  }
} });

const { InMemoryCanonicalLearningRepository } = await import("../../../src/modules/learning-history/adapters/in-memory.ts");
const { EXPORT_PATHS, RecoveryError } = await import("../../../src/modules/learning-history/export/export-format.ts");
const { exportCanonicalHistory, importCanonicalHistory } = await import("../../../src/modules/learning-history/export/recovery.ts");
const { sha256, stableJson, utf8Length } = await import("../../../src/modules/learning-history/export/integrity.ts");
const { parseCanonicalEvent } = await import("../../../src/modules/learning-history/events.ts");
const { parseSyncQueueJob } = await import("../../../src/modules/learning-history/sync-job.ts");
import type { CanonicalEvent, CheckpointId } from "../../../src/modules/learning-history/types.ts";

const uuid = (value: number) => "00000000-0000-7000-8000-" + value.toString().padStart(12, "0");
const hashA = "sha256:" + "a".repeat(64);
const exportOptions = { exportId: uuid(800000), createdAt: 1234, sourceDatabaseVersion: 1,
  containsPersonalMetadata: false, containsCompanyRestrictedMetadata: false };

function operation(value: number, classification = "SYNC_ALLOWED" as "SYNC_ALLOWED" | "LOCAL_ONLY" | "UNKNOWN_BLOCKED") {
  const event = parseCanonicalEvent({ id: uuid(value), schemaVersion: 1, eventType: "ATTEMPT_ANSWERED",
    learnerRef: uuid(900000), deviceRef: uuid(900001), occurredAt: value, recordedAt: value,
    deviceLocalOrder: value, classification, definitionIdentity: { definitionId: uuid(900002), definitionVersion: 1, definitionHash: hashA },
    attemptId: uuid(900003), payload: { stepRef: "synthetic-step", responseKind: "FILE",
      responseRef: { referenceId: "opaque-" + value, storagePolicy: "LOCAL_ONLY", contentIncluded: false, sha256: hashA },
      outcome: "SUBMITTED", assistance: { modes: ["NONE"], hintCount: 0, retryCount: 0 } } }) as Extract<CanonicalEvent, { eventType: "ATTEMPT_ANSWERED" }>;
  const job = parseSyncQueueJob({ id: uuid(value + 1000000), eventId: event.id,
    idempotencyKey: "synthetic-sync-" + value, state: "PENDING", createdAt: value,
    attempts: 0, classification: "SYNC_ALLOWED" });
  return { event, job };
}

async function sourceRepository() {
  const repository = new InMemoryCanonicalLearningRepository();
  const sync = operation(1); const local = operation(2, "LOCAL_ONLY"); const unknown = operation(3, "UNKNOWN_BLOCKED");
  await repository.putDefinition(sync.event.definitionIdentity);
  await repository.appendEventWithOutbox(sync.event, sync.job);
  await repository.appendEvent(local.event); await repository.appendEvent(unknown.event);
  const tombstone = parseCanonicalEvent({ id: uuid(4), schemaVersion: 1, eventType: "DELETION_REQUESTED",
    learnerRef: uuid(900000), deviceRef: uuid(900001), occurredAt: 4, recordedAt: 4,
    deviceLocalOrder: 4, classification: "LOCAL_ONLY",
    payload: { targetType: "ATTEMPT", targetId: local.event.attemptId, scope: "LOCAL_ONLY", requestedBy: "LEARNER" } });
  await repository.appendEvent(tombstone);
  const page = await repository.readEventsAfter(null, 100);
  const checkpointId = uuid(800001) as CheckpointId;
  await repository.saveCheckpoint({ id: checkpointId, position: page.checkpoint!, updatedAt: 999 });
  return { repository, sync, local, unknown, tombstone, checkpointId };
}

async function resign(bundle: Record<string, string>, path: string, content: string, recordCount?: number) {
  const next = { ...bundle, [path]: content };
  const manifest = JSON.parse(next[EXPORT_PATHS.manifest]);
  const entry = manifest.fileEntries.find((value: { path: string }) => value.path === path);
  entry.sha256 = await sha256(content); entry.byteLength = utf8Length(content);
  if (recordCount !== undefined) entry.recordCount = recordCount;
  manifest.overallDigest = await sha256(stableJson(manifest.fileEntries));
  next[EXPORT_PATHS.manifest] = stableJson(manifest) + "\n";
  return next;
}

test("empty canonical database exports as a verified open V1 bundle", async () => {
  const bundle = await exportCanonicalHistory(new InMemoryCanonicalLearningRepository(), exportOptions);
  assert.deepEqual(Object.keys(bundle).sort(), Object.values(EXPORT_PATHS).sort());
  const manifest = JSON.parse(bundle[EXPORT_PATHS.manifest]);
  assert.equal(manifest.canonicalEventCount, 0); assert.equal(manifest.checkpointCount, 0);
  assert.equal((await importCanonicalHistory(bundle, new InMemoryCanonicalLearningRepository())).status, "IMPORTED");
});

test("valid history, classifications, outbox, tombstone and reference metadata round-trip", async () => {
  const source = await sourceRepository();
  const beforeCount = await source.repository.countEvents();
  const bundle = await exportCanonicalHistory(source.repository, exportOptions);
  assert.equal(bundle[EXPORT_PATHS.events].includes("rawContent"), false);
  assert.equal(bundle[EXPORT_PATHS.references].includes("REQUIRES_RELINK"), true);
  const target = new InMemoryCanonicalLearningRepository();
  const first = await importCanonicalHistory(bundle, target);
  assert.equal(first.status, "IMPORTED");
  assert.equal((await importCanonicalHistory(bundle, target)).status, "IDEMPOTENT");
  assert.equal(await target.countEvents(), 4); assert.equal(await target.countOutboxJobs(), 1);
  assert.deepEqual(await target.getOutboxJobById(source.sync.job.id), source.sync.job);
  assert.equal((await target.getEventById(source.local.event.id))?.classification, "LOCAL_ONLY");
  assert.equal((await target.getEventById(source.unknown.event.id))?.classification, "UNKNOWN_BLOCKED");
  assert.deepEqual(await target.readTombstones(), [source.tombstone]);
  assert.equal(await target.getCheckpoint(source.checkpointId), null);
  await assert.rejects(target.appendEvent(operation(5, "LOCAL_ONLY").event), /stale event cannot recreate deleted ATTEMPT/);
  assert.equal(await source.repository.countEvents(), beforeCount);
});

test("company-restricted export requires an explicit policy decision", async () => {
  await assert.rejects(exportCanonicalHistory(new InMemoryCanonicalLearningRepository(), {
    ...exportOptions, containsCompanyRestrictedMetadata: undefined as unknown as boolean,
  }), { code: "EXPORT_POLICY_BLOCKED" });
  await assert.rejects(exportCanonicalHistory(new InMemoryCanonicalLearningRepository(), {
    ...exportOptions, containsCompanyRestrictedMetadata: true,
  }), { code: "EXPORT_POLICY_BLOCKED" });
});

test("missing manifest and required files fail closed", async () => {
  const bundle = await exportCanonicalHistory(new InMemoryCanonicalLearningRepository(), exportOptions);
  const { [EXPORT_PATHS.manifest]: _manifest, ...withoutManifest } = bundle;
  await assert.rejects(importCanonicalHistory(withoutManifest, new InMemoryCanonicalLearningRepository()), { code: "MISSING_MANIFEST" });
  const { [EXPORT_PATHS.events]: _events, ...withoutEvents } = bundle;
  await assert.rejects(importCanonicalHistory(withoutEvents, new InMemoryCanonicalLearningRepository()), { code: "MISSING_REQUIRED_FILE" });
});

test("tampered, truncated and invalid JSON files fail closed", async () => {
  const bundle = await exportCanonicalHistory((await sourceRepository()).repository, exportOptions);
  await assert.rejects(importCanonicalHistory({ ...bundle, [EXPORT_PATHS.events]: bundle[EXPORT_PATHS.events] + "x" },
    new InMemoryCanonicalLearningRepository()), { code: "CHECKSUM_MISMATCH" });
  const truncated = await resign(bundle, EXPORT_PATHS.events, bundle[EXPORT_PATHS.events].slice(0, -1));
  await assert.rejects(importCanonicalHistory(truncated, new InMemoryCanonicalLearningRepository()), { code: "INVALID_ARCHIVE" });
  const invalidJson = await resign(bundle, EXPORT_PATHS.events, "{invalid}\n", 1);
  await assert.rejects(importCanonicalHistory(invalidJson, new InMemoryCanonicalLearningRepository()), { code: "INVALID_ARCHIVE" });
});

test("runtime-invalid event and job fail after valid checksums", async () => {
  const bundle = await exportCanonicalHistory((await sourceRepository()).repository, exportOptions);
  const event = JSON.parse(bundle[EXPORT_PATHS.events].split("\n")[0]); event.schemaVersion = 99;
  const invalidEvent = await resign(bundle, EXPORT_PATHS.events, stableJson(event) + "\n", 1);
  await assert.rejects(importCanonicalHistory(invalidEvent, new InMemoryCanonicalLearningRepository()), RecoveryError);
  const job = JSON.parse(bundle[EXPORT_PATHS.outbox].trim()); job.state = "ACKED";
  const invalidJob = await resign(bundle, EXPORT_PATHS.outbox, stableJson(job) + "\n");
  await assert.rejects(importCanonicalHistory(invalidJob, new InMemoryCanonicalLearningRepository()), { code: "INVALID_ARCHIVE" });
});

test("unsupported versions, definition conflicts and conflicting duplicate EventIds fail closed", async () => {
  const source = await sourceRepository(); const bundle = await exportCanonicalHistory(source.repository, exportOptions);
  const manifest = JSON.parse(bundle[EXPORT_PATHS.manifest]); manifest.exportFormatVersion = 2;
  await assert.rejects(importCanonicalHistory({ ...bundle, [EXPORT_PATHS.manifest]: stableJson(manifest) + "\n" },
    new InMemoryCanonicalLearningRepository()), { code: "UNSUPPORTED_EXPORT_VERSION" });
  const unknownSchema = JSON.parse(bundle[EXPORT_PATHS.manifest]); unknownSchema.schemaVersion = 99;
  await assert.rejects(importCanonicalHistory({ ...bundle, [EXPORT_PATHS.manifest]: stableJson(unknownSchema) + "\n" },
    new InMemoryCanonicalLearningRepository()), { code: "UNSUPPORTED_EXPORT_VERSION" });
  const definition = JSON.parse(bundle[EXPORT_PATHS.definitions].trim()); definition.definitionHash = "sha256:" + "b".repeat(64);
  const conflict = await resign(bundle, EXPORT_PATHS.definitions, stableJson(definition) + "\n");
  await assert.rejects(importCanonicalHistory(conflict, new InMemoryCanonicalLearningRepository()), { code: "CROSS_REFERENCE_FAILURE" });
  const lines = bundle[EXPORT_PATHS.events].trim().split("\n"); const duplicate = JSON.parse(lines[0]); duplicate.recordedAt++;
  const duplicated = await resign(bundle, EXPORT_PATHS.events, lines.join("\n") + "\n" + stableJson(duplicate) + "\n", 5);
  await assert.rejects(importCanonicalHistory(duplicated, new InMemoryCanonicalLearningRepository()), { code: "CROSS_REFERENCE_FAILURE" });
});

test("a non-equivalent existing restore target is rejected without overwrite", async () => {
  const bundle = await exportCanonicalHistory((await sourceRepository()).repository, exportOptions);
  const target = new InMemoryCanonicalLearningRepository(); await target.appendEvent(operation(50, "LOCAL_ONLY").event);
  await assert.rejects(importCanonicalHistory(bundle, target), { code: "TARGET_CONFLICT" });
  assert.equal(await target.countEvents(), 1);
});
