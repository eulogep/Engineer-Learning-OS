import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(specifier + ".ts", context);
    throw error;
  }
} });

const { IndexedDbCanonicalLearningRepository, CanonicalStorageError, mapCanonicalStorageError,
  canonicalPersistenceStatus } = await import("../../../src/modules/learning-history/adapters/indexeddb.ts");
const { RepositoryInvariantError } = await import("../../../src/modules/learning-history/repository-errors.ts");

for (const [name, reason] of [
  ["QuotaExceededError", "QUOTA_EXCEEDED"], ["AbortError", "ABORTED"],
  ["VersionError", "VERSION_MISMATCH"], ["SecurityError", "UNAVAILABLE"],
  ["UnexpectedError", "STORAGE_FAILURE"],
]) {
  test("IndexedDB maps " + name + " without leaking browser error details", () => {
    const mapped = mapCanonicalStorageError(new DOMException("synthetic-private-detail", name));
    assert.ok(mapped instanceof CanonicalStorageError);
    assert.equal(mapped.reason, reason);
    assert.equal(mapped.message.includes("synthetic-private-detail"), false);
    assert.equal(mapped.cause, undefined);
  });
}
test("IndexedDB preserves repository invariant errors", () => {
  const error = new RepositoryInvariantError("synthetic invariant");
  assert.equal(mapCanonicalStorageError(error), error);
});
test("IndexedDB without browser storage fails explicitly and may be retried", async () => {
  const repository = new IndexedDbCanonicalLearningRepository();
  for (let i = 0; i < 2; i++) await assert.rejects(repository.initialize(), { reason: "UNAVAILABLE" });
});
test("IndexedDB rejects invalid initialization options", () => {
  assert.throws(() => new IndexedDbCanonicalLearningRepository({ openTimeoutMs: 0 }), RepositoryInvariantError);
  assert.throws(() => new IndexedDbCanonicalLearningRepository({ databaseName: " " }), RepositoryInvariantError);
});
test("persistence is opt-in and already persisted storage requires no prompt", async () => {
  let calls = 0;
  const storage = { persisted: async () => false, persist: async () => { calls++; return true; } };
  assert.equal(await canonicalPersistenceStatus(false, storage), "BEST_EFFORT");
  assert.equal(calls, 0);
  assert.equal(await canonicalPersistenceStatus(true, storage), "PERSISTED");
  assert.equal(calls, 1);
  assert.equal(await canonicalPersistenceStatus(true, { persisted: async () => true }), "PERSISTED");
});
test("persistence denial and exceptions remain nonfatal", async () => {
  assert.equal(await canonicalPersistenceStatus(true, { persist: async () => false }), "BEST_EFFORT");
  assert.equal(await canonicalPersistenceStatus(true, { persist: async () => { throw new Error("synthetic denial"); } }), "BEST_EFFORT");
  assert.equal(await canonicalPersistenceStatus(false, undefined), "UNAVAILABLE");
});
