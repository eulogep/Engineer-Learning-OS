import { IndexedDbCanonicalLearningRepository, canonicalPersistenceStatus } from "../../../src/modules/learning-history/adapters/indexeddb";
import { parseCanonicalEvent } from "../../../src/modules/learning-history/events";
import { parseSyncQueueJob } from "../../../src/modules/learning-history/sync-job";
import { RepositoryInvariantError } from "../../../src/modules/learning-history/repository-errors";
import type { CanonicalEvent, DeviceId, LearnerRef } from "../../../src/modules/learning-history/types";
import type { EvidenceRecord } from "../../../src/modules/learning-records/types";
import { exportCanonicalHistory, importCanonicalHistory } from "../../../src/modules/learning-history/export/recovery";
import { EXPORT_PATHS } from "../../../src/modules/learning-history/export/export-format";
import { rebuildFromRepository } from "../../../src/modules/learning-history/projections/rebuild";
import { reconcileLegacyLearningHistory } from "../../../src/modules/learning-history/integration/legacy-shadow";
import { useLearningRecordStore } from "../../../src/modules/learning-records/browser-store";
import { excelLevel1Mission } from "../../../src/modules/mission-runtime/excel-level-1-mission";
import { useMissionRuntimeStore } from "../../../src/modules/mission-runtime/store";
import { useReviewEngineStore } from "../../../src/modules/review-engine/browser-store";
import { reviewEvidenceFromResult, reviewIsTraceable } from "../../../src/modules/review-engine/core";
import { localAudioEvidenceService } from "../../../src/modules/technical-english/audio-store";

type Phase = "BEFORE_EVENT_WRITE" | "AFTER_EVENT_WRITE" | "BEFORE_JOB_WRITE" | "AFTER_JOB_WRITE";
class FaultRepository extends IndexedDbCanonicalLearningRepository {
  private fault?: { phase: Phase; errorName?: string };
  arm(phase: Phase, errorName?: string): void { this.fault = { phase, errorName }; }
  protected override onAtomicWritePhase(phase: Phase): void {
    if (this.fault?.phase !== phase) return;
    const { errorName } = this.fault;
    this.fault = undefined;
    if (errorName) throw new DOMException("synthetic storage fault", errorName);
    throw new RepositoryInvariantError("Injected synthetic atomic failure: " + phase);
  }
}
const repositories = new Map<string, FaultRepository>();
const names = new Map<string, string>();
const uuid = (value: number) => "00000000-0000-7000-8000-" + value.toString().padStart(12, "0");

