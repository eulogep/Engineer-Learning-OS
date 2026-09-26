import type { CanonicalClassification } from "./types";

export type LegacyDataClassification =
  | "PUBLIC"
  | "TRAINING_SYNTHETIC"
  | "ACADEMIC_PERSONAL_USE"
  | "PERSONAL"
  | "COMPANY_INTERNAL"
  | "COMPANY_RESTRICTED"
  | "UNKNOWN";

export type ContentDisposition = "METADATA_ONLY" | "RAW_CONTENT";

export function mapLegacyClassification(
  classification: LegacyDataClassification,
  disposition: ContentDisposition,
): CanonicalClassification {
  if (classification === "UNKNOWN") return "UNKNOWN_BLOCKED";
  if (disposition === "RAW_CONTENT") return "LOCAL_ONLY";
  if (classification === "COMPANY_INTERNAL" || classification === "COMPANY_RESTRICTED") {
    return "LOCAL_ONLY";
  }
  return "SYNC_ALLOWED";
}

export function classificationAllowsSync(classification: CanonicalClassification): boolean {
  return classification === "SYNC_ALLOWED";
}

