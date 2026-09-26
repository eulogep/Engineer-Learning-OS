import { z } from "zod";
import { UUIDV7_CANONICAL_PATTERN } from "../schemas";
import {
  acceptAck,
  advanceRemoteCheckpoint,
  validateSyncEnvelope,
  type RemoteCheckpoint,
  type SyncAck,
  type SyncEnvelope,
} from "./protocol";
import type {
  RemoteCallContext,
  RemoteHealth,
  RemotePullPage,
  RemoteShadowStore,
} from "./remote-store";

export const SUPABASE_SHADOW_ENV = Object.freeze({
  projectUrl: "NEXT_PUBLIC_SUPABASE_URL",
  publishableKey: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
} as const);

export type SupabaseShadowConfig = Readonly<{
  projectUrl: string;
  publishableKey: string;
}>;

export type SupabaseSessionMaterial = Readonly<{
  accessToken: string;
  deviceCredential: string;
}>;

export type SupabaseSessionResolver = (
  context: RemoteCallContext,
) => Promise<SupabaseSessionMaterial>;

export class RemoteStoreError extends Error {
  readonly reason:
    | "INVALID_CONFIGURATION"
    | "INVALID_CONTEXT"
    | "INVALID_SESSION"
    | "UNAUTHORIZED"
    | "REMOTE_CONFLICT"
    | "REMOTE_REJECTED"
    | "INVALID_RESPONSE"
    | "UNAVAILABLE"
    | "ABORTED";

  constructor(reason: RemoteStoreError["reason"]) {
    super("Remote shadow store: " + reason);
    this.name = "RemoteStoreError";
    this.reason = reason;
  }
}

const uuid = z.string().regex(UUIDV7_CANONICAL_PATTERN);
const contextSchema = z.object({
  learnerRef: uuid,
  deviceId: uuid,
  requestId: uuid,
  requestedAt: z.number().int().nonnegative().safe(),
}).strict();
export const SUPABASE_SHADOW_SCHEMA_VERSION = 8 as const;
const healthSchema = z.object({
  status: z.enum(["HEALTHY", "DEGRADED"]),
  schemaVersion: z.literal(SUPABASE_SHADOW_SCHEMA_VERSION),
  mode: z.literal("SHADOW"),
}).strict();
const pullSchema = z.object({
  envelopes: z.array(z.unknown()),
  checkpoint: z.unknown(),
  hasMore: z.boolean(),
}).strict();

function configuration(raw: SupabaseShadowConfig): SupabaseShadowConfig {
  let url: URL;
  try {
    url = new URL(raw.projectUrl);
  } catch {
    throw new RemoteStoreError("INVALID_CONFIGURATION");
  }
  const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if ((!local && url.protocol !== "https:") || (local && !["http:", "https:"].includes(url.protocol))
    || url.username || url.password || url.search || url.hash
    || !raw.publishableKey.startsWith("sb_publishable_")
    || raw.publishableKey.length > 512) {
    throw new RemoteStoreError("INVALID_CONFIGURATION");
  }
  return Object.freeze({
    projectUrl: url.toString().replace(/\/$/, ""),
    publishableKey: raw.publishableKey,
  });
}

function callContext(raw: RemoteCallContext): RemoteCallContext {
  const parsed = contextSchema.safeParse(raw);
  if (!parsed.success) throw new RemoteStoreError("INVALID_CONTEXT");
  return Object.freeze(parsed.data);
}

function sessionMaterial(raw: SupabaseSessionMaterial): SupabaseSessionMaterial {
  if (typeof raw?.accessToken !== "string" || raw.accessToken.length < 20
    || raw.accessToken.length > 8192 || /\s/.test(raw.accessToken)
    || typeof raw.deviceCredential !== "string" || raw.deviceCredential.length < 32
    || raw.deviceCredential.length > 512 || /\s/.test(raw.deviceCredential)) {
    throw new RemoteStoreError("INVALID_SESSION");
  }
  return raw;
}

