import assert from "node:assert/strict";
import test, { after } from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith(".") && !/\.(ts|mjs)$/.test(specifier)) return nextResolve(specifier + ".ts", context);
    throw error;
  }
} });
const errors = await import("../../../src/modules/learning-history/repository-errors.ts");
const { CanonicalStorageError } = await import("../../../src/modules/learning-history/adapters/indexeddb.ts");
const { runCanonicalRepositoryConformance } = await import("../../unit/learning-history/repository-conformance.ts");
const { createBrowserHarness } = await import("./browser-driver.mjs");
import type { CanonicalLearningRepository } from "../../../src/modules/learning-history/repository.ts";

const browser = await createBrowserHarness({ ...errors, CanonicalStorageError });
after(() => browser.close());
console.log("REAL_BROWSER", browser.version.product);

// Every repository method is executed by the real browser adapter over the test-only CDP transport.
// The T-0020I suite itself is imported unchanged: no alternate/relaxed assertions.
runCanonicalRepositoryConformance("IndexedDB / real Chrome", async () => {
  const handle = await browser.createRepository();
  return { repository: handle.repository as CanonicalLearningRepository,
    failNextAtomicWriteAfterEvent: handle.failNextAtomicWriteAfterEvent };
});

test("browser: V1 schema and duplicate initialization remain stable", async () => {
  const handle = await browser.createRepository();
  await Promise.all(Array.from({ length: 10 }, () => browser.call(handle.tab, "create", handle.id, handle.name)));
  const state = await handle.inspect();
  assert.equal(state.version, 1);
  assert.deepEqual(state.stores, ["canonicalEvents", "checkpoints", "definitionIdentities", "syncQueue"]);
  assert.deepEqual(state.indexes.canonicalEvents, ["attemptId", "checkpoint", "definitionKey", "deletionTarget", "eventId", "eventType", "evidenceIds"]);
  assert.deepEqual(state.indexes.syncQueue, ["eventId", "idempotencyKey"]);
  assert.equal(state.events, 0); assert.equal(state.jobs, 0);
});

for (const phase of ["BEFORE_EVENT_WRITE", "AFTER_EVENT_WRITE", "BEFORE_JOB_WRITE", "AFTER_JOB_WRITE"]) {
  test("browser: " + phase + " abort survives reopen with zero orphans", async () => {
    const handle = await browser.createRepository();
    const { event, job } = await browser.call(handle.tab, "operation", 400);
    await handle.call("fail", phase);
    await assert.rejects(browser.call(handle.tab, "invoke", handle.id, "appendEventWithOutbox", [event, job]), errors.RepositoryInvariantError);
    await handle.call("close");
    await browser.call(handle.tab, "create", handle.id, handle.name);
    const state = await handle.inspect();
    assert.equal(state.events, 0); assert.equal(state.jobs, 0);
    assert.equal(state.orphanEvents, 0); assert.equal(state.orphanJobs, 0);
    // The next operation must work; no lingering transaction or failed-initialization poison.
    await browser.call(handle.tab, "invoke", handle.id, "appendEventWithOutbox", [event, job]);
    assert.equal((await handle.inspect()).jobs, 1);
  });
}

for (const [errorName, reason] of [["QuotaExceededError", "QUOTA_EXCEEDED"], ["AbortError", "ABORTED"]]) {
  test("browser: " + errorName + " maps safely and rolls back both records", async () => {
    const handle = await browser.createRepository();
    const { event, job } = await browser.call(handle.tab, "operation", 401);
    await handle.call("fail", "AFTER_JOB_WRITE", errorName);
    await assert.rejects(browser.call(handle.tab, "invoke", handle.id, "appendEventWithOutbox", [event, job]), { name: "CanonicalStorageError", reason });
    const state = await handle.inspect();
    assert.equal(state.events, 0); assert.equal(state.jobs, 0);
  });
}

test("browser: committed event/outbox and opaque checkpoint survive close, reopen and reload", async () => {
  const handle = await browser.createRepository();
  const { event, job } = await browser.call(handle.tab, "operation", 402);
  const result = await browser.call(handle.tab, "invoke", handle.id, "appendEventWithOutbox", [event, job]);
  const definitionV1 = event.definitionIdentity;
  const definitionV2 = { ...definitionV1, definitionVersion: 2, definitionHash: "sha256:" + "b".repeat(64) };
  await browser.call(handle.tab, "invoke", handle.id, "putDefinition", [definitionV1]);
  await browser.call(handle.tab, "invoke", handle.id, "putDefinition", [definitionV2]);
  const savedCheckpoint = { id: "00000000-0000-7000-8000-000000800001", position: result.checkpoint, updatedAt: 101 };
  await browser.call(handle.tab, "invoke", handle.id, "saveCheckpoint", [savedCheckpoint]);
  await handle.call("close");
  await browser.call(handle.tab, "create", handle.id, handle.name);
  assert.deepEqual(await browser.call(handle.tab, "invoke", handle.id, "getEventById", [event.id]), event);
  await browser.reload(handle.tab);
  await browser.call(handle.tab, "create", handle.id, handle.name);
  assert.deepEqual(await browser.call(handle.tab, "invoke", handle.id, "getOutboxJobById", [job.id]), job);
  assert.deepEqual(await browser.call(handle.tab, "invoke", handle.id, "getDefinition", [definitionV1]), definitionV1);
  assert.deepEqual(await browser.call(handle.tab, "invoke", handle.id, "getDefinition", [definitionV2]), definitionV2);
  assert.deepEqual(await browser.call(handle.tab, "invoke", handle.id, "getCheckpoint", [savedCheckpoint.id]), savedCheckpoint);
  const page = await browser.call(handle.tab, "invoke", handle.id, "readEventsAfter", [result.checkpoint, 10]);
  assert.equal(page.events.length, 0); assert.equal(page.checkpoint, result.checkpoint);
});

