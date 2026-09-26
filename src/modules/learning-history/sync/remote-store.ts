import type { ProjectionPolicy } from "../projections/rebuild";
import type { CanonicalLearningRepository } from "../repository";
import type { RemoteCheckpoint, SyncAck, SyncEnvelope } from "./protocol";

export type RemoteCallContext = Readonly<{
  learnerRef: string;
  deviceId: string;
  requestId: string;
  requestedAt: number;
}>;

export type RemotePullPage = Readonly<{
  envelopes: readonly SyncEnvelope[];
  checkpoint: RemoteCheckpoint;
  hasMore: boolean;
}>;

export type RemoteHealth = Readonly<{
  status: "HEALTHY" | "DEGRADED";
  schemaVersion: number;
  mode: "SHADOW";
}>;

export interface RemoteShadowStore {
  upload(
    context: RemoteCallContext,
    envelope: SyncEnvelope,
    signal: AbortSignal,
  ): Promise<SyncAck>;
  pull(
    context: RemoteCallContext,
    after: RemoteCheckpoint | null,
    limit: number,
    signal: AbortSignal,
  ): Promise<RemotePullPage>;
  health(context: RemoteCallContext, signal: AbortSignal): Promise<RemoteHealth>;
}

export type ShadowComparison = Readonly<{
  status: "MATCH" | "DIVERGED";
  remoteHealth: RemoteHealth;
  localCanonicalCount: number;
  localSyncEligibleCount: number;
  remoteCanonicalCount: number;
  localOutboxCount: number;
  localCanonicalDigest: string;
  remoteCanonicalDigest: string;
  localProjectionDigest: string;
  remoteProjectionDigest: string;
  reasons: readonly string[];
}>;

export type ShadowComparisonInput = Readonly<{
  local: CanonicalLearningRepository;
  remote: RemoteShadowStore;
  projectionPolicy: ProjectionPolicy;
  context: (operation: "HEALTH" | "PULL", sequence: number) => RemoteCallContext;
  pageSize?: number;
}>;
