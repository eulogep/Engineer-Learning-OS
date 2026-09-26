import assert from "node:assert/strict";
import test from "node:test";

const { InMemoryCanonicalLearningRepository } = await import(
  "../../../src/modules/learning-history/adapters/in-memory.ts"
);
const { remoteSyncConfiguration } = await import(
  "../../../src/modules/learning-history/remote/runtime-config.ts"
);
const { synchronizeRemoteMetadata } = await import(
  "../../../src/modules/learning-history/remote/synchronize.ts"
);
const { SUPABASE_SHADOW_SCHEMA_VERSION } = await import(
  "../../../src/modules/learning-history/sync/supabase-shadow.ts"
);
const { event, job, uuid } = await import("./sprint-fixtures.ts");
import type { RemoteShadowStore } from "../../../src/modules/learning-history/sync/remote-store.ts";
import type { DeviceId, LearnerRef } from "../../../src/modules/learning-history/types.ts";
import type { SyncEnvelope } from "../../../src/modules/learning-history/sync/protocol.ts";

test("production configuration requires the explicit switch and rejects secret keys", () => {
  assert.deepEqual(remoteSyncConfiguration({
    mode: "DISABLED",
    projectUrl: "https://synthetic.supabase.co",
    publishableKey: "sb_publishable_safe",
  }), { status: "DISABLED" });
  assert.equal(remoteSyncConfiguration({
    mode: "ACTIVE",
    projectUrl: "https://synthetic.supabase.co",
    publishableKey: "sb_secret_forbidden",
  }).status, "INVALID");
  assert.equal(remoteSyncConfiguration({
    mode: "ACTIVE",
    projectUrl: "http://synthetic.supabase.co",
    publishableKey: "sb_publishable_safe",
  }).status, "INVALID");
  assert.equal(remoteSyncConfiguration({
    mode: "ACTIVE",
    projectUrl: "https://synthetic.supabase.co/",
    publishableKey: "sb_publishable_safe",
  }).status, "READY");
});

test("runtime registers, uploads eligible local device jobs, pulls idempotently, and keeps the outbox", async () => {
  const local = new InMemoryCanonicalLearningRepository();
  const own = event(1);
  const anotherDevice = event(2, "MISSION_COMPLETED", { deviceRef: uuid(902) });
  await local.putDefinition(own.eventType === "DELETION_REQUESTED" ? (() => { throw new Error(); })() : own.definitionIdentity);
  await local.appendEventWithOutbox(own, job(own));
  await local.appendEventWithOutbox(anotherDevice, job(anotherDevice));

  const envelopes: SyncEnvelope[] = [];
  let registrations = 0;
  const remote: RemoteShadowStore = {
    async health() {
      return { status: "HEALTHY", schemaVersion: SUPABASE_SHADOW_SCHEMA_VERSION, mode: "SHADOW" };
    },
    async upload(context, envelope) {
      assert.equal(context.deviceId, uuid(901));
      envelopes.push(envelope);
      return {
        version: 1,
        jobId: envelope.job.id,
        eventId: envelope.event.id,
        idempotencyKey: envelope.job.idempotencyKey,
        digest: envelope.digest,
        checkpoint: { streamId: uuid(900), token: context.requestId, sequence: envelopes.length },
      };
    },
    async pull(_context, after) {
      return {
        envelopes,
        checkpoint: after ?? { streamId: uuid(900), token: uuid(900), sequence: 0 },
        hasMore: false,
      };
    },
  };
  const registrar = {
    async register() { registrations++; return { status: "REGISTERED" }; },
  };
  const identity = { learnerRef: uuid(900) as LearnerRef, deviceRef: uuid(901) as DeviceId };
  const first = await synchronizeRemoteMetadata({
    local, remote, registrar, identity, checkpoint: null,
  });
  assert.equal(registrations, 1);
  assert.equal(first.uploaded, 1);
  assert.equal(first.downloaded, 0);
  assert.equal(await local.countOutboxJobs(), 2);
  assert.deepEqual(first.acknowledgedJobIds, [job(own).id]);

  const second = await synchronizeRemoteMetadata({
    local,
    remote,
    registrar,
    identity,
    checkpoint: first.checkpoint,
    acknowledgedJobIds: new Set(first.acknowledgedJobIds),
  });
  assert.equal(second.uploaded, 0);
  assert.equal(envelopes.length, 1);
  assert.equal(await local.countOutboxJobs(), 2);
});

test("runtime fails closed before upload when remote schema health is not current", async () => {
  const local = new InMemoryCanonicalLearningRepository();
  const own = event(3);
  await local.appendEventWithOutbox(own, job(own));
  let uploads = 0;
  const remote: RemoteShadowStore = {
    async health() { return { status: "DEGRADED", schemaVersion: SUPABASE_SHADOW_SCHEMA_VERSION, mode: "SHADOW" }; },
    async upload() { uploads++; throw new Error("must not upload"); },
    async pull() { throw new Error("must not pull"); },
  };
  await assert.rejects(synchronizeRemoteMetadata({
    local,
    remote,
    registrar: { async register() { return {}; } },
    identity: { learnerRef: uuid(900) as LearnerRef, deviceRef: uuid(901) as DeviceId },
    checkpoint: null,
  }), /REMOTE_SCHEMA_NOT_READY/);
  assert.equal(uploads, 0);
  assert.equal(await local.countEvents(), 1);
});
