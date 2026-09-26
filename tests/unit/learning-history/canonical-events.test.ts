import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  canonicalAttemptBatch,
  deserializeCanonicalEvent,
  entityCanonicality,
  isSignificantAttempt,
  isSyncEligible,
  parseCanonicalEvent,
  readLegacyReference,
  serializeCanonicalEvent,
  validateCanonicalEvent,
  validateDefinitionIdentity,
} = await import("../../../src/modules/learning-history/index.ts");
import type {
  AttemptId,
  CanonicalEvent,
  EventId,
} from "../../../src/modules/learning-history/index.ts";

const uuid = (suffix: number) => `00000000-0000-7000-8000-${suffix.toString().padStart(12, "0")}`;
const hash = `sha256:${"a".repeat(64)}`;

const none = { modes: ["NONE"] as const, hintCount: 0, retryCount: 0 };
const localReference = {
  referenceId: "local-ref-001",
  storagePolicy: "LOCAL_ONLY" as const,
  contentIncluded: false as const,
  sha256: hash,
};

function base(eventType: CanonicalEvent["eventType"], payload: unknown, overrides: Record<string, unknown> = {}) {
  return {
    id: uuid(1),
    schemaVersion: 1,
    eventType,
    learnerRef: uuid(2),
    deviceRef: uuid(3),
    occurredAt: 2_000,
    recordedAt: 2_100,
    deviceLocalOrder: 1,
    classification: "SYNC_ALLOWED",
    definitionIdentity: { definitionId: uuid(4), definitionVersion: 1, definitionHash: hash },
    attemptId: uuid(5),
    payload,
    ...overrides,
  };
}

function evidenceEvent(overrides: Record<string, unknown> = {}) {
  return base("EVIDENCE_CREATED", {
    evidenceId: uuid(6),
    evidenceType: "MISSION_ATTEMPT",
    conceptIds: ["CSV_DELIMITER"],
    competencyIds: ["EXCEL_CSV_IMPORT"],
    result: { status: "VALID", outcomeCode: "SUCCESSFUL_GUIDED", criteria: [] },
    assistance: none,
    evidenceClassification: "SYNC_ALLOWED",
    artifactRefs: [localReference],
    sourceRefs: [],
  }, overrides);
}

test("A. a valid canonical event is accepted and deeply immutable", () => {
  const event = parseCanonicalEvent(evidenceEvent());
  assert.equal(event.eventType, "EVIDENCE_CREATED");
  assert.equal(Object.isFrozen(event), true);
  assert.equal(Object.isFrozen(event.payload), true);
});

test("B. an invalid UUID version is rejected", () => {
  assert.equal(validateCanonicalEvent({ ...evidenceEvent(), id: "00000000-0000-4000-8000-000000000001" }), false);
});

test("C. a definition identity is versioned and immutable", () => {
  const identity = validateDefinitionIdentity({ definitionId: uuid(4), definitionVersion: 2, definitionHash: hash });
  assert.equal(identity.definitionVersion, 2);
  assert.equal(Object.isFrozen(identity), true);
});

test("D. an empty started attempt remains non-canonical", () => {
  const started = parseCanonicalEvent(base("ATTEMPT_STARTED", {}));
  assert.equal(isSignificantAttempt([started]), false);
  assert.deepEqual(canonicalAttemptBatch([started]), []);
});

test("E. an answered attempt becomes significant", () => {
  const answered = parseCanonicalEvent(base("ATTEMPT_ANSWERED", {
    stepRef: "step-1",
    responseKind: "SHORT_TEXT",
    responseRef: localReference,
    outcome: "SUBMITTED",
    assistance: none,
  }));
  assert.equal(isSignificantAttempt([answered]), true);
  assert.equal(canonicalAttemptBatch([answered]).length, 1);
});

test("F. Evidence is canonical", () => {
  assert.equal(entityCanonicality("Evidence")?.canonical, true);
  assert.equal(parseCanonicalEvent(evidenceEvent()).eventType, "EVIDENCE_CREATED");
});