test("browser: two tabs serialize competing atomic writes without loss or duplicate jobs", async () => {
  const left = await browser.createRepository();
  const right = await browser.createRepository({ name: left.name, tab: await browser.newTab() });
  const same = await browser.call(left.tab, "operation", 403);
  const outcomes = await Promise.all([left, right].map((handle) => browser.call(handle.tab, "invoke", handle.id, "appendEventWithOutbox", [same.event, same.job])));
  assert.deepEqual(outcomes.map((value) => value.eventStatus).sort(), ["APPENDED", "IDEMPOTENT"]);
  const results = await Promise.all([left.call("write", 10000, 50), right.call("write", 20000, 50)]);
  assert.equal(results.reduce((sum, value) => sum + value.failures, 0), 0);
  const state = await left.inspect();
  assert.equal(state.events, 101); assert.equal(state.jobs, 101);
  assert.equal(state.orphanEvents, 0); assert.equal(state.orphanJobs, 0);
  const conflict = { ...same.event, recordedAt: 999 };
  await assert.rejects(browser.call(right.tab, "invoke", right.id, "appendEventWithOutbox", [conflict, same.job]), errors.CanonicalEventConflictError);
});

test("browser: versionchange closes the old adapter; a newer schema is never downgraded", async () => {
  const handle = await browser.createRepository();
  assert.deepEqual(await handle.call("upgrade", false), { blocked: false, newerVersionRejected: true });
});
test("browser: blocked native upgrade recovers when the old tab releases its connection", async () => {
  const handle = await browser.createRepository();
  assert.deepEqual(await handle.call("upgrade", true), { blocked: true, newerVersionRejected: true });
});

test("browser: a stalled open times out, cancels its late upgrade and can be retried", async () => {
  assert.deepEqual(await browser.call(browser.mainTab, "openingRecovery", false), { reason: "OPEN_TIMEOUT", count: 0 });
});
test("browser: closing during initialization cancels the open without poisoning the next initialization", async () => {
  assert.deepEqual(await browser.call(browser.mainTab, "openingRecovery", true), { reason: "ABORTED", count: 0 });
});
for (const classification of ["LOCAL_ONLY", "UNKNOWN_BLOCKED"]) {
  test("browser: " + classification + " survives reopen locally, never creates an outbox job", async () => {
    const handle = await browser.createRepository();
    const { event } = await browser.call(handle.tab, "operation", 404);
    const local = { ...event, classification };
    await browser.call(handle.tab, "invoke", handle.id, "appendEvent", [local]);
    await handle.call("close");
    await browser.call(handle.tab, "create", handle.id, handle.name);
    assert.deepEqual(await browser.call(handle.tab, "invoke", handle.id, "getEventById", [local.id]), local);
    assert.equal(await browser.call(handle.tab, "invoke", handle.id, "countOutboxJobs", []), 0);
  });
}

test("browser: 1000 atomic writes, serializable opaque references only, zero orphan records", async () => {
  const handle = await browser.createRepository();
  const result = await handle.call("write", 30000, 1000);
  console.log("SMOKE_1000", JSON.stringify(result));
  assert.equal(result.failures, 0); assert.equal(result.events, 1000); assert.equal(result.jobs, 1000);
  assert.equal(result.orphanEvents, 0); assert.equal(result.orphanJobs, 0); assert.equal(result.containsRaw, false);
});
test("browser: persistence status is observable without asking for permission", async () => {
  assert.ok(["PERSISTED", "BEST_EFFORT", "UNAVAILABLE"].includes(await browser.call(browser.mainTab, "persistence")));
});
test("browser: legacy completion and deletion reconcile idempotently into real IndexedDB without raw content", async () => {
  const result = await browser.call(browser.mainTab, "legacyReconcile");
  assert.deepEqual(result.first, { events: 3, outboxJobs: 3 });
  assert.deepEqual(result.second, { events: 3, outboxJobs: 3 });
  assert.deepEqual(result.deleted, { events: 1, outboxJobs: 1 });
  assert.deepEqual(result.replayed, { events: 4, outboxJobs: 4 });
  assert.equal(result.events, 4); assert.equal(result.jobs, 4); assert.equal(result.tombstones, 1);
  assert.equal(result.orphanEvents, 0); assert.equal(result.orphanJobs, 0);
  assert.equal(result.containsRaw, false); assert.equal(result.containsPrivate, false);
});
test("browser: complete daily learning loop crosses actual stores and canonical IndexedDB", async () => {
  const result = await browser.call(browser.mainTab, "dailyLearningLoop");
  assert.equal(result.missionStatus, "COMPLETED");
  assert.equal(result.evidenceCount, 3); assert.equal(result.errorCount, 1); assert.equal(result.reviewCount, 1);
  assert.equal(result.competencyStatus, "PRACTICED"); assert.equal(result.competencyTraceable, true);
  assert.deepEqual(result.first, { events: 8, outboxJobs: 8 });
  assert.deepEqual(result.second, { events: 8, outboxJobs: 8 });
  assert.deepEqual(result.eventTypes, { evidence: 2, errors: 1, reviews: 1 });
  assert.equal(result.events, 8); assert.equal(result.jobs, 8);
  assert.equal(result.orphanEvents, 0); assert.equal(result.orphanJobs, 0);
  assert.equal(result.containsRaw, false); assert.equal(result.containsPrivate, false);
});
