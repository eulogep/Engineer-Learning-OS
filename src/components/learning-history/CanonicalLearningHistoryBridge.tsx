"use client";

import { useEffect, useMemo } from "react";
import { CanonicalStorageError, IndexedDbCanonicalLearningRepository, canonicalPersistenceStatus } from "@/modules/learning-history/adapters/indexeddb";
import { canonicalOperationsStatus } from "@/modules/learning-history/operations/browser-status";
import { createOperationalTelemetry } from "@/modules/learning-history/operations/telemetry";
import { localOperationalTelemetry } from "@/modules/learning-history/operations/telemetry-journal";
import { reconcileLegacyLearningHistory } from "@/modules/learning-history/integration/legacy-shadow";
import { browserCanonicalIdentity } from "@/modules/learning-history/remote/browser-identity";
import { useLearningRecordStore } from "@/modules/learning-records/browser-store";
import { useReviewEngineStore } from "@/modules/review-engine/browser-store";

let reconciliation: Promise<unknown> = Promise.resolve();

export function CanonicalLearningHistoryBridge() {
  const repository = useMemo(() => new IndexedDbCanonicalLearningRepository(), []);
  const recordsHydrated = useLearningRecordStore((state) => state.hydrated);
  const evidence = useLearningRecordStore((state) => state.evidence);
  const deletions = useLearningRecordStore((state) => state.deletions);
  const reviewHydrated = useReviewEngineStore((state) => state.hydrated);
  const errorSignals = useReviewEngineStore((state) => state.errorSignals);
  const reviewItems = useReviewEngineStore((state) => state.reviewItems);
  const reviewResults = useReviewEngineStore((state) => state.results);

  useEffect(() => () => repository.close(), [repository]);
  useEffect(() => {
    if (!recordsHydrated || !reviewHydrated) return;
    const snapshot = { repository, identity: browserCanonicalIdentity(), evidence, deletions, errorSignals, reviewItems, reviewResults };
    canonicalOperationsStatus.reconciling();
    reconciliation = reconciliation
      .catch(() => undefined)
      .then(async () => {
        const startedAt = Date.now();
        await reconcileLegacyLearningHistory(snapshot);
        const [persistence, eventCount, outboxCount] = await Promise.all([
          canonicalPersistenceStatus(), repository.countEvents(), repository.countOutboxJobs(),
        ]);
        canonicalOperationsStatus.ready(persistence, eventCount, outboxCount);
        localOperationalTelemetry.record(createOperationalTelemetry({ code: "CANONICAL_RECONCILIATION_COMPLETED", component: "LOCAL_STORE", timestamp: Date.now(), durationMs: Date.now() - startedAt, deviceId: snapshot.identity.deviceRef, queueDepth: outboxCount, backupStatus: null, jobState: null, latencyMs: null, route: null }));
      })
      .catch((error: unknown) => {
        canonicalOperationsStatus.failed(error instanceof CanonicalStorageError ? error.reason : "STORAGE_FAILURE");
        localOperationalTelemetry.record(createOperationalTelemetry({ code: "CANONICAL_WRITE_LOSS", component: "LOCAL_STORE", timestamp: Date.now(), durationMs: null, deviceId: snapshot.identity.deviceRef, queueDepth: null, backupStatus: null, jobState: null, latencyMs: null, route: null }));
      });
  }, [repository, recordsHydrated, reviewHydrated, evidence, deletions, errorSignals, reviewItems, reviewResults]);

  return null;
}
