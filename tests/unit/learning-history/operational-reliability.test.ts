import assert from "node:assert/strict";
import test from "node:test";

const { InMemoryCanonicalLearningRepository } = await import(
  "../../../src/modules/learning-history/adapters/in-memory.ts"
);
const { assessBackup, assessDeletionPropagation, runSyntheticRestoreDrill } = await import(
  "../../../src/modules/learning-history/operations/reliability.ts"
);
const { incidentSeverity, parseOperationalTelemetry, requiresImmediateNotification } = await import(
  "../../../src/modules/learning-history/operations/telemetry.ts"
);
const { definition, event, job, policy, uuid } = await import("./sprint-fixtures.ts");

test("backup is trusted only after checksum, freshness, and successful restore", () => {
  const common = { exists: true, createdAt: 100, checkedAt: 200, maxAgeMs: 1_000 } as const;
  assert.equal(assessBackup({ ...common, checksum: "VERIFIED", restore: "VERIFIED" }).status, "TRUSTED");
  assert.equal(assessBackup({ ...common, checksum: "VERIFIED", restore: "NOT_RUN" }).status, "UNRESTORED");
  assert.equal(assessBackup({ ...common, checkedAt: 2_000, checksum: "VERIFIED", restore: "VERIFIED" }).status, "STALE");
  assert.equal(assessBackup({ ...common, checksum: "FAILED", restore: "VERIFIED" }).status, "FAILED");
  assert.equal(assessBackup({ ...common, exists: false, createdAt: null, checksum: "NOT_CHECKED", restore: "NOT_RUN" }).status, "FAILED");
});

test("fresh-profile restore preserves canonical, projection, outbox, and deletion semantics", async () => {
  const source = new InMemoryCanonicalLearningRepository();
  await source.putDefinition(definition);
  const evidence = event(1);
  const deletion = event(2, "DELETION_REQUESTED");
  await source.appendEventWithOutbox(evidence, job(evidence));
  await source.appendEventWithOutbox(deletion, job(deletion));
  const drill = await runSyntheticRestoreDrill({
    source,
    createFreshTarget: () => new InMemoryCanonicalLearningRepository(),
    exportOptions: {
      exportId: uuid(500),
      createdAt: 1_000,
      sourceDatabaseVersion: 1,
      containsPersonalMetadata: true,
      containsCompanyRestrictedMetadata: false,
    },
    projectionPolicy: policy,
  });
  assert.deepEqual(drill, {
    status: "TRUSTED",
    canonicalDigestEqual: true,
    projectionDigestEqual: true,
    eventCountEqual: true,
    tombstonesEqual: true,
    sourceEventCount: 2,
    restoredEventCount: 2,
  });
});

test("injected restore failure is never reported as trusted", async () => {
  const source = new InMemoryCanonicalLearningRepository();
  await source.putDefinition(definition);
  const canonical = event(3);
  await source.appendEventWithOutbox(canonical, job(canonical));
  const drill = await runSyntheticRestoreDrill({
    source,
    createFreshTarget: () => {
      const target = new InMemoryCanonicalLearningRepository();
      target.failNextAtomicWriteAfterEvent();
      return target;
    },
    exportOptions: {
      exportId: uuid(501),
      createdAt: 1_000,
      sourceDatabaseVersion: 1,
      containsPersonalMetadata: false,
      containsCompanyRestrictedMetadata: false,
    },
    projectionPolicy: policy,
  });
  assert.equal(drill.status, "FAILED");
  assert.equal(drill.failureCode, "REPOSITORY_INVARIANT");
});

test("deletion remains pending until purge and every device crosses the tombstone", () => {
  assert.deepEqual(assessDeletionPropagation({
    authorized: true,
    tombstonePresent: true,
    eligibleContentPurged: false,
    deletionSequence: 8,
    deviceCheckpoints: { b: 8, a: 7 },
  }), {
    status: "PENDING",
    staleDeviceIds: ["a"],
    reasons: ["PURGE_INCOMPLETE", "STALE_DEVICES"],
  });
  assert.equal(assessDeletionPropagation({
    authorized: true,
    tombstonePresent: true,
    eligibleContentPurged: true,
    deletionSequence: 8,
    deviceCheckpoints: { a: 8, b: 9 },
  }).status, "COMPLETE");
  assert.equal(assessDeletionPropagation({
    authorized: false,
    tombstonePresent: false,
    eligibleContentPurged: false,
    deletionSequence: 8,
    deviceCheckpoints: {},
  }).status, "FAILED");
});

test("telemetry is allowlisted, privacy-safe, and severity-controlled", () => {
  const value = {
    version: 1,
    code: "RESTORE_FAILURE",
    component: "RESTORE",
    severity: "CRITICAL",
    timestamp: 100,
    durationMs: 25,
    deviceId: uuid(901),
    queueDepth: null,
    backupStatus: "FAILED",
    jobState: null,
    correlationId: uuid(700),
    latencyMs: null,
    route: "/api/sync/health",
  };
  assert.deepEqual(parseOperationalTelemetry(value), value);
  assert.throws(() => parseOperationalTelemetry({ ...value, answer: "private" }));
  assert.throws(() => parseOperationalTelemetry({ ...value, severity: "INFO" }));
  assert.throws(() => parseOperationalTelemetry({ ...value, route: "/learner/private-google-id" }));
  assert.equal(incidentSeverity("REMOTE_DIVERGENCE"), "WARNING");
  assert.equal(incidentSeverity("TEMPORARY_OFFLINE"), "INFO");
  assert.equal(requiresImmediateNotification("CRITICAL"), true);
  assert.equal(requiresImmediateNotification("WARNING"), false);
});
