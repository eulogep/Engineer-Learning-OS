import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
const { SupabaseShadowAdapter, RemoteStoreError } = await import(
  "../../../src/modules/learning-history/sync/supabase-shadow.ts"
);
const { makeSyncEnvelope } = await import(
  "../../../src/modules/learning-history/sync/protocol.ts"
);
const { event, job, policy, uuid } = await import("./sprint-fixtures.ts");
import type { RemoteShadowStore } from "../../../src/modules/learning-history/sync/remote-store.ts";
import type { SyncEnvelope } from "../../../src/modules/learning-history/sync/protocol.ts";

const config = {
  projectUrl: "https://synthetic.supabase.co",
  publishableKey: "sb_publishable_synthetic_test_key",
};
const material = {
  accessToken: "synthetic.session.token.with.safe.length",
  deviceCredential: "synthetic-device-credential-0000000000000000",
};
const context = (request = 10) => ({
  learnerRef: uuid(900),
  deviceId: uuid(901),
  requestId: uuid(request),
  requestedAt: 100,
});

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("Supabase adapter uses authenticated RPC and validates the ACK", async () => {
  const canonical = event(1);
  const envelope = await makeSyncEnvelope(canonical, job(canonical), {
    metadataTransfer: "APPROVED",
    companyRestricted: false,
  });
  let captured: { url: string; init: RequestInit } | undefined;
  const adapter = new SupabaseShadowAdapter(config, async () => material, async (url, init) => {
    captured = { url: String(url), init: init ?? {} };
    return jsonResponse({
      version: 1,
      jobId: envelope.job.id,
      eventId: envelope.event.id,
      idempotencyKey: envelope.job.idempotencyKey,
      digest: envelope.digest,
      checkpoint: { streamId: uuid(900), token: uuid(10), sequence: 1 },
    });
  });
  const ack = await uploadShadowEnvelope(adapter, context(), envelope, 1_000);
  assert.equal(ack.eventId, canonical.id);
  assert.equal(captured?.url, "https://synthetic.supabase.co/rest/v1/rpc/elos_sync_upload");
  const headers = captured?.init.headers as Record<string, string>;
  assert.equal(headers.apikey, config.publishableKey);
  assert.equal(headers.Authorization, "Bearer " + material.accessToken);
  const body = JSON.parse(String(captured?.init.body));
  assert.equal(body.p_device_credential, material.deviceCredential);
  assert.equal(body.p_envelope.event.classification, "SYNC_ALLOWED");
});

test("adapter rejects secret keys, invalid classifications, bad responses, and sanitized HTTP failures", async () => {
  assert.throws(
    () => new SupabaseShadowAdapter({ ...config, publishableKey: "sb_secret_forbidden" }, async () => material),
    { reason: "INVALID_CONFIGURATION" },
  );
  let calls = 0;
  const canonical = event(1);
  const envelope = await makeSyncEnvelope(canonical, job(canonical), {
    metadataTransfer: "APPROVED",
    companyRestricted: false,
  });
  const adapter = new SupabaseShadowAdapter(config, async () => material, async () => {
    calls++;
    return jsonResponse({ private: "must-not-surface" }, 403);
  });
  const tampered = {
    ...envelope,
    event: { ...envelope.event, classification: "LOCAL_ONLY" },
  } as SyncEnvelope;
  await assert.rejects(adapter.upload(context(), tampered, new AbortController().signal));
  assert.equal(calls, 0);
  await assert.rejects(
    adapter.upload(context(), envelope, new AbortController().signal),
    (error: unknown) => error instanceof RemoteStoreError
      && error.reason === "UNAUTHORIZED"
      && !error.message.includes("must-not-surface"),
  );
});

