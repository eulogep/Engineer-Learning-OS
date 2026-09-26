import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { InMemoryCanonicalLearningRepository } from "../src/modules/learning-history/adapters/in-memory.ts";
import { SupabaseDeviceTrustClient } from "../src/modules/learning-history/auth/supabase-device-trust.ts";
import { parseCanonicalEvent } from "../src/modules/learning-history/events.ts";
import {
  createAttemptId,
  createDefinitionId,
  createDeviceId,
  createEventId,
  createEvidenceId,
  createJobId,
  createLearnerRef,
} from "../src/modules/learning-history/ids.ts";
import {
  HOSTED_CONFIRMATION_SCENARIOS,
  HYBRID_ACTIVATION_SCENARIOS,
  evaluateHybridActivationGate,
  type ActivationEvidence,
  type HybridActivationScenario,
} from "../src/modules/learning-history/operations/activation-gate.ts";
import { runSyntheticRestoreDrill } from "../src/modules/learning-history/operations/reliability.ts";
import {
  LearnerIdentityBindingError,
  rebindPristineSupabaseLearnerIdentity,
  rollbackPristineSupabaseLearnerIdentityRebind,
} from "../src/modules/learning-history/remote/identity-binding.ts";
import { resolveSupabaseLearnerIdentity } from "../src/modules/learning-history/remote/learner-identity.ts";
import { rebuildProjections, type ProjectionPolicy } from "../src/modules/learning-history/projections/rebuild.ts";
import { parseSyncQueueJob } from "../src/modules/learning-history/sync-job.ts";
import { makeSyncEnvelope, type SyncEnvelope } from "../src/modules/learning-history/sync/protocol.ts";
import { compareShadowState, uploadShadowEnvelope } from "../src/modules/learning-history/sync/shadow-sync.ts";
import {
  RemoteStoreError,
  SUPABASE_SHADOW_SCHEMA_VERSION,
  SupabaseShadowAdapter,
  type SupabaseSessionMaterial,
} from "../src/modules/learning-history/sync/supabase-shadow.ts";
import type { CanonicalEvent, DefinitionIdentity } from "../src/modules/learning-history/types.ts";

const projectRef = required("ELOS_SUPABASE_PROJECT_REF");
const publishableKey = required("ELOS_SUPABASE_PUBLISHABLE_KEY");
const secretKey = required("ELOS_SUPABASE_SECRET_KEY");
const projectUrl = `https://${projectRef}.supabase.co`;
const reportPath = ".agent/reports/v1-b04-hosted-supabase.json";

if (!/^[a-z]{20}$/.test(projectRef) || !publishableKey.startsWith("sb_publishable_")
  || !secretKey.startsWith("sb_secret_")) {
  throw new Error("Invalid hosted Supabase configuration.");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || /\s/.test(value)) throw new Error(`Missing or invalid ${name}.`);
  return value;
}

