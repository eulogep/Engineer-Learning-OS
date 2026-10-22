import { validateAcademicSourceIndex } from "../academic-workspace/source-index-validation";
import type { AcademicSourceIndex, AcademicSourceIndexEntry } from "../academic-workspace/types";
import { ImportError } from "./import";
import type { StudioDocument } from "./types";

export function parseLocalCatalogue(value: unknown): AcademicSourceIndex {
  if (!validateAcademicSourceIndex(value)) throw new ImportError("Catalogue académique invalide.");
  if ("_publicSampleNotice" in value) throw new ImportError("Ce catalogue est un exemple public, pas votre index local réel.");
  return value;
}

export function sourceImportAllowed(source: AcademicSourceIndexEntry): boolean {
  return ["PUBLIC", "TRAINING_SYNTHETIC", "ACADEMIC_PERSONAL_USE", "PERSONAL"].includes(source.dataClassification);
}

/** Binding is explicit and checksum-checked; source authority never grants mastery or exam scope. */
export function bindAcademicSource(document: StudioDocument, source: AcademicSourceIndexEntry): StudioDocument {
  if (!sourceImportAllowed(source)) throw new ImportError("Classification interdite dans le Studio académique.");
  if (!document.provenance || document.provenance.sha256 !== source.sha256) throw new ImportError("Empreinte différente : fichier non relié au catalogue.");
  return { ...document, subjectId: source.course, academicSource: {
    id: source.id, path: source.path, sha256: source.sha256, status: source.status,
    classification: source.dataClassification, examScope: "UNCONFIRMED",
  } };
}

export function catalogueAvailability(index: AcademicSourceIndex, documents: readonly StudioDocument[]) {
  return index.sources.map((source) => ({ source, available: documents.some((document) =>
    document.academicSource?.id === source.id && document.provenance?.sha256 === source.sha256),
    allowed: sourceImportAllowed(source),
  }));
}
