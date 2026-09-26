import { z } from "zod";
import { UUIDV7_CANONICAL_PATTERN } from "../schemas";
import type { LearnerRef } from "../types";
import { RemoteStoreError, type SupabaseShadowConfig } from "../sync/supabase-shadow";

const responseSchema = z.object({
  learnerRef: z.string().regex(UUIDV7_CANONICAL_PATTERN),
}).strict();

export async function resolveSupabaseLearnerIdentity(
  config: SupabaseShadowConfig,
  accessToken: string,
  proposedLearnerRef: LearnerRef,
  signal: AbortSignal,
  fetchImplementation: typeof fetch = fetch,
): Promise<LearnerRef> {
  if (!config.publishableKey.startsWith("sb_publishable_")
    || config.publishableKey.startsWith("sb_secret_")
    || accessToken.length < 20 || accessToken.length > 8192 || /\s/.test(accessToken)
    || !UUIDV7_CANONICAL_PATTERN.test(proposedLearnerRef)) {
    throw new RemoteStoreError("INVALID_SESSION");
  }
  let response: Response;
  try {
    response = await fetchImplementation(
      config.projectUrl.replace(/\/$/, "") + "/rest/v1/rpc/elos_resolve_learner_identity",
      {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          Authorization: "Bearer " + accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_proposed_learner_ref: proposedLearnerRef }),
        signal,
      },
    );
  } catch {
    throw new RemoteStoreError(signal.aborted ? "ABORTED" : "UNAVAILABLE");
  }
  if (!response.ok) {
    throw new RemoteStoreError(
      response.status === 401 || response.status === 403 ? "UNAUTHORIZED" : "REMOTE_REJECTED",
    );
  }
  try {
    return responseSchema.parse(await response.json()).learnerRef as LearnerRef;
  } catch {
    throw new RemoteStoreError("INVALID_RESPONSE");
  }
}
