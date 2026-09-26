import assert from "node:assert/strict";
import test from "node:test";

const { CanonicalStorageError } = await import(
  "../../../src/modules/learning-history/adapters/indexeddb.ts"
);
const { diagnoseRemoteSyncFailure } = await import(
  "../../../src/modules/learning-history/remote/diagnostics.ts"
);
const { LearnerIdentityBindingError } = await import(
  "../../../src/modules/learning-history/remote/identity-binding.ts"
);
const { RemoteStoreError } = await import(
  "../../../src/modules/learning-history/sync/supabase-shadow.ts"
);

test("registration provider failures are no longer collapsed into a local-history warning", () => {
  assert.deepEqual(
    diagnoseRemoteSyncFailure(new RemoteStoreError("INVALID_RESPONSE"), "DEVICE_REGISTER", true),
    { failure: "REMOTE", code: "DEVICE_REGISTER_INVALID_RESPONSE" },
  );
});

test("identity and local storage guards emit privacy-safe fixed codes", () => {
  assert.deepEqual(
    diagnoseRemoteSyncFailure(new LearnerIdentityBindingError("NOT_PRISTINE"), "IDENTITY_REBIND", true),
    { failure: "IDENTITY", code: "IDENTITY_REBIND_NOT_PRISTINE" },
  );
  assert.deepEqual(
    diagnoseRemoteSyncFailure(new CanonicalStorageError("VERSION_MISMATCH"), "LOCAL_OPEN", true),
    { failure: "LOCAL", code: "LOCAL_OPEN_VERSION_MISMATCH" },
  );
});

test("offline state wins without exposing the thrown exception", () => {
  assert.deepEqual(
    diagnoseRemoteSyncFailure(new Error("private provider detail"), "REMOTE_PULL", false),
    { failure: "NETWORK", code: "REMOTE_PULL_OFFLINE" },
  );
});