function syntheticOperation(value: number) {
  const event = parseCanonicalEvent({
    id: uuid(value), schemaVersion: 1, eventType: "ATTEMPT_ANSWERED", learnerRef: uuid(900000), deviceRef: uuid(900001),
    occurredAt: 100, recordedAt: 101, deviceLocalOrder: value, classification: "SYNC_ALLOWED",
    definitionIdentity: { definitionId: uuid(900002), definitionVersion: 1, definitionHash: "sha256:" + "a".repeat(64) },
    attemptId: uuid(900003), payload: { stepRef: "synthetic-step", responseKind: "SHORT_TEXT",
      responseRef: { referenceId: "synthetic-opaque-response", storagePolicy: "LOCAL_ONLY", contentIncluded: false },
      outcome: "SUBMITTED", assistance: { modes: ["NONE"], hintCount: 0, retryCount: 0 } },
  }) as Extract<CanonicalEvent, { eventType: "ATTEMPT_ANSWERED" }>;
  const job = parseSyncQueueJob({ id: uuid(value + 1000000), eventId: event.id, idempotencyKey: "synthetic-sync-" + value,
    state: "PENDING", createdAt: 101, attempts: 0, classification: "SYNC_ALLOWED" });
  return { event, job };
}
function checkedName(name: string): string {
  if (!name.startsWith("elos-test-")) throw new Error("Only synthetic test databases are allowed.");
  return name;
}
function repo(id: string): FaultRepository {
  const value = repositories.get(id);
  if (!value) throw new Error("Unknown synthetic repository.");
  return value;
}
const idbRequest = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
});
async function inspect(name: string) {
  const db = await idbRequest(indexedDB.open(checkedName(name)));
  try {
    const tx = db.transaction(["canonicalEvents", "syncQueue"], "readonly");
    const [events, jobs] = await Promise.all([
      idbRequest(tx.objectStore("canonicalEvents").getAll()), idbRequest(tx.objectStore("syncQueue").getAll()),
    ]);
    const eventIds = new Set(events.map((record) => record.eventId));
    const jobEventIds = new Set(jobs.map((record) => record.eventId));
    const containsRaw = (value: unknown): boolean => {
      if (value instanceof Blob || value instanceof ArrayBuffer) return true;
      if (!value || typeof value !== "object") return false;
      return Object.entries(value).some(([key, child]) =>
        ["rawAudioBase64", "rawContent", "pdfBody", "screenshot", "blob"].includes(key) || containsRaw(child));
    };
    return { events: events.length, jobs: jobs.length,
      orphanEvents: events.filter((record) => !jobEventIds.has(record.eventId)).length,
      orphanJobs: jobs.filter((record) => !eventIds.has(record.eventId)).length,
      containsRaw: containsRaw(events) || containsRaw(jobs), version: db.version,
      stores: Array.from(db.objectStoreNames),
      indexes: Object.fromEntries(Array.from(db.objectStoreNames).map((name) => {
        const store = db.transaction(name).objectStore(name);
        return [name, Array.from(store.indexNames)];
      })),
    };
  } finally { db.close(); }
}

