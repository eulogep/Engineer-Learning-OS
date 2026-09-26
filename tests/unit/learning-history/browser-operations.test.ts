import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeBrowserRecoveryFile,
  encodeBrowserRecoveryFile,
  recoveryFilename,
} from "../../../src/modules/learning-history/export/browser-file.ts";
import { EXPORT_PATHS, RecoveryError } from "../../../src/modules/learning-history/export/export-format.ts";
import { canonicalOperationsStatus } from "../../../src/modules/learning-history/operations/browser-status.ts";

const bundle = Object.freeze({
  [EXPORT_PATHS.manifest]: "{}\n",
  [EXPORT_PATHS.events]: "",
  [EXPORT_PATHS.outbox]: "",
  [EXPORT_PATHS.definitions]: "",
  [EXPORT_PATHS.references]: "",
});

test("browser recovery envelope round-trips only the five canonical files", () => {
  assert.deepEqual(decodeBrowserRecoveryFile(encodeBrowserRecoveryFile(bundle)), bundle);
  assert.equal(recoveryFilename(Date.UTC(2026, 8, 13)), "engineer-learning-os-recovery-2026-09-13.json");
});

test("browser recovery envelope rejects malformed, missing, and extra data", () => {
  for (const value of [
    "not-json",
    JSON.stringify({ kind: "ELOS_CANONICAL_RECOVERY_FILE", version: 1, program: "ENGINEER_LEARNING_OS_V1", files: {} }),
    JSON.stringify({ kind: "ELOS_CANONICAL_RECOVERY_FILE", version: 1, program: "ENGINEER_LEARNING_OS_V1", files: { ...bundle, extra: "" } }),
  ]) {
    assert.throws(() => decodeBrowserRecoveryFile(value), RecoveryError);
  }
});

test("operational status distinguishes persistence, recovery, and sanitized failure states", () => {
  canonicalOperationsStatus.reset();
  assert.equal(canonicalOperationsStatus.getSnapshot().recovery, "UNRESTORED");
  canonicalOperationsStatus.reconciling();
  assert.equal(canonicalOperationsStatus.getSnapshot().health, "RECONCILING");
  canonicalOperationsStatus.ready("PERSISTED", 12, 7);
  assert.deepEqual(
    { health: canonicalOperationsStatus.getSnapshot().health, events: canonicalOperationsStatus.getSnapshot().eventCount },
    { health: "HEALTHY", events: 12 },
  );
  canonicalOperationsStatus.restoring();
  assert.equal(canonicalOperationsStatus.getSnapshot().recovery, "RESTORING");
  canonicalOperationsStatus.restored(12, 2);
  assert.equal(canonicalOperationsStatus.getSnapshot().recovery, "RESTORED");
  canonicalOperationsStatus.ready("BEST_EFFORT", 12, 7);
  assert.equal(canonicalOperationsStatus.getSnapshot().health, "BEST_EFFORT");
  canonicalOperationsStatus.ready("UNAVAILABLE", 12, 7);
  assert.equal(canonicalOperationsStatus.getSnapshot().health, "UNAVAILABLE");
  canonicalOperationsStatus.recoveryFailed();
  assert.equal(canonicalOperationsStatus.getSnapshot().recovery, "FAILED");
  canonicalOperationsStatus.failed("QUOTA_EXCEEDED");
  assert.deepEqual(
    { health: canonicalOperationsStatus.getSnapshot().health, failure: canonicalOperationsStatus.getSnapshot().failure },
    { health: "FAILED", failure: "QUOTA_EXCEEDED" },
  );
  canonicalOperationsStatus.reset();
});
