import { stableJson, sha256 } from "../export/integrity";
import { rebuildProjections } from "../projections/rebuild";
import type { CanonicalEvent } from "../types";
import { uploadWithTimeout, type RemoteCheckpoint, type SyncAck, type SyncEnvelope } from "./protocol";
import type {
  RemoteCallContext,
  ShadowComparison,
  ShadowComparisonInput,
  RemoteShadowStore,
} from "./remote-store";

async function historyDigest(events: readonly CanonicalEvent[]): Promise<string> {
  return sha256(stableJson([...new Set(events.map(stableJson))].sort()));
}

export async function uploadShadowEnvelope(
  remote: RemoteShadowStore,
  context: RemoteCallContext,
  envelope: SyncEnvelope,
  timeoutMs = 5000,
): Promise<SyncAck> {
  return uploadWithTimeout(
    { upload: (value, signal) => remote.upload(context, value, signal) },
    envelope,
    timeoutMs,
  );
}

export async function compareShadowState(
  input: ShadowComparisonInput,
): Promise<ShadowComparison> {
  const pageSize = input.pageSize ?? 100;
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 500) {
    throw new Error("Invalid shadow comparison page size.");
  }
  const localEvents: CanonicalEvent[] = [];
  for await (const event of input.local.iterateEventsForExport()) localEvents.push(event);
  const eligible = localEvents.filter((event) => event.classification === "SYNC_ALLOWED");
  const controller = new AbortController();
  const remoteHealth = await input.remote.health(input.context("HEALTH", 0), controller.signal);
  const remoteEnvelopes: SyncEnvelope[] = [];
  let checkpoint: RemoteCheckpoint | null = null;
  for (let page = 0; page < 10_000; page++) {
    const result = await input.remote.pull(
      input.context("PULL", page),
      checkpoint,
      pageSize,
      controller.signal,
    );
    remoteEnvelopes.push(...result.envelopes);
    checkpoint = result.checkpoint;
    if (!result.hasMore) break;
    if (page === 9_999) throw new Error("Remote shadow pagination did not terminate.");
  }
  const remoteEvents = remoteEnvelopes.map((item) => item.event);
  const localCanonicalDigest = await historyDigest(eligible);
  const remoteCanonicalDigest = await historyDigest(remoteEvents);
  const [localProjection, remoteProjection] = await Promise.all([
    rebuildProjections(eligible, input.projectionPolicy),
    rebuildProjections(remoteEvents, input.projectionPolicy),
  ]);
  const reasons: string[] = [];
  if (eligible.length !== remoteEvents.length) reasons.push("CANONICAL_COUNT");
  if (localCanonicalDigest !== remoteCanonicalDigest) reasons.push("CANONICAL_DIGEST");
  if (localProjection.digest !== remoteProjection.digest) reasons.push("PROJECTION_DIGEST");
  if (remoteHealth.status !== "HEALTHY") reasons.push("REMOTE_HEALTH");
  return Object.freeze({
    status: reasons.length === 0 ? "MATCH" : "DIVERGED",
    remoteHealth,
    localCanonicalCount: localEvents.length,
    localSyncEligibleCount: eligible.length,
    remoteCanonicalCount: remoteEvents.length,
    localOutboxCount: await input.local.countOutboxJobs(),
    localCanonicalDigest,
    remoteCanonicalDigest,
    localProjectionDigest: localProjection.digest,
    remoteProjectionDigest: remoteProjection.digest,
    reasons: Object.freeze(reasons),
  });
}