const api = {
  async localAudioRoundTrip() {
    const source = new Blob(["synthetic browser audio"], { type: "audio/webm" });
    const reference = await localAudioEvidenceService.save(source, 1_250);
    const loaded = await localAudioEvidenceService.load(reference);
    const database = await idbRequest(indexedDB.open("engineer-learning-os-evidence"));
    const countBeforeDelete = await idbRequest(database.transaction("files", "readonly").objectStore("files").count());
    database.close();
    await localAudioEvidenceService.remove(reference);
    const reopened = await idbRequest(indexedDB.open("engineer-learning-os-evidence"));
    const countAfterDelete = await idbRequest(reopened.transaction("files", "readonly").objectStore("files").count());
    reopened.close();
    return {
      sourceSize: source.size,
      loadedSize: loaded?.size ?? 0,
      loadedType: loaded?.type ?? null,
      durationMs: reference.durationMs,
      referenceContainsContent: JSON.stringify(reference).includes("synthetic browser audio"),
      countBeforeDelete,
      countAfterDelete,
    };
  },
  async dailyLearningLoop() {
    useMissionRuntimeStore.setState({ hydrated: true, attempts: {}, drafts: {} });
    useLearningRecordStore.setState({
      hydrated: true, evidence: [], deletions: [], competencies: [], events: [],
    });
    useReviewEngineStore.setState({
      hydrated: true, errorSignals: [], errorPatterns: [], reviewItems: [], results: [], events: [],
      activeItemId: null, startedAt: {}, drafts: {}, feedback: {}, retries: {}, hints: {},
    });
    const acknowledge = () => {
      useMissionRuntimeStore.getState().submit(excelLevel1Mission, "acknowledged");
      useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
    };
    useMissionRuntimeStore.getState().reset(excelLevel1Mission);
    useMissionRuntimeStore.getState().start(excelLevel1Mission);
    acknowledge(); acknowledge(); acknowledge();
    useMissionRuntimeStore.getState().submit(excelLevel1Mission, "single-column");
    useMissionRuntimeStore.getState().retry(excelLevel1Mission);
    useMissionRuntimeStore.getState().submit(excelLevel1Mission, "separate-columns");
    useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
    useMissionRuntimeStore.getState().submit(excelLevel1Mission, "Energy_kWh est manquante pour L1-005");
    useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
    useMissionRuntimeStore.getState().submitEvidence(excelLevel1Mission, {
      id: "browser-held-out-proof", displayName: "browser-private-evidence.png",
      mimeType: "image/png", size: 2048, storedAt: Date.now(),
    });
    useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
    useMissionRuntimeStore.getState().submit(excelLevel1Mission, "4");
    useMissionRuntimeStore.getState().continueStep(excelLevel1Mission);
    acknowledge();
    const attempt = useMissionRuntimeStore.getState().attempts[excelLevel1Mission.id];
    useLearningRecordStore.getState().syncExcelAttempt(attempt, excelLevel1Mission);
    const missionEvidence = useLearningRecordStore.getState().evidence;
    const reviewAt = (attempt.completedAt ?? Date.now()) + 1;
    useReviewEngineStore.getState().syncExcelAttempt(
      attempt, missionEvidence.map((record) => record.id), reviewAt,
    );
    const beforeReview = useReviewEngineStore.getState();
    const item = beforeReview.reviewItems[0];
    if (!item || !reviewIsTraceable(item, beforeReview.errorPatterns, missionEvidence)) {
      throw new Error("Daily loop review is not traceable.");
    }
    useReviewEngineStore.getState().startReview(item.id, reviewAt + 1);
    useReviewEngineStore.getState().setDraft(item.id, "delimiter");
    useReviewEngineStore.getState().submitAnswer(item.id, reviewAt + 2);
    const result = useReviewEngineStore.getState().finishReview(item.id, true, 4, reviewAt + 1_000);
    if (!result) throw new Error("Daily loop review did not finish.");
    useLearningRecordStore.getState().addEvidenceRecords([reviewEvidenceFromResult(item, result)]);
    const learning = useLearningRecordStore.getState();
    const review = useReviewEngineStore.getState();
    const name = checkedName("elos-test-daily-loop-" + crypto.randomUUID());
    const repository = new IndexedDbCanonicalLearningRepository({ databaseName: name });
    const input = {
      repository,
      identity: { learnerRef: uuid(910000) as LearnerRef, deviceRef: uuid(910001) as DeviceId },
      evidence: learning.evidence, deletions: learning.deletions,
      errorSignals: review.errorSignals, reviewItems: review.reviewItems, reviewResults: review.results,
    } as const;
    const first = await reconcileLegacyLearningHistory(input);
    const second = await reconcileLegacyLearningHistory(input);
    const serialized: string[] = [];
    for await (const event of repository.iterateEventsForExport()) serialized.push(JSON.stringify(event));
    const state = await inspect(name);
    const competency = learning.competencies.find((record) => record.competencyId === "EXCEL_CSV_IMPORT");
    const eventTypes = {
      evidence: (await repository.readEventsByType("EVIDENCE_CREATED")).length,
      errors: (await repository.readEventsByType("ERROR_OBSERVED")).length,
      reviews: (await repository.readEventsByType("REVIEW_COMPLETED")).length,
    };
    repository.close();
    const canonical = serialized.join("\n");
    return {
      first, second, ...state, eventTypes,
      missionStatus: attempt.status,
      evidenceCount: learning.evidence.length,
      errorCount: review.errorSignals.length,
      reviewCount: review.results.length,
      competencyStatus: competency?.status,
      competencyTraceable: competency?.supportingEvidenceIds.every(
        (id) => learning.evidence.some((record) => record.id === id),
      ) ?? false,
      containsPrivate: canonical.includes("single-column")
        || canonical.includes("browser-private-evidence.png")
        || canonical.includes("learnerResponses")
        || canonical.includes("displayName"),
    };
  },
  async legacyReconcile() {
    const name = checkedName("elos-test-legacy-shadow-" + crypto.randomUUID());
    const repository = new IndexedDbCanonicalLearningRepository({ databaseName: name });
    const evidence: EvidenceRecord = {
      id: "browser-evidence", attemptId: "browser-attempt", missionId: "browser-mission", missionVersion: 1,
      competencyIds: ["EXCEL_CSV_IMPORT"], createdAt: 100, evidenceType: "MISSION_COMPLETION",
      artifactReference: { id: "browser-artifact", displayName: "private-browser-file.xlsx",
        mimeType: "application/octet-stream", size: 8, storedAt: 90, verificationStatus: "UNVERIFIED" },
      learnerResponses: { answer: "private browser answer" },
      evaluationResult: { outcome: "SUCCESSFUL_GUIDED", delimiterDiagnostic: "VALID",
        anomalyIdentification: "VALID", missionCompletion: "VALID" },
      assistance: { hintCount: 0, retryCount: 0 }, selfEvaluation: 4,
      sourceClassification: "PERSONAL", verificationStatus: "VALID",
    };
    const input = { repository, identity: { learnerRef: uuid(900000) as LearnerRef, deviceRef: uuid(900001) as DeviceId },
      evidence: [evidence], deletions: [], errorSignals: [], reviewItems: [], reviewResults: [] } as const;
    const first = await reconcileLegacyLearningHistory(input);
    const second = await reconcileLegacyLearningHistory(input);
    const deletion = { id: "browser-deletion", evidenceId: evidence.id, requestedAt: 200 } as const;
    const deleted = await reconcileLegacyLearningHistory({ ...input, evidence: [], deletions: [deletion] });
    const replayed = await reconcileLegacyLearningHistory({ ...input, deletions: [deletion] });
    const tombstones = await repository.readTombstones();
    const serialized: string[] = [];
    for await (const event of repository.iterateEventsForExport()) serialized.push(JSON.stringify(event));
    const state = await inspect(name);
    repository.close();
    return { first, second, deleted, replayed, tombstones: tombstones.length, ...state,
      containsPrivate: serialized.join("\n").includes("private browser")
        || serialized.join("\n").includes("private-browser-file.xlsx") };
  },
  async create(id: string, name: string) {
    if (!repositories.has(id)) {
      repositories.set(id, new FaultRepository({ databaseName: checkedName(name) })); names.set(id, name);
    }
    await Promise.all(Array.from({ length: 10 }, () => repo(id).initialize()));
  },
  async invoke(id: string, method: string, args: unknown[]) {
    const repository = repo(id);
    if (method === "iterateEventsForExport") {
      const result: CanonicalEvent[] = [];
      for await (const event of repository.iterateEventsForExport(Number(args[0] ?? 100))) result.push(event);
      return result;
    }
    const allowed = ["appendEvent", "appendEventWithOutbox", "getEventById", "hasEvent", "countEvents",
      "readEventsAfter", "readEventsByAttemptId", "readEventsByEvidenceId", "readEventsByType", "readTombstones",
      "getOutboxJobById", "getOutboxJobByEventId", "countOutboxJobs", "putDefinition", "getDefinition",
      "verifyDefinitionHash", "listReferencedDefinitions", "saveCheckpoint", "getCheckpoint", "initialize"];
    if (!allowed.includes(method)) throw new Error("Unsupported fixture operation.");
    return Reflect.apply(Reflect.get(repository, method), repository, args);
  },
  fail(id: string, phase: Phase, errorName?: string) { repo(id).arm(phase, errorName); },
  close(id: string) { repo(id).close(); },
  operation: syntheticOperation,
  inspect,
  async write(id: string, start: number, count: number) {
    const began = performance.now(); let failures = 0;
    for (let value = start; value < start + count; value++) {
      const { event, job } = syntheticOperation(value);
      try { await repo(id).appendEventWithOutbox(event, job); } catch { failures++; }
    }
    return { durationMs: performance.now() - began, failures, ...await inspect(names.get(id)!) };
  },
  async recoveryRoundTrip(count: number, includeRecoveryCases: boolean) {
    const sourceName = checkedName("elos-test-export-source-" + crypto.randomUUID());
    const targetName = checkedName("elos-test-export-target-" + crypto.randomUUID());
    const source = new IndexedDbCanonicalLearningRepository({ databaseName: sourceName });
    const target = new IndexedDbCanonicalLearningRepository({ databaseName: targetName });
    const beganWrite = performance.now();
    const definition = syntheticOperation(600000).event.definitionIdentity;
    await source.putDefinition(definition);
    for (let value = 0; value < count; value++) {
      const { event, job } = syntheticOperation(100000 + value);
      await source.appendEventWithOutbox(event, job);
    }
    if (includeRecoveryCases) {
      for (const [offset, classification] of [[0, "LOCAL_ONLY"], [1, "UNKNOWN_BLOCKED"]] as const) {
        const { event } = syntheticOperation(700000 + offset);
        await source.appendEvent({ ...event, classification });
      }
      const deletion = parseCanonicalEvent({ id: uuid(700002), schemaVersion: 1, eventType: "DELETION_REQUESTED",
        learnerRef: uuid(900000), deviceRef: uuid(900001), occurredAt: 102, recordedAt: 102,
        deviceLocalOrder: 700002, classification: "LOCAL_ONLY",
        payload: { targetType: "ATTEMPT", targetId: uuid(900003), scope: "LOCAL_ONLY", requestedBy: "LEARNER" } });
      await source.appendEvent(deletion);
    }
    const writeDurationMs = performance.now() - beganWrite;
    const exportBegan = performance.now();
    const bundle = await exportCanonicalHistory(source, { exportId: uuid(800000), createdAt: 1234,
      sourceDatabaseVersion: 1, containsPersonalMetadata: false,
      containsCompanyRestrictedMetadata: false, batchSize: 1000 });
    const exportDurationMs = performance.now() - exportBegan;
    const sourceManifest = JSON.parse(bundle[EXPORT_PATHS.manifest]);
    const sourceCountBefore = await source.countEvents();
    const sourceJobsBefore = await source.countOutboxJobs();
    const importBegan = performance.now();
    const imported = await importCanonicalHistory(bundle, target);
    const importDurationMs = performance.now() - importBegan;
    const idempotent = await importCanonicalHistory(bundle, target);
    const targetBundle = await exportCanonicalHistory(target, { exportId: uuid(800001), createdAt: 1235,
      sourceDatabaseVersion: 1, containsPersonalMetadata: false,
      containsCompanyRestrictedMetadata: false, batchSize: 1000 });
    const targetManifest = JSON.parse(targetBundle[EXPORT_PATHS.manifest]);
    let deletionProtected = true;
    if (includeRecoveryCases) {
      try {
        const { event } = syntheticOperation(700010);
        await target.appendEvent({ ...event, classification: "LOCAL_ONLY" }); deletionProtected = false;
      } catch (error) { deletionProtected = error instanceof RepositoryInvariantError; }
    }
    const sourceCountAfter = await source.countEvents();
    const projectionPolicy = { version: 1 as const, transferDefinitions: [], retrievalDefinitions: [],
      retentionDelayMs: 86400000, reviewDelayMs: 86400000 };
    const sourceProjection = await rebuildFromRepository(source, projectionPolicy);
    const targetProjection = await rebuildFromRepository(target, projectionPolicy);
    const sourceJobsAfter = await source.countOutboxJobs();
    const sourceAfterBundle = await exportCanonicalHistory(source, { exportId: uuid(800002), createdAt: 1236,
      sourceDatabaseVersion: 1, containsPersonalMetadata: false,
      containsCompanyRestrictedMetadata: false, batchSize: 1000 });
    const sourceAfterManifest = JSON.parse(sourceAfterBundle[EXPORT_PATHS.manifest]);
    const allText = Object.values(bundle).join("\n");
    const byteLength = Object.values(bundle).reduce((sum, content) => sum + new TextEncoder().encode(content).byteLength, 0);
    const references = bundle[EXPORT_PATHS.references].trim()
      ? bundle[EXPORT_PATHS.references].trim().split("\n").map((line) => JSON.parse(line)) : [];
    const result = {
      writeDurationMs, exportDurationMs, importDurationMs, byteLength,
      sourceEvents: sourceCountBefore, targetEvents: await target.countEvents(),
      sourceJobs: await source.countOutboxJobs(), targetJobs: await target.countOutboxJobs(),
      sourceDigest: sourceManifest.canonicalHistoryDigest, targetDigest: targetManifest.canonicalHistoryDigest,
      sourceUnchanged: sourceCountBefore === sourceCountAfter && sourceJobsBefore === sourceJobsAfter
        && sourceManifest.canonicalHistoryDigest === sourceAfterManifest.canonicalHistoryDigest,
      imported: imported.status, idempotent: idempotent.status, deletionProtected,
      referenceCount: references.length,
      referencesRequireRelink: references.every((reference) => reference.restoreStatus === "REQUIRES_RELINK" && reference.contentIncluded === false),
      containsForbiddenRaw: /rawAudioBase64|pdfBody|BEGIN PRIVATE KEY|\.env|Google\/Chrome|Cookies/.test(allText),
      classifications: sourceManifest.classificationSummary,
      targetNameDifferent: sourceName !== targetName,
      projectionsEqual: sourceProjection.digest === targetProjection.digest,
    };
    source.close(); target.close();
    return result;
  },
  async upgrade(id: string, holdBlocker: boolean) {
    const name = names.get(id)!;
    const blocker = holdBlocker ? await idbRequest(indexedDB.open(name, 1)) : undefined;
    let blocked = false;
    const request = indexedDB.open(name, 2);
    request.onblocked = () => { blocked = true; blocker?.close(); };
    const timeout = setTimeout(() => blocker?.close(), 1000);
    const db = await idbRequest(request);
    clearTimeout(timeout); db.close(); blocker?.close();
    let reason = "";
    try { await repo(id).initialize(); } catch (error) {
      if (error && typeof error === "object" && "reason" in error) reason = String(error.reason);
    }
    return { blocked, newerVersionRejected: reason === "VERSION_MISMATCH" };
  },
  async openingRecovery(cancel: boolean) {
    const name = checkedName("elos-test-opening-" + crypto.randomUUID());
    const blocker = await idbRequest(indexedDB.open(name, 1));
    const deletion = indexedDB.deleteDatabase(name);
    await new Promise<void>((resolve) => { deletion.onblocked = () => resolve(); });
    const removed = idbRequest(deletion);
    const repository = new IndexedDbCanonicalLearningRepository({ databaseName: name, openTimeoutMs: 100 });
    let reason = "";
    const pending = repository.initialize();
    if (cancel) repository.close();
    try { await pending; } catch (error) {
      if (error && typeof error === "object" && "reason" in error) reason = String(error.reason);
    } finally { blocker.close(); }
    await removed;
    await repository.initialize();
    const count = await repository.countEvents();
    repository.close();
    return { reason, count };
  },
  persistence: () => canonicalPersistenceStatus(false),
};

Object.assign(globalThis, { canonicalTest: {
  async call(method: keyof typeof api, args: unknown[]) {
    try { return { ok: true, value: await Reflect.apply(api[method], api, args) }; }
    catch (error) {
      const value = error instanceof Error ? error : new Error("Unknown fixture failure");
      return { ok: false, error: { name: value.name, message: value.message,
        ...("reason" in value ? { reason: value.reason } : {}) } };
    }
  },
} });
