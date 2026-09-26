import assert from "node:assert/strict";
import test from "node:test";

const {
  LearnerIdentityBindingError,
  rebindPristineSupabaseLearnerIdentity,
  rollbackPristineSupabaseLearnerIdentityRebind,
} = await import(
  "../../../src/modules/learning-history/remote/identity-binding.ts"
);
const { uuid } = await import("./sprint-fixtures.ts");
import type { LearnerRef } from "../../../src/modules/learning-history/types.ts";

const config = {
  projectUrl: "https://synthetic.supabase.co",
  publishableKey: "sb_publishable_synthetic",
};
const token = "synthetic.access.token.with.safe.length";

test("pristine identity rebind sends both refs and preserves the local learner ref", async () => {
  let body: Record<string, unknown> = {};
  const result = await rebindPristineSupabaseLearnerIdentity(
    config,
    token,
    uuid(900) as LearnerRef,
    uuid(901) as LearnerRef,
    new AbortController().signal,
    async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        status: "REBOUND",
        learnerRef: uuid(901),
        rebindId: "1d8101e8-9c8f-49bb-8139-20a4a3d85728",
      }), { status: 200 });
    },
  );
  assert.equal(body.p_expected_remote_learner_ref, uuid(900));
  assert.equal(body.p_local_learner_ref, uuid(901));
  assert.equal(result.learnerRef, uuid(901));
  assert.equal(result.status, "REBOUND");
});

test("pristine identity rebind can be rolled back by its opaque receipt", async () => {
  const rebindId = "1d8101e8-9c8f-49bb-8139-20a4a3d85728";
  let body: Record<string, unknown> = {};
  const result = await rollbackPristineSupabaseLearnerIdentityRebind(
    config,
    token,
    rebindId,
    new AbortController().signal,
    async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ status: "ROLLED_BACK", rebindId }), { status: 200 });
    },
  );
  assert.deepEqual(body, { p_rebind_id: rebindId });
  assert.deepEqual(result, { status: "ROLLED_BACK", rebindId });
});

test("non-pristine remote identity remains protected with a sanitized reason", async () => {
  await assert.rejects(
    rebindPristineSupabaseLearnerIdentity(
      config,
      token,
      uuid(900) as LearnerRef,
      uuid(901) as LearnerRef,
      new AbortController().signal,
      async () => new Response(JSON.stringify({
        message: "learner_identity_not_pristine",
        details: "must never escape into diagnostics",
      }), { status: 409 }),
    ),
    (error: unknown) => error instanceof LearnerIdentityBindingError
      && error.reason === "NOT_PRISTINE"
      && !error.message.includes("details"),
  );
});

test("identity rebind rejects a response that changes the requested local identity", async () => {
  await assert.rejects(
    rebindPristineSupabaseLearnerIdentity(
      config,
      token,
      uuid(900) as LearnerRef,
      uuid(901) as LearnerRef,
      new AbortController().signal,
      async () => new Response(JSON.stringify({
        status: "REBOUND",
        learnerRef: uuid(902),
        rebindId: "1d8101e8-9c8f-49bb-8139-20a4a3d85728",
      }), { status: 200 }),
    ),
    { reason: "INVALID_RESPONSE" },
  );
});
