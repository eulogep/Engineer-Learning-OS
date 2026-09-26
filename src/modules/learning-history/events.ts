import { classificationAllowsSync } from "./classification";
import { canonicalEventSchema } from "./schemas";
import type { CanonicalEvent, CanonicalEventType } from "./types";

const SIGNIFICANT_EVENT_TYPES: ReadonlySet<CanonicalEventType> = new Set([
  "ATTEMPT_ANSWERED",
  "ATTEMPT_COMPLETED",
  "EVIDENCE_CREATED",
  "ERROR_OBSERVED",
  "REVIEW_COMPLETED",
  "HINT_USED",
  "MISSION_COMPLETED",
  "ASSESSMENT_SCORED",
  "CONFIDENCE_RECORDED",
]);

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) deepFreeze(nested);
    Object.freeze(value);
  }
  return value;
}

export function parseCanonicalEvent(value: unknown): CanonicalEvent {
  return deepFreeze(canonicalEventSchema.parse(value) as CanonicalEvent);
}

export function isSignificantAttempt(events: readonly CanonicalEvent[]): boolean {
  return events.some((event) => SIGNIFICANT_EVENT_TYPES.has(event.eventType));
}

export function canonicalAttemptBatch(events: readonly CanonicalEvent[]): readonly CanonicalEvent[] {
  return isSignificantAttempt(events) ? Object.freeze([...events]) : Object.freeze([]);
}

export function isSyncEligible(event: CanonicalEvent): boolean {
  return classificationAllowsSync(event.classification);
}

export function serializeCanonicalEvent(event: CanonicalEvent): string {
  return JSON.stringify(event);
}

export function deserializeCanonicalEvent(serialized: string): CanonicalEvent {
  return parseCanonicalEvent(JSON.parse(serialized) as unknown);
}