test("device registration and revocation use separate authenticated RPCs", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const client = new SupabaseDeviceTrustClient(config, async () => material, async (url, init) => {
    const body = JSON.parse(String(init?.body));
    calls.push({ url: String(url), body });
    return jsonResponse(String(url).endsWith("elos_register_device")
      ? { status: "REGISTERED", mode: "SHADOW" }
      : { status: "REVOKED", deviceId: uuid(902) });
  });
  await client.register(context(), "DESKTOP", 1_000, new AbortController().signal);
  await client.revoke(context(11), uuid(902), new AbortController().signal);
  assert.match(calls[0].url, /elos_register_device$/);
  assert.equal(calls[0].body.p_client_kind, "DESKTOP");
  assert.match(calls[1].url, /elos_revoke_device$/);
  assert.equal(calls[1].body.p_target_device_id, uuid(902));
});

test("shadow comparison distinguishes total local history from remotely eligible history", async () => {
  const local = new InMemoryCanonicalLearningRepository();
  const syncable = event(1);
  const localOnly = event(2, "MISSION_COMPLETED", { classification: "LOCAL_ONLY" });
  await local.appendEventWithOutbox(syncable, job(syncable));
  await local.appendEvent(localOnly);
  const envelope = await makeSyncEnvelope(syncable, job(syncable), {
    metadataTransfer: "APPROVED",
    companyRestricted: false,
  });
  const remote: RemoteShadowStore = {
    upload: async () => { throw new Error("unused"); },
    health: async () => ({ status: "HEALTHY", schemaVersion: 1, mode: "SHADOW" }),
    pull: async (_context, after) => ({
      envelopes: after ? [] : [envelope],
      checkpoint: { streamId: uuid(900), token: uuid(10), sequence: 1 },
      hasMore: false,
    }),
  };
  const result = await compareShadowState({
    local,
    remote,
    projectionPolicy: policy,
    context: (_operation, sequence) => context(10 + sequence),
  });
  assert.equal(result.status, "MATCH");
  assert.equal(result.localCanonicalCount, 2);
  assert.equal(result.localSyncEligibleCount, 1);
  assert.equal(result.remoteCanonicalCount, 1);
  assert.equal(result.localOutboxCount, 1);
});

test("shadow comparison reports deterministic count, canonical, and projection divergence", async () => {
  const local = new InMemoryCanonicalLearningRepository();
  const canonical = event(1);
  await local.appendEventWithOutbox(canonical, job(canonical));
  const remote: RemoteShadowStore = {
    upload: async () => { throw new Error("unused"); },
    health: async () => ({ status: "DEGRADED", schemaVersion: 1, mode: "SHADOW" }),
    pull: async () => ({
      envelopes: [],
      checkpoint: { streamId: uuid(900), token: uuid(900), sequence: 0 },
      hasMore: false,
    }),
  };
  const result = await compareShadowState({
    local,
    remote,
    projectionPolicy: policy,
    context: (_operation, sequence) => context(20 + sequence),
  });
  assert.equal(result.status, "DIVERGED");
  assert.deepEqual(result.reasons, [
    "CANONICAL_COUNT",
    "CANONICAL_DIGEST",
    "PROJECTION_DIGEST",
    "REMOTE_HEALTH",
  ]);
});

test("migration enforces RLS, user/device isolation, replay rejection, and classification server-side", async () => {
  const sql = await readFile(
    new URL("../../../supabase/migrations/202609130001_elos_shadow_sync.sql", import.meta.url),
    "utf8",
  );
  for (const required of [
    "enable row level security",
    "force row level security",
    "auth.uid()",
    "assert_active_device",
    "credential_hash",
    "request_replayed",
    "canonical_identity_conflict",
    "classification' <> 'SYNC_ALLOWED",
    "deletion_tombstones",
    "revoke all on all tables",
    "security definer",
  ]) assert.ok(sql.toLowerCase().includes(required.toLowerCase()), required);
  assert.doesNotMatch(sql, /service_role|sb_secret_/i);
});

test("Supabase health fails closed on an unsupported remote schema version", async () => {
  const adapter = new SupabaseShadowAdapter(config, async () => material, async () => jsonResponse({
    status: "HEALTHY",
    schemaVersion: 2,
    mode: "SHADOW",
  }));
  await assert.rejects(
    adapter.health(context(), new AbortController().signal),
    { reason: "INVALID_RESPONSE" },
  );
});
