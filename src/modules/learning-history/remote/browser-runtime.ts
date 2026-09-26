"use client";

import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { IndexedDbCanonicalLearningRepository } from "../adapters/indexeddb";
import { SupabaseDeviceTrustClient } from "../auth/supabase-device-trust";
import { UUIDV7_CANONICAL_PATTERN } from "../schemas";
import type { RemoteCheckpoint } from "../sync/protocol";
import { SupabaseShadowAdapter } from "../sync/supabase-shadow";
import {
  adoptRemoteLearnerRef,
  browserCanonicalIdentity,
  browserDeviceCredential,
} from "./browser-identity";
import { diagnoseRemoteSyncFailure, type RemoteSyncStage } from "./diagnostics";
import { rebindPristineSupabaseLearnerIdentity } from "./identity-binding";
import { resolveSupabaseLearnerIdentity } from "./learner-identity";
import { browserRemoteSyncConfiguration } from "./runtime-config";
import { synchronizeRemoteMetadata } from "./synchronize";

const REMOTE_STATE_KEY = "engineer-learning-os:remote-sync-state:v1";
const IDENTITY_REBIND_RECEIPT_KEY = "engineer-learning-os:identity-rebind-receipt:v1";
const MAX_ACKNOWLEDGED_JOBS = 20_000;

export type RemoteConfigurationStatus = "DISABLED" | "INVALID" | "READY";
export type RemoteAuthStatus = "SIGNED_OUT" | "CHECK_EMAIL" | "SIGNED_IN";
export type RemoteRunStatus =
  | "IDLE" | "SYNCING" | "SYNCED" | "OFFLINE" | "FAILED" | "IDENTITY_CONFLICT";

export type RemoteSyncSnapshot = Readonly<{
  configuration: RemoteConfigurationStatus;
  auth: RemoteAuthStatus;
  run: RemoteRunStatus;
  accountEmail: string | null;
  uploaded: number;
  downloaded: number;
  lastSyncedAt: number | null;
  failure: "AUTH" | "NETWORK" | "REMOTE" | "LOCAL" | "IDENTITY" | null;
  diagnosticCode: string | null;
}>;

const config = browserRemoteSyncConfiguration();
const INITIAL: RemoteSyncSnapshot = Object.freeze({
  configuration: config.status,
  auth: "SIGNED_OUT",
  run: typeof navigator !== "undefined" && !navigator.onLine ? "OFFLINE" : "IDLE",
  accountEmail: null,
  uploaded: 0,
  downloaded: 0,
  lastSyncedAt: null,
  failure: null,
  diagnosticCode: null,
});

type PersistedRemoteState = Readonly<{
  checkpoint: RemoteCheckpoint | null;
  acknowledgedJobIds: readonly string[];
}>;

let snapshot = INITIAL;
const listeners = new Set<() => void>();
let client: SupabaseClient | null = null;
let session: Session | null = null;
let initialized = false;
let running: Promise<void> | null = null;
let interval: ReturnType<typeof setInterval> | null = null;
let unsubscribeAuth: (() => void) | null = null;

function replace(values: Partial<RemoteSyncSnapshot>): void {
  snapshot = Object.freeze({ ...snapshot, ...values });
  for (const listener of listeners) listener();
}

function validCheckpoint(value: unknown): value is RemoteCheckpoint {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<RemoteCheckpoint>;
  return UUIDV7_CANONICAL_PATTERN.test(item.streamId ?? "")
    && UUIDV7_CANONICAL_PATTERN.test(item.token ?? "")
    && Number.isSafeInteger(item.sequence) && (item.sequence ?? -1) >= 0;
}

function readState(learnerRef: string): PersistedRemoteState {
  try {
    const value = JSON.parse(localStorage.getItem(REMOTE_STATE_KEY) ?? "null") as {
      checkpoint?: unknown;
      acknowledgedJobIds?: unknown;
    } | null;
    const acknowledged = Array.isArray(value?.acknowledgedJobIds)
      ? value.acknowledgedJobIds.filter((id): id is string => (
        typeof id === "string" && UUIDV7_CANONICAL_PATTERN.test(id)
      )).slice(-MAX_ACKNOWLEDGED_JOBS)
      : [];
    const checkpoint = validCheckpoint(value?.checkpoint)
      && value.checkpoint.streamId === learnerRef ? value.checkpoint : null;
    return Object.freeze({
      checkpoint,
      acknowledgedJobIds: Object.freeze(checkpoint ? acknowledged : []),
    });
  } catch {
    return Object.freeze({ checkpoint: null, acknowledgedJobIds: Object.freeze([]) });
  }
}

function writeState(value: PersistedRemoteState): void {
  localStorage.setItem(REMOTE_STATE_KEY, JSON.stringify({
    checkpoint: value.checkpoint,
    acknowledgedJobIds: value.acknowledgedJobIds.slice(-MAX_ACKNOWLEDGED_JOBS),
  }));
}

async function accessToken(): Promise<string> {
  if (!client) throw new Error("AUTH_CLIENT_UNAVAILABLE");
  const result = await client.auth.getSession();
  const token = result.data.session?.access_token;
  if (!token) throw new Error("INVALID_SESSION");
  session = result.data.session;
  return token;
}

