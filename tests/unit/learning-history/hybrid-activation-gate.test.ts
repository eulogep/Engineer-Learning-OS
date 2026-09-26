import assert from "node:assert/strict";
import test from "node:test";

const {
  HOSTED_CONFIRMATION_SCENARIOS,
  HYBRID_ACTIVATION_SCENARIOS,
  evaluateHybridActivationGate,
  authorizeHybridActivation,
} = await import("../../../src/modules/learning-history/operations/activation-gate.ts");

const refs = {
  CANONICAL_EXPORT: "export-restore.test.ts: valid history round-trip",
  FRESH_RESTORE: "operational-reliability.test.ts: fresh-profile restore",
  PROJECTION_REBUILD: "projections.test.ts: rebuild after portable restore",
  LOCAL_ROLLBACK: "export-restore.test.ts: source unchanged and verified target",
  ADDITIVE_MIGRATION: "supabase-schema-security.test.ts: additive migrations",
  SHADOW_COMPARISON: "supabase-shadow.test.ts: count and digest comparison",
  OFFLINE: "multi-device.test.ts: both offline",
  RECONNECT: "sync-protocol.test.ts: offline reconnect",
  DUPLICATE_DELIVERY: "multi-device.test.ts: seeded duplicate schedules",
  LOST_ACK: "sync-protocol.test.ts: lost ACK retains outbox identity",
  MULTI_DEVICE: "multi-device.test.ts: deterministic convergence",
  STALE_DEVICE: "multi-device.test.ts: stale history cannot resurrect state",
  REVOCATION: "supabase-shadow-adversarial.test.ts: revoked reconnect rejected",
  DELETION: "operational-reliability.test.ts: deletion propagation",
  TOMBSTONE: "projections.test.ts: deletion dominates arrival order",
  AUTH_FAILURE: "device-trust.test.ts: invalid and expired sessions fail closed",
  PROVIDER_OUTAGE: "sync-protocol.test.ts: timeout and bounded retry",
  REMOTE_CORRUPTION: "supabase-shadow.test.ts: deterministic divergence",
  SCHEMA_VERSION_MISMATCH: "export-restore.test.ts: unsupported versions fail closed",
  BACKUP_RESTORE: "operational-reliability.test.ts: checksum and restore trust",
  DEVICE_REPLACEMENT: "device-trust.test.ts: lost-device replacement flow",
  INDEPENDENT_QA: "learning-history suite and selected cross-module regressions",
  SECURITY_REVIEW: "supabase-schema-security.test.ts: privilege and JSON boundaries",
} as const;

function localEvidence() {
  return HYBRID_ACTIVATION_SCENARIOS.map((scenario) => ({
    scenario,
    environment: "LOCAL_SYNTHETIC" as const,
    result: "PASS" as const,
    deterministic: true,
    expectedOutcome: "Fail closed or converge without canonical loss.",
    actualOutcome: "Matched deterministic expectation.",
    evidenceRef: refs[scenario],
  }));
}

test("S local gate executes every required deterministic scenario and waits for hosted proof", () => {
  assert.equal(HYBRID_ACTIVATION_SCENARIOS.length, 23);
  assert.equal(new Set(HYBRID_ACTIVATION_SCENARIOS).size, 23);
  const gate = evaluateHybridActivationGate(localEvidence());
  assert.equal(gate.status, "WAITING_FOR_HOSTED_EVIDENCE");
  assert.equal(gate.localSyntheticComplete, true);
  assert.equal(gate.hostedConfirmationComplete, false);
  assert.equal(gate.productionActivationAllowed, false);
  assert.equal(gate.failed.length, 0);
  assert.equal(gate.missing.length, HOSTED_CONFIRMATION_SCENARIOS.size);
});

test("S gate fails closed for missing, failed, or non-deterministic local evidence", () => {
  const missing = evaluateHybridActivationGate(localEvidence().slice(1));
  assert.equal(missing.status, "FAIL");
  assert.ok(missing.missing.includes("LOCAL_SYNTHETIC:CANONICAL_EXPORT"));

  const failedEvidence = localEvidence().map((item, index) => (
    index === 0 ? { ...item, result: "FAIL" as const } : item
  ));
  assert.equal(evaluateHybridActivationGate(failedEvidence).status, "FAIL");

  const ambiguousEvidence = localEvidence().map((item, index) => (
    index === 1 ? { ...item, deterministic: false } : item
  ));
  assert.equal(evaluateHybridActivationGate(ambiguousEvidence).status, "FAIL");
});

test("S hosted proof can reach the human decision gate but can never activate production", () => {
  const hosted = [...HOSTED_CONFIRMATION_SCENARIOS].map((scenario) => ({
    scenario,
    environment: "HOSTED_SUPABASE" as const,
    result: "PASS" as const,
    deterministic: true,
    expectedOutcome: "Hosted behavior matches the local contract.",
    actualOutcome: "Hosted behavior matched.",
    evidenceRef: `hosted-drill:${scenario}`,
  }));
  const gate = evaluateHybridActivationGate([...localEvidence(), ...hosted]);
  assert.equal(gate.status, "READY_FOR_HUMAN_DECISION");
  assert.equal(gate.hostedConfirmationComplete, true);
  assert.equal(gate.productionActivationAllowed, false);
});

test("S gate rejects duplicate evidence", () => {
  const evidence = localEvidence();
  assert.throws(() => evaluateHybridActivationGate([...evidence, evidence[0]]));
});


test("S production activation requires both complete evidence and an explicit approval", () => {
  const hosted = [...HOSTED_CONFIRMATION_SCENARIOS].map((scenario) => ({
    scenario,
    environment: "HOSTED_SUPABASE" as const,
    result: "PASS" as const,
    deterministic: true,
    expectedOutcome: "Hosted behavior matches the local contract.",
    actualOutcome: "Hosted behavior matched.",
    evidenceRef: "hosted-drill:" + scenario,
  }));
  const gate = evaluateHybridActivationGate([...localEvidence(), ...hosted]);
  assert.deepEqual(authorizeHybridActivation(gate, "REJECTED"), {
    status: "BLOCKED", productionActivationAllowed: false,
  });
  assert.deepEqual(authorizeHybridActivation(gate, "APPROVED"), {
    status: "ACTIVE", productionActivationAllowed: true,
  });
  assert.equal(
    authorizeHybridActivation(evaluateHybridActivationGate(localEvidence()), "APPROVED")
      .productionActivationAllowed,
    false,
  );
});