export class SupabaseShadowAdapter implements RemoteShadowStore {
  readonly #config: SupabaseShadowConfig;
  readonly #resolveSession: SupabaseSessionResolver;
  readonly #fetch: typeof fetch;

  constructor(
    rawConfig: SupabaseShadowConfig,
    resolveSession: SupabaseSessionResolver,
    fetchImplementation: typeof fetch = fetch,
  ) {
    this.#config = configuration(rawConfig);
    this.#resolveSession = resolveSession;
    this.#fetch = fetchImplementation;
  }

  async #rpc(
    name: "elos_sync_upload" | "elos_sync_pull" | "elos_sync_health",
    rawContext: RemoteCallContext,
    body: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown> {
    const context = callContext(rawContext);
    let material: SupabaseSessionMaterial;
    try {
      material = sessionMaterial(await this.#resolveSession(context));
    } catch (error) {
      if (error instanceof RemoteStoreError) throw error;
      throw new RemoteStoreError("INVALID_SESSION");
    }
    let response: Response;
    try {
      response = await this.#fetch(
        this.#config.projectUrl + "/rest/v1/rpc/" + name,
        {
          method: "POST",
          headers: {
            apikey: this.#config.publishableKey,
            Authorization: "Bearer " + material.accessToken,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...body,
            p_learner_ref: context.learnerRef,
            p_device_id: context.deviceId,
            p_request_id: context.requestId,
            p_requested_at: new Date(context.requestedAt).toISOString(),
            p_device_credential: material.deviceCredential,
          }),
          signal,
        },
      );
    } catch (error) {
      if (signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
        throw new RemoteStoreError("ABORTED");
      }
      throw new RemoteStoreError("UNAVAILABLE");
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new RemoteStoreError("UNAUTHORIZED");
      }
      if (response.status === 409) throw new RemoteStoreError("REMOTE_CONFLICT");
      throw new RemoteStoreError("REMOTE_REJECTED");
    }
    try {
      return await response.json();
    } catch {
      throw new RemoteStoreError("INVALID_RESPONSE");
    }
  }

  async upload(
    context: RemoteCallContext,
    envelope: SyncEnvelope,
    signal: AbortSignal,
  ): Promise<SyncAck> {
    const validated = await validateSyncEnvelope(envelope);
    const raw = await this.#rpc("elos_sync_upload", context, { p_envelope: validated }, signal);
    try {
      return acceptAck(validated, raw);
    } catch {
      throw new RemoteStoreError("INVALID_RESPONSE");
    }
  }

  async pull(
    context: RemoteCallContext,
    after: RemoteCheckpoint | null,
    limit: number,
    signal: AbortSignal,
  ): Promise<RemotePullPage> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
      throw new RemoteStoreError("INVALID_CONTEXT");
    }
    const raw = await this.#rpc(
      "elos_sync_pull",
      context,
      { p_after: after, p_limit: limit },
      signal,
    );
    const parsed = pullSchema.safeParse(raw);
    if (!parsed.success) throw new RemoteStoreError("INVALID_RESPONSE");
    try {
      const envelopes = await Promise.all(parsed.data.envelopes.map(validateSyncEnvelope));
      const checkpoint = advanceRemoteCheckpoint(after, parsed.data.checkpoint as RemoteCheckpoint);
      return Object.freeze({ envelopes, checkpoint, hasMore: parsed.data.hasMore });
    } catch {
      throw new RemoteStoreError("INVALID_RESPONSE");
    }
  }

  async health(context: RemoteCallContext, signal: AbortSignal): Promise<RemoteHealth> {
    const parsed = healthSchema.safeParse(
      await this.#rpc("elos_sync_health", context, {}, signal),
    );
    if (!parsed.success) throw new RemoteStoreError("INVALID_RESPONSE");
    return Object.freeze(parsed.data);
  }
}
