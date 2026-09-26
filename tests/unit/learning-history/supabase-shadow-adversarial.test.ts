import assert from "node:assert/strict";
import test from "node:test";

const { InMemoryCanonicalLearningRepository } = await import(
  "../../../src/modules/learning-history/adapters/in-memory.ts"
);
const { SupabaseDeviceTrustClient } = await import(
  "../../../src/modules/learning-history/auth/supabase-device-trust.ts"
);
const { compareShadowState, uploadShadowEnvelope } = await import(
  "../../../src/modules/learning-history/sync/shadow-sync.ts"
);
const { SupabaseShadowAdapter } = await import(
  "../../../src/modules/learning-history/sync/supabase-shadow.ts"
);
const { makeSyncEnvelope } = await import(
  "../../../src/modules/learning-history/sync/protocol.ts"
);
const { event, job, policy, uuid } = await import("./sprint-fixtures.ts");
const { SyntheticSupabaseGateway } = await import("./synthetic-supabase.ts");

const config = {
  projectUrl: "https://synthetic.supabase.co",
  publishableKey: "sb_publishable_synthetic_test_key",
};
const credentialA = "synthetic-device-credential-aaaaaaaaaaaaaaaa";
const credentialB = "synthetic-device-credential-bbbbbbbbbbbbbbbb";
const tokenA = "synthetic.session.token.user.a.000000";
const tokenB = "synthetic.session.token.user.b.000000";
const context = (deviceId: string, requestId: number, learnerRef = uuid(900)) => ({
  learnerRef,
  deviceId,
  requestId: uuid(requestId),
  requestedAt: 100,
});

test("synthetic Supabase proves registration, idempotence, pull, and shadow equality", async () => {
  const gateway = new SyntheticSupabaseGateway();
  const session = async () => ({ accessToken: tokenA, deviceCredential: credentialA });
  const trust = new SupabaseDeviceTrustClient(config, session, gateway.fetch);
  const remote = new SupabaseShadowAdapter(config, session, gateway.fetch);
  await trust.register(context(uuid(901), 10), "DESKTOP", 10_000, new AbortController().signal);
  const canonical = event(1);
  const outbox = job(canonical);
  const envelope = await makeSyncEnvelope(canonical, outbox, {
    metadataTransfer: "APPROVED",
    companyRestricted: false,
  });
  const first = await uploadShadowEnvelope(remote, context(uuid(901), 11), envelope);
  const duplicate = await uploadShadowEnvelope(remote, context(uuid(901), 12), envelope);
  assert.deepEqual(duplicate, first);
  assert.equal(gateway.sequence, 1);
  const local = new InMemoryCanonicalLearningRepository();
  await local.appendEventWithOutbox(canonical, outbox);
  const comparison = await compareShadowState({
    local,
    remote,
    projectionPolicy: policy,
    context: (_operation, sequence) => context(uuid(901), 20 + sequence),
    pageSize: 1,
  });
  assert.equal(comparison.status, "MATCH");
  assert.equal(comparison.remoteHealth.schemaVersion, 8);
});

test("a different authenticated user cannot read or write another learner stream", async () => {
  const gateway = new SyntheticSupabaseGateway();
  const ownerSession = async () => ({ accessToken: tokenA, deviceCredential: credentialA });
  const attackerSession = async () => ({ accessToken: tokenB, deviceCredential: credentialB });
  const ownerTrust = new SupabaseDeviceTrustClient(config, ownerSession, gateway.fetch);
  await ownerTrust.register(context(uuid(901), 30), "DESKTOP", 10_000, new AbortController().signal);
  const attacker = new SupabaseShadowAdapter(config, attackerSession, gateway.fetch);
  await assert.rejects(
    attacker.health(context(uuid(901), 31), new AbortController().signal),
    { reason: "UNAUTHORIZED" },
  );
  const attackerTrust = new SupabaseDeviceTrustClient(config, attackerSession, gateway.fetch);
  await assert.rejects(
    attackerTrust.register(context(uuid(902), 32), "DESKTOP", 10_000, new AbortController().signal),
    { reason: "UNAUTHORIZED" },
  );
});

test("revocation immediately rejects stale reconnect while another device remains authorized", async () => {
  const gateway = new SyntheticSupabaseGateway();
  const material = new Map([
    [uuid(901), credentialA],
    [uuid(902), credentialB],
  ]);
  const session = async (value: { deviceId: string }) => ({
    accessToken: tokenA,
    deviceCredential: material.get(value.deviceId) ?? "",
  });
  const trust = new SupabaseDeviceTrustClient(config, session, gateway.fetch);
  const remote = new SupabaseShadowAdapter(config, session, gateway.fetch);
  await trust.register(context(uuid(901), 40), "DESKTOP", 10_000, new AbortController().signal);
  await trust.register(context(uuid(902), 41), "MOBILE_LIMITED_WRITE", 10_000, new AbortController().signal);
  await trust.revoke(context(uuid(902), 42), uuid(901), new AbortController().signal);
  await assert.rejects(
    remote.health(context(uuid(901), 43), new AbortController().signal),
    { reason: "UNAUTHORIZED" },
  );
  assert.equal(
    (await remote.health(context(uuid(902), 44), new AbortController().signal)).status,
    "HEALTHY",
  );
});