test("G. ErrorOccurrence is canonical without ErrorPattern aggregation", () => {
  const event = parseCanonicalEvent(base("ERROR_OBSERVED", {
    errorOccurrenceId: uuid(7),
    evidenceId: uuid(6),
    conceptIds: ["CSV_DELIMITER"],
    competencyIds: ["EXCEL_CSV_IMPORT"],
    errorType: "PROCEDURAL_ERROR",
    errorCode: "WRONG_DELIMITER",
    severity: "MEDIUM",
    context: { stepRef: "step-1", sourceRefs: [] },
  }));
  assert.equal(event.eventType, "ERROR_OBSERVED");
  assert.equal(entityCanonicality("ErrorOccurrence")?.canonical, true);
});

test("H. ReviewResult preserves deterministic scheduling inputs without FSRS", () => {
  const event = parseCanonicalEvent(base("REVIEW_COMPLETED", {
    reviewResultId: uuid(8),
    sourceEvidenceIds: [uuid(6)],
    sourceErrorOccurrenceIds: [uuid(7)],
    conceptIds: ["CSV_DELIMITER"],
    competencyIds: ["EXCEL_CSV_IMPORT"],
    outcome: "CORRECT",
    responseMode: "CHOICE",
    durationMs: 5_000,
    confidence: 4,
    assistance: none,
  }));
  assert.equal(event.eventType, "REVIEW_COMPLETED");
  assert.equal(entityCanonicality("ReviewResult")?.canonical, true);
});

test("I. CompetencyState is excluded from canonical truth", () => {
  const row = entityCanonicality("CompetencyStateProjection");
  assert.equal(row?.canonical, false);
  assert.equal(row?.reconstructible, true);
});

test("J. ErrorPatternProjection is excluded from canonical truth", () => {
  const row = entityCanonicality("ErrorPatternProjection");
  assert.equal(row?.canonical, false);
  assert.equal(row?.reconstructible, true);
});

test("K. UNKNOWN classification blocks sync eligibility", () => {
  const event = parseCanonicalEvent(evidenceEvent({
    classification: "UNKNOWN_BLOCKED",
    payload: { ...(evidenceEvent().payload as Record<string, unknown>), evidenceClassification: "UNKNOWN_BLOCKED" },
  }));
  assert.equal(isSyncEligible(event), false);
});

test("L. local-only content cannot be embedded in a sync payload", () => {
  const unsafe = evidenceEvent();
  unsafe.payload = {
    ...(unsafe.payload as Record<string, unknown>),
    artifactRefs: [{ ...localReference, contentIncluded: true, rawAudioBase64: "synthetic-not-audio" }],
  };
  assert.equal(validateCanonicalEvent(unsafe), false);
});

test("M. assistance provenance survives later success", () => {
  const event = parseCanonicalEvent(base("ATTEMPT_COMPLETED", {
    completion: "COMPLETED",
    assistance: { modes: ["HINT", "GUIDED"], hintCount: 2, retryCount: 1 },
  }));
  if (event.eventType !== "ATTEMPT_COMPLETED") assert.fail("Expected an ATTEMPT_COMPLETED event.");
  assert.deepEqual(event.payload.assistance.modes, ["HINT", "GUIDED"]);
  assert.equal(event.payload.assistance.hintCount, 2);
});

test("N. clock skew is tolerated and timestamps do not reorder or reject events", () => {
  const event = parseCanonicalEvent(evidenceEvent({ occurredAt: 5_000, recordedAt: 1_000, deviceLocalOrder: 9 }));
  assert.equal(event.occurredAt > event.recordedAt, true);
  assert.equal(event.deviceLocalOrder, 9);
});

test("O. legacy identifiers remain readable without UUID rewriting", () => {
  const legacy = readLegacyReference({ namespace: "mission-runtime-v1", entityType: "ATTEMPT", legacyId: "excel-level-1-1700-old-id" });
  assert.equal(legacy.legacyId, "excel-level-1-1700-old-id");
  assert.equal(legacy.canonicalId, null);
});

test("P. canonical events survive a serialization round-trip", () => {
  const event = parseCanonicalEvent(evidenceEvent());
  assert.deepEqual(deserializeCanonicalEvent(serializeCanonicalEvent(event)), event);
});

test("branded domain IDs are not structurally interchangeable", () => {
  type EventCannotBeAttempt = EventId extends AttemptId ? false : true;
  const isolated: EventCannotBeAttempt = true;
  assert.equal(isolated, true);
});