async function performSync(): Promise<void> {
  if (config.status !== "READY" || !client || !session) return;
  if (!navigator.onLine) {
    replace({ run: "OFFLINE", failure: "NETWORK" });
    return;
  }
  if (running) return running;
  running = (async () => {
    replace({ run: "SYNCING", failure: null, diagnosticCode: null });
    const local = new IndexedDbCanonicalLearningRepository();
    let stage: RemoteSyncStage = "LOCAL_OPEN";
    try {
      await local.initialize();
      let identity = browserCanonicalIdentity();
      const token = await accessToken();
      const controller = new AbortController();
      stage = "IDENTITY_RESOLVE";
      const resolved = await resolveSupabaseLearnerIdentity(
        config, token, identity.learnerRef, controller.signal,
      );
      if (resolved !== identity.learnerRef) {
        stage = "IDENTITY_COMPARE";
        if (await local.countEvents() > 0) {
          for await (const event of local.iterateEventsForExport(250)) {
            if (event.learnerRef !== identity.learnerRef) {
              throw new Error("REMOTE_IDENTITY_CONFLICT");
            }
          }
          stage = "IDENTITY_REBIND";
          const rebound = await rebindPristineSupabaseLearnerIdentity(
            config, token, resolved, identity.learnerRef, controller.signal,
          );
          if (rebound.rebindId) {
            localStorage.setItem(IDENTITY_REBIND_RECEIPT_KEY, JSON.stringify({
              rebindId: rebound.rebindId,
              recordedAt: Date.now(),
            }));
          }
        } else {
          identity = adoptRemoteLearnerRef(identity, resolved);
        }
      }
      const credential = browserDeviceCredential();
      const sessionResolver = async () => ({
        accessToken: await accessToken(),
        deviceCredential: credential,
      });
      const remote = new SupabaseShadowAdapter(config, sessionResolver);
      const registrar = new SupabaseDeviceTrustClient(config, sessionResolver);
      const persisted = readState(identity.learnerRef);
      const result = await synchronizeRemoteMetadata({
        local,
        remote,
        registrar,
        identity,
        checkpoint: persisted.checkpoint,
        acknowledgedJobIds: new Set(persisted.acknowledgedJobIds),
        onStage: (value) => { stage = value; },
      });
      writeState({
        checkpoint: result.checkpoint,
        acknowledgedJobIds: result.acknowledgedJobIds,
      });
      replace({
        run: "SYNCED",
        uploaded: result.uploaded,
        downloaded: result.downloaded,
        lastSyncedAt: Date.now(),
        failure: null,
        diagnosticCode: null,
      });
    } catch (error) {
      const diagnostic = diagnoseRemoteSyncFailure(error, stage, navigator.onLine);
      console.warn("[ELOS_REMOTE_SYNC]", diagnostic.code);
      replace({
        run: diagnostic.failure === "IDENTITY" ? "IDENTITY_CONFLICT"
          : diagnostic.failure === "NETWORK" ? "OFFLINE" : "FAILED",
        failure: diagnostic.failure,
        diagnosticCode: diagnostic.code,
      });
    } finally {
      local.close();
      running = null;
    }
  })();
  return running;
}

async function applySession(next: Session | null): Promise<void> {
  session = next;
  replace({
    auth: next ? "SIGNED_IN" : "SIGNED_OUT",
    accountEmail: next?.user.email ?? null,
    run: next ? snapshot.run : "IDLE",
    failure: null,
    diagnosticCode: null,
  });
  if (next) await performSync();
}

function initialize(): void {
  if (initialized || config.status !== "READY") return;
  initialized = true;
  client = createClient(config.projectUrl, config.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  void client.auth.getSession().then(({ data }) => applySession(data.session));
  const subscription = client.auth.onAuthStateChange((_event, next) => {
    void applySession(next);
  }).data.subscription;
  unsubscribeAuth = () => subscription.unsubscribe();

  const onOnline = () => { if (session) void performSync(); };
  const onOffline = () => replace({ run: "OFFLINE", failure: "NETWORK" });
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  interval = setInterval(() => { if (session && document.visibilityState === "visible") void performSync(); }, 60_000);
  unsubscribeAuth = ((authCleanup) => () => {
    authCleanup();
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
    if (interval) clearInterval(interval);
    interval = null;
    initialized = false;
  })(unsubscribeAuth);
}

function dispose(): void {
  unsubscribeAuth?.();
  unsubscribeAuth = null;
}

async function signIn(email: string, password: string): Promise<"SIGNED_IN" | "FAILED"> {
  initialize();
  if (!client || config.status !== "READY") return "FAILED";
  const result = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (result.error || !result.data.session) {
    replace({ failure: "AUTH", auth: "SIGNED_OUT", run: "FAILED" });
    return "FAILED";
  }
  await applySession(result.data.session);
  return "SIGNED_IN";
}

async function signUp(email: string, password: string): Promise<"SIGNED_IN" | "CHECK_EMAIL" | "FAILED"> {
  initialize();
  if (!client || config.status !== "READY") return "FAILED";
  const result = await client.auth.signUp({ email: email.trim(), password });
  if (result.error) {
    replace({ failure: "AUTH", auth: "SIGNED_OUT", run: "FAILED" });
    return "FAILED";
  }
  if (!result.data.session) {
    replace({ auth: "CHECK_EMAIL", accountEmail: email.trim(), run: "IDLE", failure: null });
    return "CHECK_EMAIL";
  }
  await applySession(result.data.session);
  return "SIGNED_IN";
}

async function signOut(): Promise<void> {
  await client?.auth.signOut({ scope: "local" });
  await applySession(null);
}

export const remoteSyncController = Object.freeze({
  getSnapshot: (): RemoteSyncSnapshot => snapshot,
  getServerSnapshot: (): RemoteSyncSnapshot => INITIAL,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  initialize,
  dispose,
  synchronize: performSync,
  signIn,
  signUp,
  signOut,
});
