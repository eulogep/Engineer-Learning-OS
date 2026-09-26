import { CanonicalStorageError } from "../adapters/indexeddb";
import { RemoteStoreError } from "../sync/supabase-shadow";
import { LearnerIdentityBindingError } from "./identity-binding";

export type RemoteSyncStage =
  | "LOCAL_OPEN"
  | "IDENTITY_RESOLVE"
  | "IDENTITY_COMPARE"
  | "IDENTITY_REBIND"
  | "DEVICE_REGISTER"
  | "SCHEMA_HEALTH"
  | "LOCAL_OUTBOX"
  | "REMOTE_UPLOAD"
  | "REMOTE_PULL"
  | "LOCAL_APPLY";

export type RemoteSyncFailureKind = "AUTH" | "NETWORK" | "REMOTE" | "LOCAL" | "IDENTITY";

export type RemoteSyncDiagnostic = Readonly<{
  failure: RemoteSyncFailureKind;
  code: string;
}>;

export function diagnoseRemoteSyncFailure(
  error: unknown,
  stage: RemoteSyncStage,
  online: boolean,
): RemoteSyncDiagnostic {
  if (error instanceof Error && error.message === "REMOTE_IDENTITY_CONFLICT") {
    return { failure: "IDENTITY", code: "IDENTITY_HISTORY_CONFLICT" };
  }
  if (!online) return { failure: "NETWORK", code: `${stage}_OFFLINE` };
  if (error instanceof LearnerIdentityBindingError) {
    return { failure: "IDENTITY", code: `${stage}_${error.reason}` };
  }
  if (error instanceof RemoteStoreError) {
    const failure = error.reason === "INVALID_SESSION" || error.reason === "UNAUTHORIZED"
      ? "AUTH" : "REMOTE";
    return { failure, code: `${stage}_${error.reason}` };
  }
  if (error instanceof CanonicalStorageError) {
    return { failure: "LOCAL", code: `${stage}_${error.reason}` };
  }
  if (error instanceof Error && error.message === "REMOTE_SCHEMA_NOT_READY") {
    return { failure: "REMOTE", code: "SCHEMA_HEALTH_VERSION_MISMATCH" };
  }
  return { failure: "LOCAL", code: `${stage}_UNEXPECTED` };
}
