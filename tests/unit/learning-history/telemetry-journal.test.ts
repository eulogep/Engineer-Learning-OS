import assert from "node:assert/strict";
import test from "node:test";
import { createOperationalTelemetry } from "../../../src/modules/learning-history/operations/telemetry.ts";
import {
  LocalOperationalTelemetryJournal,
  MAX_OPERATIONAL_TELEMETRY_RECORDS,
  OPERATIONAL_TELEMETRY_RETENTION_MS,
  parseOperationalHistory,
  type OperationalTelemetryStorage,
} from "../../../src/modules/learning-history/operations/telemetry-journal.ts";
import { uuid } from "./sprint-fixtures.ts";

function entry(timestamp: number, sequence: number) {
  return createOperationalTelemetry({
    code: "CANONICAL_RECONCILIATION_COMPLETED",
    component: "LOCAL_STORE",
    timestamp,
    durationMs: 12,
    deviceId: uuid(901),
    queueDepth: 3,
    backupStatus: null,
    jobState: null,
    correlationId: uuid(sequence),
    latencyMs: null,
    route: "/data",
  });
}

function memoryStorage(initial: string | null = null) {
  let value = initial;
  const storage: OperationalTelemetryStorage = {
    read: () => value,
    write: (next) => { value = next; },
    remove: () => { value = null; },
  };
  return { storage, value: () => value };
}

test("operational history keeps the exact 90-day boundary and prunes older records", () => {
  const now = 200 * 24 * 60 * 60 * 1_000;
  const boundary = entry(now - OPERATIONAL_TELEMETRY_RETENTION_MS, 1);
  const expired = entry(boundary.timestamp - 1, 2);
  const recent = entry(now, 3);
  assert.deepEqual(parseOperationalHistory(JSON.stringify([expired, boundary, recent]), now), [boundary, recent]);
});

test("unknown fields, learner content and malformed entries fail closed during hydration", () => {
  const now = 10_000;
  const valid = entry(now, 4);
  const contaminated = { ...entry(now, 5), answer: "private learner answer" };
  const store = memoryStorage(JSON.stringify([contaminated, valid, { prompt: "private prompt" }]));
  const journal = new LocalOperationalTelemetryJournal(store.storage);
  assert.deepEqual(journal.hydrate(now).records, [valid]);
  assert.equal(store.value(), JSON.stringify([valid]));
  assert.equal(store.value()?.includes("private"), false);
});

test("journal deduplicates correlations, bounds growth, persists pruning, and clears locally", () => {
  const now = 1_000_000;
  const store = memoryStorage();
  const journal = new LocalOperationalTelemetryJournal(store.storage);
  journal.hydrate(now);
  for (let index = 0; index <= MAX_OPERATIONAL_TELEMETRY_RECORDS; index++) {
    journal.record(entry(now - MAX_OPERATIONAL_TELEMETRY_RECORDS + index, index + 10), now);
  }
  assert.equal(journal.getSnapshot().records.length, MAX_OPERATIONAL_TELEMETRY_RECORDS);
  const latest = entry(now, 10 + MAX_OPERATIONAL_TELEMETRY_RECORDS);
  journal.record(latest, now);
  assert.equal(journal.getSnapshot().records.length, MAX_OPERATIONAL_TELEMETRY_RECORDS);
  assert.equal(journal.getSnapshot().records.at(-1)?.correlationId, latest.correlationId);
  assert.deepEqual(journal.clear().records, []);
  assert.equal(store.value(), null);
});

test("write failure is visible while the sanitized in-memory record remains inspectable", () => {
  const journal = new LocalOperationalTelemetryJournal({
    read: () => null,
    write: () => { throw new Error("synthetic quota failure"); },
    remove: () => { throw new Error("synthetic removal failure"); },
  });
  const snapshot = journal.record(entry(100, 8), 100);
  assert.equal(snapshot.persistence, "UNAVAILABLE");
  assert.equal(snapshot.records.length, 1);
  assert.equal(journal.hydrate(100).records.length, 1);
  assert.equal(journal.clear().records.length, 1);
});
