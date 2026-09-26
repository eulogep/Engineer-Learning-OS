import { z } from "zod";
import { UUIDV7_CANONICAL_PATTERN } from "../schemas";
import type { RemoteCallContext } from "../sync/remote-store";
import {
  RemoteStoreError,
  type SupabaseSessionMaterial,
  type SupabaseSessionResolver,
  type SupabaseShadowConfig,
} from "../sync/supabase-shadow";

const uuid = z.string().regex(UUIDV7_CANONICAL_PATTERN);

export type RemoteDeviceRegistrationResult = Readonly<{
  status: "REGISTERED";
  mode: "SHADOW";
}>;

export type RemoteDeviceRevocationResult = Readonly<{
  status: "REVOKED";
  deviceId: string;
}>;

export class SupabaseDeviceTrustClient {
  readonly #url: string;
  readonly #publishableKey: string;
  readonly #resolveSession: SupabaseSessionResolver;
  readonly #fetch: typeof fetch;

  constructor(
    config: SupabaseShadowConfig,
    resolveSession: SupabaseSessionResolver,
    fetchImplementation: typeof fetch = fetch,
  ) {
    let url: URL;
    try {
      url = new URL(config.projectUrl);
    } catch {
      throw new RemoteStoreError("INVALID_CONFIGURATION");
    }
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((!local && url.protocol !== "https:") || !config.publishableKey.startsWith("sb_publishable_")) {
      throw new RemoteStoreError("INVALID_CONFIGURATION");
    }
    this.#url = url.toString().replace(/\/$/, "");
    this.#publishableKey = config.publishableKey;
    this.#resolveSession = resolveSession;
    this.#fetch = fetchImplementation;
  }

  async #call(
    operation: "elos_register_device" | "elos_revoke_device",
    context: RemoteCallContext,
    extra: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<unknown> {
    if (!uuid.safeParse(context.learnerRef).success
      || !uuid.safeParse(context.deviceId).success
      || !uuid.safeParse(context.requestId).success
      || !Number.isSafeInteger(context.requestedAt)) {
      throw new RemoteStoreError("INVALID_CONTEXT");
    }
    let material: SupabaseSessionMaterial;
    try { material = await this.#resolveSession(context); }
    catch { throw new RemoteStoreError("INVALID_SESSION"); }
    if (material.accessToken.length < 20 || material.accessToken.length > 8192
      || material.deviceCredential.length < 32 || material.deviceCredential.length > 512
      || /\s/.test(material.accessToken) || /\s/.test(material.deviceCredential)) {
      throw new RemoteStoreError("INVALID_SESSION");
    }
    let response: Response;
    try {
      response = await this.#fetch(this.#url + "/rest/v1/rpc/" + operation, {
        method: "POST",
        headers: {
          apikey: this.#publishableKey,
          Authorization: "Bearer " + material.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_learner_ref: context.learnerRef,
          p_device_id: context.deviceId,
          p_request_id: context.requestId,
          p_requested_at: new Date(context.requestedAt).toISOString(),
          p_device_credential: material.deviceCredential,
          ...extra,
        }),
        signal,
      });
    } catch {
      throw new RemoteStoreError(signal.aborted ? "ABORTED" : "UNAVAILABLE");
    }
    if (!response.ok) {
      throw new RemoteStoreError(
        response.status === 401 || response.status === 403 ? "UNAUTHORIZED"
          : response.status === 409 ? "REMOTE_CONFLICT" : "REMOTE_REJECTED",
      );
    }
    try {
      return await response.json();
    } catch {
      throw new RemoteStoreError("INVALID_RESPONSE");
    }
  }

  async register(
    context: RemoteCallContext,
    clientKind: "DESKTOP" | "MOBILE_LIMITED_WRITE",
    expiresAt: number,
    signal: AbortSignal,
  ): Promise<RemoteDeviceRegistrationResult> {
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= context.requestedAt) {
      throw new RemoteStoreError("INVALID_CONTEXT");
    }
    const parsed = z.object({
      status: z.literal("REGISTERED"),
      mode: z.literal("SHADOW"),
    }).strict().safeParse(await this.#call("elos_register_device", context, {
      p_client_kind: clientKind,
      p_expires_at: new Date(expiresAt).toISOString(),
    }, signal));
    if (!parsed.success) throw new RemoteStoreError("INVALID_RESPONSE");
    return Object.freeze(parsed.data);
  }

  async revoke(
    context: RemoteCallContext,
    targetDeviceId: string,
    signal: AbortSignal,
  ): Promise<RemoteDeviceRevocationResult> {
    if (!uuid.safeParse(targetDeviceId).success) throw new RemoteStoreError("INVALID_CONTEXT");
    const parsed = z.object({
      status: z.literal("REVOKED"),
      deviceId: uuid,
    }).strict().safeParse(await this.#call("elos_revoke_device", context, {
      p_target_device_id: targetDeviceId,
    }, signal));
    if (!parsed.success || parsed.data.deviceId !== targetDeviceId) {
      throw new RemoteStoreError("INVALID_RESPONSE");
    }
    return Object.freeze(parsed.data);
  }
}
