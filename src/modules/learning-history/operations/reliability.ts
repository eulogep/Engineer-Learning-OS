import { canonicalHistoryDigest, exportCanonicalHistory, importCanonicalHistory, type ExportOptions } from "../export/recovery";
import type { CanonicalRecoveryRepository } from "../export/export-format";
import type { CanonicalEvent } from "../types";
import { rebuildProjections, type ProjectionPolicy } from "../projections/rebuild";

export type BackupVerificationStatus = "TRUSTED" | "STALE" | "FAILED" | "UNRESTORED";

export type BackupEvidence = Readonly<{
  exists: boolean;
  createdAt: number | null;
  checkedAt: number;
  maxAgeMs: number;
  checksum: "VERIFIED" | "FAILED" | "NOT_CHECKED";
  restore: "VERIFIED" | "FAILED" | "NOT_RUN";
}>;

export type BackupAssessment = Readonly<{
  status: BackupVerificationStatus;
  ageMs: number | null;
  reasons: readonly string[];
}>;

export function assessBackup(raw: BackupEvidence): BackupAssessment {
  if (!Number.isSafeInteger(raw.checkedAt) || raw.checkedAt < 0
    || !Number.isSafeInteger(raw.maxAgeMs) || raw.maxAgeMs < 1
    || (raw.createdAt !== null && (!Number.isSafeInteger(raw.createdAt) || raw.createdAt < 0))) {
    throw new Error("Invalid backup evidence.");
  }
  const ageMs = raw.createdAt === null ? null : raw.checkedAt - raw.createdAt;
  const reasons: string[] = [];
  if (!raw.exists || raw.createdAt === null) reasons.push("BACKUP_MISSING");
  if (ageMs !== null && (ageMs < 0 || ageMs > raw.maxAgeMs)) reasons.push("BACKUP_STALE");
  if (raw.checksum === "FAILED") reasons.push("CHECKSUM_FAILED");
  if (raw.restore === "FAILED") reasons.push("RESTORE_FAILED");
  let status: BackupVerificationStatus;
  if (reasons.includes("BACKUP_MISSING") || reasons.includes("CHECKSUM_FAILED")
    || reasons.includes("RESTORE_FAILED")) status = "FAILED";
  else if (raw.restore === "NOT_RUN") status = "UNRESTORED";
  else if (reasons.includes("BACKUP_STALE")) status = "STALE";
  else if (raw.checksum !== "VERIFIED") status = "UNRESTORED";
  else status = "TRUSTED";
  return Object.freeze({ status, ageMs, reasons: Object.freeze(reasons) });
}

export type RestoreDrillResult = Readonly<{
  status: "TRUSTED" | "FAILED";
  canonicalDigestEqual: boolean;
  projectionDigestEqual: boolean;
  eventCountEqual: boolean;
  tombstonesEqual: boolean;
  sourceEventCount: number;
  restoredEventCount: number;
  failureCode?: string;
}>;

async function events(repository: CanonicalRecoveryRepository): Promise<CanonicalEvent[]> {
  const values: CanonicalEvent[] = [];
  for await (const event of repository.iterateEventsForExport()) values.push(event);
  return values;
}

export async function runSyntheticRestoreDrill(input: Readonly<{
  source: CanonicalRecoveryRepository;
  createFreshTarget: () => CanonicalRecoveryRepository;
  exportOptions: ExportOptions;
  projectionPolicy: ProjectionPolicy;
}>): Promise<RestoreDrillResult> {
  const target = input.createFreshTarget();
  try {
    const sourceEvents = await events(input.source);
    const bundle = await exportCanonicalHistory(input.source, input.exportOptions);
    const imported = await importCanonicalHistory(bundle, target);
    const restoredEvents = await events(target);
    const [sourceProjection, restoredProjection] = await Promise.all([
      rebuildProjections(sourceEvents, input.projectionPolicy),
      rebuildProjections(restoredEvents, input.projectionPolicy),
    ]);
    const canonicalDigestEqual = imported.canonicalHistoryDigest
      === await canonicalHistoryDigest({
        events: sourceEvents,
        jobs: await collect(input.source.iterateOutboxJobsForRecovery()),
        definitions: await collect(input.source.iterateDefinitionsForRecovery()),
      });
    const tombstoneIds = (values: typeof sourceEvents) => values
      .filter((event) => event.eventType === "DELETION_REQUESTED")
      .map((event) => event.id)
      .sort();
    const result = {
      canonicalDigestEqual,
      projectionDigestEqual: sourceProjection.digest === restoredProjection.digest,
      eventCountEqual: sourceEvents.length === restoredEvents.length,
      tombstonesEqual: JSON.stringify(tombstoneIds(sourceEvents)) === JSON.stringify(tombstoneIds(restoredEvents)),
      sourceEventCount: sourceEvents.length,
      restoredEventCount: restoredEvents.length,
    };
    return Object.freeze({
      status: Object.values(result).some((value) => value === false) ? "FAILED" : "TRUSTED",
      ...result,
    });
  } catch (error) {
    return Object.freeze({
      status: "FAILED",
      canonicalDigestEqual: false,
      projectionDigestEqual: false,
      eventCountEqual: false,
      tombstonesEqual: false,
      sourceEventCount: await input.source.countEvents(),
      restoredEventCount: await target.countEvents(),
      failureCode: error instanceof Error && "code" in error
        ? String((error as Error & { code: unknown }).code) : "RESTORE_DRILL_FAILED",
    });
  }
}

async function collect<Value>(iterable: AsyncIterable<Value>): Promise<Value[]> {
  const values: Value[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

export type DeletionPropagationAssessment = Readonly<{
  status: "COMPLETE" | "PENDING" | "FAILED";
  staleDeviceIds: readonly string[];
  reasons: readonly string[];
}>;

export function assessDeletionPropagation(input: Readonly<{
  authorized: boolean;
  tombstonePresent: boolean;
  eligibleContentPurged: boolean;
  deletionSequence: number;
  deviceCheckpoints: Readonly<Record<string, number>>;
}>): DeletionPropagationAssessment {
  if (!Number.isSafeInteger(input.deletionSequence) || input.deletionSequence < 1
    || Object.values(input.deviceCheckpoints).some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error("Invalid deletion propagation evidence.");
  }
  const staleDeviceIds = Object.entries(input.deviceCheckpoints)
    .filter(([, sequence]) => sequence < input.deletionSequence)
    .map(([deviceId]) => deviceId)
    .sort();
  const reasons: string[] = [];
  if (!input.authorized) reasons.push("UNAUTHORIZED_DELETION");
  if (!input.tombstonePresent) reasons.push("TOMBSTONE_MISSING");
  if (!input.eligibleContentPurged) reasons.push("PURGE_INCOMPLETE");
  if (staleDeviceIds.length) reasons.push("STALE_DEVICES");
  const failed = !input.authorized || !input.tombstonePresent;
  return Object.freeze({
    status: failed ? "FAILED" : reasons.length ? "PENDING" : "COMPLETE",
    staleDeviceIds: Object.freeze(staleDeviceIds),
    reasons: Object.freeze(reasons),
  });
}
