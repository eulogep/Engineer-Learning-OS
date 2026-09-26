import { createEventId } from "../ids";
import type { CanonicalLearningRepository } from "../repository";
import { TombstonedEntityError } from "../repository-errors";
import type { SyncQueueJob } from "../sync-job";
import { makeSyncEnvelope, type RemoteCheckpoint } from "../sync/protocol";
import type { RemoteCallContext, RemoteShadowStore } from "../sync/remote-store";
import { SUPABASE_SHADOW_SCHEMA_VERSION } from "../sync/supabase-shadow";
import type { BrowserCanonicalIdentity } from "./browser-identity";
import type { RemoteSyncStage } from "./diagnostics";

export type RuntimeLocalRepository = CanonicalLearningRepository & Readonly<{
  iterateOutboxJobsForRecovery(batchSize?: number): AsyncIterable<SyncQueueJob>;
}>;

export type DeviceRegistrar = Readonly<{
  register(
    context: RemoteCallContext,
    clientKind: "DESKTOP",
    expiresAt: number,
    signal: AbortSignal,
  ): Promise<unknown>;
}>;

export type RemoteSyncResult = Readonly<{
  uploaded: number;
  downloaded: number;
  checkpoint: RemoteCheckpoint;
  acknowledgedJobIds: readonly string[];
}>;

function context(identity: BrowserCanonicalIdentity): RemoteCallContext {
  return Object.freeze({
    learnerRef: identity.learnerRef,
    deviceId: identity.deviceRef,
    requestId: createEventId(),
    requestedAt: Date.now(),
  });
}

async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, timeoutMs = 10_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await operation(controller.signal); }
  finally { clearTimeout(timer); }
}

export async function synchronizeRemoteMetadata(input: Readonly<{
  local: RuntimeLocalRepository;
  remote: RemoteShadowStore;
  registrar: DeviceRegistrar;
  identity: BrowserCanonicalIdentity;
  checkpoint: RemoteCheckpoint | null;
  acknowledgedJobIds?: ReadonlySet<string>;
  onStage?: (stage: RemoteSyncStage) => void;
}>): Promise<RemoteSyncResult> {
  const now = Date.now();
  input.onStage?.("DEVICE_REGISTER");
  await bounded((signal) => input.registrar.register(
    context(input.identity),
    "DESKTOP",
    now + 30 * 24 * 60 * 60 * 1_000,
    signal,
  ));
  input.onStage?.("SCHEMA_HEALTH");
  const health = await bounded((signal) => input.remote.health(context(input.identity), signal));
  if (health.status !== "HEALTHY" || health.schemaVersion !== SUPABASE_SHADOW_SCHEMA_VERSION) {
    throw new Error("REMOTE_SCHEMA_NOT_READY");
  }

  const acknowledged = new Set(input.acknowledgedJobIds ?? []);
  let uploaded = 0;
  input.onStage?.("LOCAL_OUTBOX");
  for await (const job of input.local.iterateOutboxJobsForRecovery(100)) {
    if (acknowledged.has(job.id)) continue;
    const event = await input.local.getEventById(job.eventId);
    if (!event) throw new Error("LOCAL_OUTBOX_EVENT_MISSING");
    if (event.deviceRef !== input.identity.deviceRef) continue;
    const envelope = await makeSyncEnvelope(event, job, {
      metadataTransfer: "APPROVED",
      companyRestricted: false,
    });
    input.onStage?.("REMOTE_UPLOAD");
    await bounded((signal) => input.remote.upload(context(input.identity), envelope, signal));
    acknowledged.add(job.id);
    uploaded++;
  }

  let checkpoint = input.checkpoint;
  let downloaded = 0;
  for (let pageIndex = 0; pageIndex < 10_000; pageIndex++) {
    input.onStage?.("REMOTE_PULL");
    const page = await bounded((signal) => input.remote.pull(
      context(input.identity), checkpoint, 100, signal,
    ));
    for (const envelope of page.envelopes) {
      input.onStage?.("LOCAL_APPLY");
      const event = envelope.event;
      if (event.learnerRef !== input.identity.learnerRef) throw new Error("REMOTE_IDENTITY_MISMATCH");
      if (event.eventType !== "DELETION_REQUESTED") {
        await input.local.putDefinition(event.definitionIdentity);
      }
      try {
        const result = await input.local.appendEvent(event);
        if (result.eventStatus === "APPENDED") downloaded++;
      } catch (error) {
        if (!(error instanceof TombstonedEntityError)) throw error;
      }
    }
    checkpoint = page.checkpoint;
    if (!page.hasMore) break;
    if (pageIndex === 9_999) throw new Error("REMOTE_PAGINATION_DID_NOT_TERMINATE");
  }
  if (!checkpoint) throw new Error("REMOTE_CHECKPOINT_MISSING");
  return Object.freeze({
    uploaded,
    downloaded,
    checkpoint,
    acknowledgedJobIds: Object.freeze([...acknowledged]),
  });
}
