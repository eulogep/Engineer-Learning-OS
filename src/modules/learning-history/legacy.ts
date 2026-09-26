import type { CanonicalEntityMatrixRow } from "./types";

export type LegacyEntityType =
  | "ATTEMPT"
  | "EVIDENCE"
  | "ERROR_SIGNAL"
  | "ERROR_PATTERN_DERIVED"
  | "REVIEW_RESULT"
  | "MISSION_DEFINITION";

export type LegacyReference = Readonly<{
  namespace: string;
  entityType: LegacyEntityType;
  legacyId: string;
  canonicalId: string | null;
}>;

export function readLegacyReference(input: {
  namespace: string;
  entityType: LegacyEntityType;
  legacyId: string;
  canonicalId?: string | null;
}): LegacyReference {
  if (!input.namespace.trim() || !input.legacyId.trim()) {
    throw new Error("Legacy namespace and identifier are required.");
  }
  return Object.freeze({
    namespace: input.namespace,
    entityType: input.entityType,
    legacyId: input.legacyId,
    canonicalId: input.canonicalId ?? null,
  });
}

export const CANONICAL_VS_DERIVED_MATRIX: readonly CanonicalEntityMatrixRow[] = Object.freeze([
  { entity: "Evidence", canonical: true, why: "Durable pedagogical proof metadata.", reconstructible: false, source: "EVIDENCE_CREATED" },
  { entity: "SignificantAttempt", canonical: true, why: "Preserves meaningful learner activity.", reconstructible: false, source: "ATTEMPT_* events" },
  { entity: "ErrorOccurrence", canonical: true, why: "Preserves an observed error without aggregation.", reconstructible: false, source: "ERROR_OBSERVED" },
  { entity: "ReviewResult", canonical: true, why: "Preserves delayed retrieval performance.", reconstructible: false, source: "REVIEW_COMPLETED" },
  { entity: "HintUsed", canonical: true, why: "Assistance changes pedagogical interpretation.", reconstructible: false, source: "HINT_USED" },
  { entity: "MissionCompleted", canonical: true, why: "Completion is a durable learner fact.", reconstructible: false, source: "MISSION_COMPLETED" },
  { entity: "CompetencyStateProjection", canonical: false, why: "Derived from evidence and definition rules.", reconstructible: true, source: "CanonicalLearningHistory" },
  { entity: "ErrorPatternProjection", canonical: false, why: "Aggregates ErrorOccurrence events.", reconstructible: true, source: "ERROR_OBSERVED events" },
  { entity: "ReviewScheduleProjection", canonical: false, why: "Derived scheduling state.", reconstructible: true, source: "ErrorOccurrence and ReviewResult" },
  { entity: "ProgressProjection", canonical: false, why: "Derived learner-facing summary.", reconstructible: true, source: "CanonicalLearningHistory" },
  { entity: "DerivedArtifact", canonical: false, why: "Generated material is not learner truth.", reconstructible: true, source: "Source metadata and generator recipe" },
  { entity: "DocumentCache", canonical: false, why: "Extraction cache is disposable infrastructure.", reconstructible: true, source: "Local source file" },
  { entity: "RawAudio", canonical: false, why: "Private binary remains local-only content.", reconstructible: false, source: "LocalOnlyContent reference" },
  { entity: "RawAcademicFile", canonical: false, why: "Copyright-sensitive binary remains local-only.", reconstructible: false, source: "LocalOnlyContent reference" },
]);

export function entityCanonicality(entity: string): CanonicalEntityMatrixRow | null {
  return CANONICAL_VS_DERIVED_MATRIX.find((row) => row.entity === entity) ?? null;
}
