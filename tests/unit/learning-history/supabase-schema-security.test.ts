import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function migration(name: string): Promise<string> {
  return readFile(new URL(`../../../supabase/migrations/${name}`, import.meta.url), "utf8");
}

test("Supabase migrations fail closed at privilege, JSON, digest, binding, and index boundaries", async () => {
  const [base, guard, indexes, digest, uploadBinding, helperBinding, identity, identityRebind] = await Promise.all([
    migration("202609130001_elos_shadow_sync.sql"),
    migration("202609130002_elos_envelope_key_guard.sql"),
    migration("20260914012709_elos_foreign_key_indexes.sql"),
    migration("20260914013525_elos_server_digest_guard.sql"),
    migration("20260914014344_elos_sync_upload_variable_binding.sql"),
    migration("20260914014525_elos_json_helper_variable_binding.sql"),
    migration("20260914093000_elos_resolve_learner_identity.sql"),
    migration("20260914101500_elos_pristine_identity_rebind.sql"),
  ]);
  const complete = base + guard + indexes + digest + uploadBinding + helperBinding + identity + identityRebind;
  assert.match(base, /revoke all on function elos\.assert_active_device[\s\S]*from public,anon,authenticated/i);
  assert.match(base, /primary key \(user_id, event_id\)/i);
  assert.match(base, /unique \(user_id, idempotency_key\)/i);
  assert.match(guard, /canonical_envelope_allowed_keys/i);
  assert.match(guard, /not \(item\.key = any\(allowed\)\)/i);
  assert.match(indexes, /canonical_events \(device_id\)/i);
  assert.match(indexes, /canonical_events \(learner_ref\)/i);
  assert.match(indexes, /deletion_tombstones \(learner_ref\)/i);
  assert.match(indexes, /device_registrations \(learner_ref\)/i);
  assert.match(digest, /canonical_envelope_digest_matches/i);
  assert.match(digest, /extensions\.digest/i);
  assert.match(uploadBinding, /v_job_id uuid/i);
  assert.match(uploadBinding, /acknowledgement\.job_id = v_job_id/i);
  assert.match(helperBinding, /jsonb_each\(json_keys_allowed\.value\)/i);
  assert.match(helperBinding, /jsonb_each\(stable_jsonb\.value\)/i);
  assert.match(helperBinding, /json_key_guard_self_test_failed/i);
  assert.match(identity, /auth\.uid\(\)/i);
  assert.match(identity, /on conflict \(user_id\) do nothing/i);
  assert.match(identity, /revoke all on function public\.elos_resolve_learner_identity\(text\) from public, anon/i);
  assert.match(identity, /grant execute on function public\.elos_resolve_learner_identity\(text\) to authenticated/i);
  assert.match(identityRebind, /learner_identity_not_pristine/i);
  assert.match(identityRebind, /for update/i);
  assert.match(identityRebind, /previous_learner_ref/i);
  assert.match(identityRebind, /identity_rebind_rollback_refused/i);
  assert.match(identityRebind, /revoke all on table elos\.learner_identity_rebindings from public, anon, authenticated/i);
  assert.doesNotMatch(complete, /grant execute[\s\S]*to anon/i);
  assert.doesNotMatch(complete, /service_role|sb_secret_/i);
});
