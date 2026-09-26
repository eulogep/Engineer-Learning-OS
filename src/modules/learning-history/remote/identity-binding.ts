import { z } from "zod";
import { UUIDV7_CANONICAL_PATTERN } from "../schemas";
import { RemoteStoreError, type SupabaseShadowConfig } from "../sync/supabase-shadow";
import type { LearnerRef } from "../types";

const responseSchema = z.object({
  status: z.enum(["UNCHANGED", "REBOUND"]),
  learnerRef: z.string().regex(UUIDV7_CANONICAL_PATTERN),
  rebindId: z.string().uuid().nullable(),
}).strict();
const rollbackResponseSchema = z.object({
  status: z.literal("ROLLED_BACK"),
  rebindId: z.string().uuid(),
}).strict();

export type LearnerIdentityRebindResult = Readonly<{
  status: "UNCHANGED" | "REBOUND";
  learnerRef: LearnerRef;
  rebindId: string | null;
}>;

export class LearnerIdentityBindingError extends Error {
  readonly reason: "NOT_PRISTINE" | "STALE_RESOLUTION" | "IDENTITY_CONFLICT";
  constructor(reason: LearnerIdentityBindingError["reason"]) {
    super("Learner identity binding: " + reason);
    this.name = "LearnerIdentityBindingError";
    this.reason = reason;
  }
}

async function safeFailureReason(response: Response): Promise<LearnerIdentityBindingError["reason"] | null> {
  try {
    const value = await response.json() as { message?: unknown };
    if (value.message === "learner_identity_not_pristine") return "NOT_PRISTINE";
    if (value.message === "learner_identity_changed") return "STALE_RESOLUTION";
    if (value.message === "learner_identity_conflict") return "IDENTITY_CONFLICT";
  } catch { /* The provider response is intentionally discarded. */ }
  return null;
}

export async function rebindPristineSupabaseLearnerIdentity(
  config: SupabaseShadowConfig,
  accessToken: string,
  expectedRemoteLearnerRef: LearnerRef,
  localLearnerRef: LearnerRef,
  signal: AbortSignal,
  fetchImplementation: typeof fetch = fetch,
): Promise<LearnerIdentityRebindResult> {
  if (!config.publishableKey.startsWith("sb_publishable_")
    || config.publishableKey.startsWith("sb_secret_")
    || accessToken.length < 20 || accessToken.length > 8192 || /\s/.test(accessToken)
    || !UUIDV7_CANONICAL_PATTERN.test(expectedRemoteLearnerRef)
    || !UUIDV7_CANONICAL_PATTERN.test(localLearnerRef)) {
    throw new RemoteStoreError("INVALID_SESSION");
  }
  let response: Response;
  try {
    response = await fetchImplementation(
      config.projectUrl.replace(/\/$/, "") + "/rest/v1/rpc/elos_rebind_pristine_learner_identity",
      {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_expected_remote_learner_ref: expectedRemoteLearnerRef,
          p_local_learner_ref: localLearnerRef,
        }),
        signal,
      },
    );
  } catch {
    throw new RemoteStoreError(signal.aborted ? "ABORTED" : "UNAVAILABLE");
  }
  if (!response.ok) {
    const bindingReason = await safeFailureReason(response);
    if (bindingReason) throw new LearnerIdentityBindingError(bindingReason);
    throw new RemoteStoreError(
      response.status === 401 || response.status === 403 ? "UNAUTHORIZED"
        : response.status === 409 ? "REMOTE_CONFLICT" : "REMOTE_REJECTED",
    );
  }
  try {
    const parsed = responseSchema.parse(await response.json());
    if (parsed.learnerRef !== localLearnerRef) throw new Error("mismatch");
    return Object.freeze({ ...parsed, learnerRef: parsed.learnerRef as LearnerRef });
  } catch {
    throw new RemoteStoreError("INVALID_RESPONSE");
  }
}

export async function rollbackPristineSupabaseLearnerIdentityRebind(
  config: SupabaseShadowConfig,
  accessToken: string,
  rebindId: string,
  signal: AbortSignal,
  fetchImplementation: typeof fetch = fetch,
): Promise<Readonly<{ status: "ROLLED_BACK"; rebindId: string }>> {
  if (!config.publishableKey.startsWith("sb_publishable_")
    || config.publishableKey.startsWith("sb_secret_")
    || accessToken.length < 20 || accessToken.length > 8192 || /\s/.test(accessToken)
    || !z.string().uuid().safeParse(rebindId).success) {
    throw new RemoteStoreError("INVALID_SESSION");
  }
  let response: Response;
  try {
    response = await fetchImplementation(
      config.projectUrl.replace(/\/$/, "") + "/rest/v1/rpc/elos_rollback_pristine_learner_identity_rebind",
      {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_rebind_id: rebindId }),
        signal,
      },
    );
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
    const parsed = rollbackResponseSchema.parse(await response.json());
    if (parsed.rebindId !== rebindId) throw new Error("mismatch");
    return Object.freeze(parsed);
  } catch {
    throw new RemoteStoreError("INVALID_RESPONSE");
  }
}