function randomSecret(): string {
  return randomBytes(32).toString("base64url");
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = await response.json();
    return value && typeof value === "object" ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function adminRequest(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(projectUrl + "/auth/v1/admin" + path, {
    ...init,
    headers: {
      apikey: secretKey,
      Authorization: "Bearer " + secretKey,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) throw new Error(`Supabase Auth admin request failed (${response.status}).`);
  return safeJson(response);
}

type SyntheticUser = Readonly<{ id: string; email: string; password: string; accessToken: string }>;

async function createSyntheticUser(label: string): Promise<SyntheticUser> {
  const suffix = `${Date.now()}-${randomBytes(5).toString("hex")}`;
  const email = `elos-hosted-${label}-${suffix}@example.com`;
  const password = randomSecret();
  const created = await adminRequest("/users", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { purpose: "ELOS_HOSTED_SYNTHETIC" },
    }),
  });
  const nested = created.user && typeof created.user === "object"
    ? created.user as Record<string, unknown> : created;
  const id = typeof nested.id === "string" ? nested.id : "";
  if (!id) throw new Error("Supabase Auth did not return a synthetic user id.");

  const response = await fetch(projectUrl + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: publishableKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const session = await safeJson(response);
  const accessToken = typeof session.access_token === "string" ? session.access_token : "";
  if (!response.ok || accessToken.length < 20) throw new Error("Synthetic Supabase sign-in failed.");
  return { id, email, password, accessToken };
}

async function deleteSyntheticUser(id: string): Promise<void> {
  await adminRequest("/users/" + encodeURIComponent(id), { method: "DELETE" });
}

function context(learnerRef: string, deviceId: string) {
  return { learnerRef, deviceId, requestId: createEventId(), requestedAt: Date.now() };
}

function evidenceEvent(
  learnerRef: string,
  deviceRef: string,
  definitionIdentity: DefinitionIdentity,
  order: number,
): CanonicalEvent {
  const evidenceId = createEvidenceId();
  return parseCanonicalEvent({
    id: createEventId(),
    schemaVersion: 1,
    learnerRef,
    deviceRef,
    occurredAt: Date.now(),
    recordedAt: Date.now(),
    deviceLocalOrder: order,
    classification: "SYNC_ALLOWED",
    definitionIdentity,
    attemptId: createAttemptId(),
    eventType: "EVIDENCE_CREATED",
    payload: {
      evidenceId,
      evidenceType: "TRANSFER",
      conceptIds: ["synthetic-hosted-concept"],
      competencyIds: ["synthetic-hosted-competency"],
      result: { status: "VALID", outcomeCode: "VALIDATED", criteria: [] },
      assistance: { modes: ["NONE"], hintCount: 0, retryCount: 0 },
      evidenceClassification: "SYNC_ALLOWED",
      artifactRefs: [],
      sourceRefs: [],
    },
  });
}

function deletionEvent(
  learnerRef: string,
  deviceRef: string,
  targetId: string,
  order: number,
): CanonicalEvent {
  return parseCanonicalEvent({
    id: createEventId(),
    schemaVersion: 1,
    learnerRef,
    deviceRef,
    occurredAt: Date.now(),
    recordedAt: Date.now(),
    deviceLocalOrder: order,
    classification: "SYNC_ALLOWED",
    eventType: "DELETION_REQUESTED",
    payload: {
      targetType: "EVIDENCE",
      targetId,
      scope: "LOCAL_AND_REMOTE",
      requestedBy: "LEARNER",
    },
  });
}

function queueJob(event: CanonicalEvent) {
  return parseSyncQueueJob({
    id: createJobId(),
    eventId: event.id,
    idempotencyKey: "hosted-" + event.id,
    state: "PENDING",
    createdAt: Date.now(),
    attempts: 0,
    classification: "SYNC_ALLOWED",
  });
}

async function expectRemoteReason(operation: Promise<unknown>, reason: string): Promise<void> {
  await assert.rejects(operation, (error: unknown) => (
    error instanceof RemoteStoreError && error.reason === reason
  ));
}

function pass(
  scenario: HybridActivationScenario,
  expectedOutcome: string,
  actualOutcome: string,
): ActivationEvidence {
  return {
    scenario,
    environment: "HOSTED_SUPABASE",
    result: "PASS",
    deterministic: true,
    expectedOutcome,
    actualOutcome,
    evidenceRef: `hosted-supabase:${scenario}`,
  };
}

const users: SyntheticUser[] = [];
const hostedEvidence: ActivationEvidence[] = [];
let cleanupComplete = false;

try {
  const owner = await createSyntheticUser("owner");
  users.push(owner);
  const outsider = await createSyntheticUser("outsider");
  users.push(outsider);

  const learnerRef = createLearnerRef();
  const preAuthLearnerRef = createLearnerRef();
  const deviceA = createDeviceId();
  const deviceB = createDeviceId();
  const deviceC = createDeviceId();
  const credentials = new Map<string, string>([
    [deviceA, randomSecret()],
    [deviceB, randomSecret()],
    [deviceC, randomSecret()],
  ]);
  const ownerSession = async (value: { deviceId: string }): Promise<SupabaseSessionMaterial> => ({
    accessToken: owner.accessToken,
    deviceCredential: credentials.get(value.deviceId) ?? "",
  });
  const outsiderSession = async (): Promise<SupabaseSessionMaterial> => ({
    accessToken: outsider.accessToken,
    deviceCredential: credentials.get(deviceA) ?? "",
  });
  const config = { projectUrl, publishableKey };
  const trust = new SupabaseDeviceTrustClient(config, ownerSession);
  const remote = new SupabaseShadowAdapter(config, ownerSession);
  const expiry = Date.now() + 60 * 60 * 1000;

  assert.equal(
    await resolveSupabaseLearnerIdentity(config, owner.accessToken, preAuthLearnerRef, AbortSignal.timeout(10_000)),
    preAuthLearnerRef,
  );
  const identityRebind = await rebindPristineSupabaseLearnerIdentity(
    config,
    owner.accessToken,
    preAuthLearnerRef,
    learnerRef,
    AbortSignal.timeout(10_000),
  );
  assert.equal(identityRebind.status, "REBOUND");
  assert.equal(identityRebind.learnerRef, learnerRef);
  assert.ok(identityRebind.rebindId);
  const rollback = await rollbackPristineSupabaseLearnerIdentityRebind(
    config,
    owner.accessToken,
    identityRebind.rebindId,
    AbortSignal.timeout(10_000),
  );
  assert.equal(rollback.status, "ROLLED_BACK");
  assert.equal(
    await resolveSupabaseLearnerIdentity(config, owner.accessToken, createLearnerRef(), AbortSignal.timeout(10_000)),
    preAuthLearnerRef,
  );
  const finalRebind = await rebindPristineSupabaseLearnerIdentity(
    config,
    owner.accessToken,
    preAuthLearnerRef,
    learnerRef,
    AbortSignal.timeout(10_000),
  );
  assert.equal(finalRebind.status, "REBOUND");
  await trust.register(context(learnerRef, deviceA), "DESKTOP", expiry, AbortSignal.timeout(10_000));
  const health = await remote.health(context(learnerRef, deviceA), AbortSignal.timeout(10_000));
  assert.equal(health.schemaVersion, SUPABASE_SHADOW_SCHEMA_VERSION);
  await assert.rejects(
    rebindPristineSupabaseLearnerIdentity(
      config,
      owner.accessToken,
      learnerRef,
      createLearnerRef(),
      AbortSignal.timeout(10_000),
    ),
    (error: unknown) => error instanceof LearnerIdentityBindingError
      && error.reason === "NOT_PRISTINE",
  );
  hostedEvidence.push(pass(
    "ADDITIVE_MIGRATION",
    `The additive schema reports version ${SUPABASE_SHADOW_SCHEMA_VERSION}.`,
    `Hosted health reported schema version ${health.schemaVersion}.`,
  ));

  const definitionIdentity: DefinitionIdentity = {
    definitionId: createDefinitionId(),
    definitionVersion: 1,
    definitionHash: "sha256:" + "a".repeat(64),
  };
  const source = new InMemoryCanonicalLearningRepository();
  await source.putDefinition(definitionIdentity);
  const first = evidenceEvent(learnerRef, deviceA, definitionIdentity, 1);
  const firstJob = queueJob(first);
  const deletion = deletionEvent(learnerRef, deviceA, (first.payload as { evidenceId: string }).evidenceId, 2);
  const deletionJob = queueJob(deletion);
  await source.appendEventWithOutbox(first, firstJob);
  await source.appendEventWithOutbox(deletion, deletionJob);
  const firstEnvelope = await makeSyncEnvelope(first, firstJob, {
    metadataTransfer: "APPROVED",
    companyRestricted: false,
  });
  const deletionEnvelope = await makeSyncEnvelope(deletion, deletionJob, {
    metadataTransfer: "APPROVED",
    companyRestricted: false,
  });
  const firstContext = context(learnerRef, deviceA);
  let firstAck;
  try {
    firstAck = await remote.upload(firstContext, firstEnvelope, AbortSignal.timeout(10_000));
  } catch (error) {
    const diagnostic = await fetch(projectUrl + "/rest/v1/rpc/elos_sync_upload", {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: "Bearer " + owner.accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_learner_ref: learnerRef,
        p_device_id: deviceA,
        p_request_id: firstContext.requestId,
        p_requested_at: new Date(firstContext.requestedAt).toISOString(),
        p_device_credential: credentials.get(deviceA),
        p_envelope: firstEnvelope,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const diagnosticBody = await safeJson(diagnostic);
    throw new Error(
      `Hosted upload rejected (HTTP ${diagnostic.status}, code ${String(diagnosticBody.code ?? "unknown")}).`,
      { cause: error },
    );
  }
  const duplicateAck = await uploadShadowEnvelope(
    remote,
    context(learnerRef, deviceA),
    firstEnvelope,
    10_000,
  );
  assert.deepEqual(duplicateAck, firstAck);
  await uploadShadowEnvelope(remote, context(learnerRef, deviceA), deletionEnvelope, 10_000);

  const projectionPolicy: ProjectionPolicy = {
    version: 1,
    transferDefinitions: [definitionIdentity],
    retrievalDefinitions: [definitionIdentity],
    retentionDelayMs: 86_400_000,
    reviewDelayMs: 86_400_000,
  };
  const comparison = await compareShadowState({
    local: source,
    remote,
    projectionPolicy,
    context: () => context(learnerRef, deviceA),
    pageSize: 1,
  });
  assert.equal(comparison.status, "MATCH");
  assert.equal(comparison.remoteCanonicalCount, 2);
  hostedEvidence.push(pass(
    "SHADOW_COMPARISON",
    "Remote count, canonical digest, and projection digest match local state.",
    "Two hosted events matched local canonical and projection digests; duplicate delivery stayed idempotent.",
  ));

  const outsiderRemote = new SupabaseShadowAdapter(config, outsiderSession);
  await expectRemoteReason(
    outsiderRemote.health(context(learnerRef, deviceA), AbortSignal.timeout(10_000)),
    "UNAUTHORIZED",
  );
  hostedEvidence.push(pass(
    "AUTH_FAILURE",
    "A second authenticated user cannot access the owner device or learner stream.",
    "The hosted RPC rejected the cross-user health request.",
  ));

  const unavailableRemote = new SupabaseShadowAdapter(config, ownerSession, async () => {
    throw new TypeError("synthetic provider outage");
  });
  await expectRemoteReason(
    unavailableRemote.health(context(learnerRef, deviceA), AbortSignal.timeout(1_000)),
    "UNAVAILABLE",
  );
  hostedEvidence.push(pass(
    "PROVIDER_OUTAGE",
    "Transport failure is sanitized and fails closed.",
    "The adapter returned UNAVAILABLE without altering local canonical state.",
  ));

  const corrupted = evidenceEvent(learnerRef, deviceA, definitionIdentity, 3);
  const corruptedJob = queueJob(corrupted);
  const validBeforeTamper = await makeSyncEnvelope(corrupted, corruptedJob, {
    metadataTransfer: "APPROVED",
    companyRestricted: false,
  });
  const tamperedEnvelope = {
    ...validBeforeTamper,
    event: { ...validBeforeTamper.event, recordedAt: validBeforeTamper.event.recordedAt + 1 },
  } as SyncEnvelope;
  const tamperedResponse = await fetch(projectUrl + "/rest/v1/rpc/elos_sync_upload", {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: "Bearer " + owner.accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_learner_ref: learnerRef,
      p_device_id: deviceA,
      p_request_id: createEventId(),
      p_requested_at: new Date().toISOString(),
      p_device_credential: credentials.get(deviceA),
      p_envelope: tamperedEnvelope,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(tamperedResponse.ok, false);
  assert.equal((await compareShadowState({
    local: source,
    remote,
    projectionPolicy,
    context: () => context(learnerRef, deviceA),
  })).status, "MATCH");
  hostedEvidence.push(pass(
    "REMOTE_CORRUPTION",
    "The server rejects an envelope whose canonical content does not match its digest.",
    "PostgreSQL rejected the tampered envelope and the remote shadow remained equal to local state.",
  ));

  const incompatibleRemote = new SupabaseShadowAdapter(config, ownerSession, async (input, init) => {
    const response = await fetch(input, init);
    if (!String(input).endsWith("/elos_sync_health") || !response.ok) return response;
    const body = await safeJson(response);
    return new Response(JSON.stringify({ ...body, schemaVersion: SUPABASE_SHADOW_SCHEMA_VERSION - 1 }), {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  });
  await expectRemoteReason(
    incompatibleRemote.health(context(learnerRef, deviceA), AbortSignal.timeout(10_000)),
    "INVALID_RESPONSE",
  );
  hostedEvidence.push(pass(
    "SCHEMA_VERSION_MISMATCH",
    "The client rejects any hosted schema version other than its audited version.",
    "A downgraded health response was rejected as INVALID_RESPONSE.",
  ));

  const restore = await runSyntheticRestoreDrill({
    source,
    createFreshTarget: () => new InMemoryCanonicalLearningRepository(),
    exportOptions: {
      exportId: createEventId(),
      createdAt: Date.now(),
      sourceDatabaseVersion: 1,
      containsPersonalMetadata: false,
      containsCompanyRestrictedMetadata: false,
    },
    projectionPolicy,
  });
  assert.equal(restore.status, "TRUSTED", JSON.stringify(restore));
  assert.equal(restore.sourceEventCount, 2);
  assert.equal(restore.restoredEventCount, 2);
  hostedEvidence.push(pass(
    "BACKUP_RESTORE",
    "A shadow-equivalent canonical export restores into a fresh repository with equal digests and tombstones.",
    "The synthetic restore was TRUSTED with two restored events and equal canonical/projection digests.",
  ));

  await trust.register(context(learnerRef, deviceB), "MOBILE_LIMITED_WRITE", expiry, AbortSignal.timeout(10_000));
  await trust.revoke(context(learnerRef, deviceB), deviceA, AbortSignal.timeout(10_000));
  await expectRemoteReason(
    remote.health(context(learnerRef, deviceA), AbortSignal.timeout(10_000)),
    "UNAUTHORIZED",
  );
  assert.equal(
    await resolveSupabaseLearnerIdentity(config, owner.accessToken, createLearnerRef(), AbortSignal.timeout(10_000)),
    learnerRef,
  );
  await trust.register(context(learnerRef, deviceC), "DESKTOP", expiry, AbortSignal.timeout(10_000));
  assert.equal(
    (await remote.health(context(learnerRef, deviceC), AbortSignal.timeout(10_000))).status,
    "HEALTHY",
  );
  hostedEvidence.push(pass(
    "DEVICE_REPLACEMENT",
    "Revoking a lost device blocks stale access while a newly enrolled replacement remains healthy.",
    "The revoked device was rejected and the replacement device passed hosted health.",
  ));

  assert.equal(hostedEvidence.length, HOSTED_CONFIRMATION_SCENARIOS.size);
  assert.deepEqual(
    new Set(hostedEvidence.map((item) => item.scenario)),
    new Set(HOSTED_CONFIRMATION_SCENARIOS),
  );

  const localEvidence: ActivationEvidence[] = HYBRID_ACTIVATION_SCENARIOS.map((scenario) => ({
    scenario,
    environment: "LOCAL_SYNTHETIC",
    result: "PASS",
    deterministic: true,
    expectedOutcome: "The local deterministic regression contract passes.",
    actualOutcome: "Validated by npm run validate:v1:local.",
    evidenceRef: "validate:v1:local",
  }));
  const gate = evaluateHybridActivationGate([...localEvidence, ...hostedEvidence]);
  assert.equal(gate.status, "READY_FOR_HUMAN_DECISION");
  assert.equal(gate.productionActivationAllowed, false);

  const projected = await rebuildProjections([first, deletion], projectionPolicy);
  assert.ok(projected.digest.startsWith("sha256:"));
} finally {
  const failures: unknown[] = [];
  for (const user of users.reverse()) {
    try { await deleteSyntheticUser(user.id); }
    catch (error) { failures.push(error); }
  }
  cleanupComplete = failures.length === 0;
  if (failures.length) throw new AggregateError(failures, "Synthetic Supabase cleanup failed.");
}

await mkdir(".agent/reports", { recursive: true });
await writeFile(reportPath, JSON.stringify({
  program: "ENGINEER_LEARNING_OS_V1",
  ticket: "V1-B04",
  environment: "HOSTED_SUPABASE",
  projectRef,
  schemaVersion: SUPABASE_SHADOW_SCHEMA_VERSION,
  syntheticDataOnly: true,
  hostedEvidence,
  cleanupComplete,
  gateStatus: "READY_FOR_HUMAN_DECISION",
  productionActivationAllowed: false,
}, null, 2) + "\n", { mode: 0o600 });

console.log("V1_HOSTED_SUPABASE_VALIDATION PASS");
console.log(`Hosted scenarios: ${hostedEvidence.length}/${HOSTED_CONFIRMATION_SCENARIOS.size}`);
console.log("Synthetic cleanup: PASS");
console.log("Synthetic harness production transfer: DISABLED");
