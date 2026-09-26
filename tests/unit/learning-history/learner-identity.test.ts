import assert from "node:assert/strict";
import test from "node:test";

const { resolveSupabaseLearnerIdentity } = await import(
  "../../../src/modules/learning-history/remote/learner-identity.ts"
);
const { RemoteStoreError } = await import(
  "../../../src/modules/learning-history/sync/supabase-shadow.ts"
);
const { uuid } = await import("./sprint-fixtures.ts");
import type { LearnerRef } from "../../../src/modules/learning-history/types.ts";

const config = {
  projectUrl: "https://synthetic.supabase.co",
  publishableKey: "sb_publishable_synthetic",
};

test("learner identity resolution uses authenticated RPC and accepts only UUIDv7", async () => {
  let body: Record<string, unknown> = {};
  const resolved = await resolveSupabaseLearnerIdentity(
    config,
    "synthetic.access.token.with.safe.length",
    uuid(900) as LearnerRef,
    new AbortController().signal,
    async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ learnerRef: uuid(901) }), { status: 200 });
    },
  );
  assert.equal(body.p_proposed_learner_ref, uuid(900));
  assert.equal(resolved, uuid(901));
});

test("learner identity resolution rejects secret configuration and malformed responses", async () => {
  await assert.rejects(
    resolveSupabaseLearnerIdentity(
      { ...config, publishableKey: "sb_secret_forbidden" },
      "synthetic.access.token.with.safe.length",
      uuid(900) as LearnerRef,
      new AbortController().signal,
    ),
    (error: unknown) => error instanceof RemoteStoreError && error.reason === "INVALID_SESSION",
  );
  await assert.rejects(
    resolveSupabaseLearnerIdentity(
      config,
      "synthetic.access.token.with.safe.length",
      uuid(900) as LearnerRef,
      new AbortController().signal,
      async () => new Response(JSON.stringify({ learnerRef: "invalid" }), { status: 200 }),
    ),
    (error: unknown) => error instanceof RemoteStoreError && error.reason === "INVALID_RESPONSE",
  );
});
