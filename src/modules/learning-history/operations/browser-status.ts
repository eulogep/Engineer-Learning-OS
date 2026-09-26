import type { CanonicalPersistenceStatus, CanonicalStorageFailure } from "../adapters/indexeddb";

export type CanonicalLocalHealth =
  | "INITIALIZING"
  | "RECONCILING"
  | "HEALTHY"
  | "BEST_EFFORT"
  | "UNAVAILABLE"
  | "FAILED";

export type CanonicalRecoveryStatus = "UNRESTORED" | "RESTORING" | "RESTORED" | "FAILED";

export type CanonicalOperationsSnapshot = Readonly<{
  health: CanonicalLocalHealth;
  persistence: CanonicalPersistenceStatus | null;
  eventCount: number | null;
  outboxCount: number | null;
  recovery: CanonicalRecoveryStatus;
  restoredEventCount: number | null;
  referencesToRelink: number | null;
  failure: CanonicalStorageFailure | "RECOVERY_FAILED" | null;
  updatedAt: number | null;
}>;

const INITIAL: CanonicalOperationsSnapshot = Object.freeze({
  health: "INITIALIZING",
  persistence: null,
  eventCount: null,
  outboxCount: null,
  recovery: "UNRESTORED",
  restoredEventCount: null,
  referencesToRelink: null,
  failure: null,
  updatedAt: null,
});

let current = INITIAL;
const listeners = new Set<() => void>();

function replace(values: Partial<CanonicalOperationsSnapshot>): void {
  current = Object.freeze({ ...current, ...values, updatedAt: Date.now() });
  for (const listener of listeners) listener();
}

export const canonicalOperationsStatus = Object.freeze({
  getSnapshot: (): CanonicalOperationsSnapshot => current,
  getServerSnapshot: (): CanonicalOperationsSnapshot => INITIAL,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  reconciling(): void {
    replace({ health: "RECONCILING", failure: null });
  },
  ready(persistence: CanonicalPersistenceStatus, eventCount: number, outboxCount: number): void {
    replace({
      health: persistence === "PERSISTED" ? "HEALTHY"
        : persistence === "BEST_EFFORT" ? "BEST_EFFORT" : "UNAVAILABLE",
      persistence,
      eventCount,
      outboxCount,
      failure: persistence === "UNAVAILABLE" ? "UNAVAILABLE" : null,
    });
  },
  failed(failure: CanonicalStorageFailure = "STORAGE_FAILURE"): void {
    replace({ health: "FAILED", failure });
  },
  restoring(): void {
    replace({ recovery: "RESTORING", failure: null });
  },
  restored(restoredEventCount: number, referencesToRelink: number): void {
    replace({ recovery: "RESTORED", restoredEventCount, referencesToRelink, failure: null });
  },
  recoveryFailed(): void {
    replace({ recovery: "FAILED", failure: "RECOVERY_FAILED" });
  },
  reset(): void {
    current = INITIAL;
    for (const listener of listeners) listener();
  },
});
