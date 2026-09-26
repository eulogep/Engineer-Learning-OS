import { z } from "zod";

import { UUIDV7_CANONICAL_PATTERN } from "./schemas";
import type { CanonicalClassification, EventId, JobId } from "./types";

declare const syncIdempotencyKeyBrand: unique symbol;

export type SyncIdempotencyKey = string & {
  readonly [syncIdempotencyKeyBrand]: "SyncIdempotencyKey";
};

export type SyncQueueJob = Readonly<{
  id: JobId;
  eventId: EventId;
  idempotencyKey: SyncIdempotencyKey;
  state: "PENDING";
  createdAt: number;
  attempts: 0;
  classification: CanonicalClassification;
}>;

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;

export const syncQueueJobSchema = z.object({
  id: z.string().regex(UUIDV7_CANONICAL_PATTERN),
  eventId: z.string().regex(UUIDV7_CANONICAL_PATTERN),
  idempotencyKey: z.string().min(1).max(160).regex(IDEMPOTENCY_KEY_PATTERN),
  state: z.literal("PENDING"),
  createdAt: z.number().int().nonnegative().safe(),
  attempts: z.literal(0),
  classification: z.enum(["SYNC_ALLOWED", "LOCAL_ONLY", "UNKNOWN_BLOCKED"]),
}).strict();

export function createSyncIdempotencyKey(value: string): SyncIdempotencyKey {
  return z.string().min(1).max(160).regex(IDEMPOTENCY_KEY_PATTERN).parse(value) as SyncIdempotencyKey;
}

export function parseSyncQueueJob(value: unknown): SyncQueueJob {
  return Object.freeze(syncQueueJobSchema.parse(value)) as SyncQueueJob;
}

export function serializeSyncQueueJob(job: SyncQueueJob): string {
  return JSON.stringify(job);
}

export function deserializeSyncQueueJob(serialized: string): SyncQueueJob {
  return parseSyncQueueJob(JSON.parse(serialized) as unknown);
}