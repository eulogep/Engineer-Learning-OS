import type { AcademicSourceIndex, AcademicSourceIndexEntry, AcademicSourceIndexStatus } from "./types";

const SOURCE_STATUSES = new Set<AcademicSourceIndexStatus>(["CURRENT_PRIMARY", "CURRENT_SECONDARY", "PROGRAM_ONLY", "HISTORICAL_REFERENCE", "UNVERIFIED"]);
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function validSource(value: unknown): value is AcademicSourceIndexEntry {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && Boolean(value.id)
    && typeof value.course === "string" && typeof value.type === "string"
    && typeof value.path === "string" && /^(knowledge|knowledge-private)\//.test(value.path) && !value.path.includes("..")
    && SOURCE_STATUSES.has(value.status as AcademicSourceIndexStatus)
    && typeof value.canonical === "boolean" && value.provenanceRole === "ORIGINAL_SOURCE"
    && ["PUBLIC", "TRAINING_SYNTHETIC", "ACADEMIC_PERSONAL_USE", "PERSONAL", "COMPANY_INTERNAL", "COMPANY_RESTRICTED", "UNKNOWN"].includes(String(value.dataClassification))
    && ["TRACKED", "LOCAL_ONLY"].includes(String(value.repositoryVisibility))
    && typeof value.sha256 === "string" && /^[a-f0-9]{64}$/.test(value.sha256)
    && (!value.path.startsWith("knowledge-private/") || value.repositoryVisibility === "LOCAL_ONLY");
}
/** Standalone validator: importing it never bundles a local source catalogue. */
export function validateAcademicSourceIndex(value: unknown): value is AcademicSourceIndex {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.generatedAt !== "string"
    || !Array.isArray(value.sources) || !Array.isArray(value.missingButKnownInChatGPT)
    || !value.sources.every(validSource) || !value.missingButKnownInChatGPT.every((item) => typeof item === "string")) return false;
  if (!isRecord(value.provenancePolicy) || value.provenancePolicy.originalSourceRole !== "ORIGINAL_SOURCE"
    || value.provenancePolicy.derivedArtifactRole !== "DERIVED" || value.provenancePolicy.derivedDirectory !== "knowledge/.derived"
    || value.provenancePolicy.masteryFromSourcePresence !== false) return false;
  const ids = value.sources.map((source) => source.id);
  const paths = value.sources.map((source) => source.path);
  return new Set(ids).size === ids.length && new Set(paths).size === paths.length;
}
