import assert from "node:assert/strict";
import test from "node:test";
import { bindAcademicSource, catalogueAvailability, parseLocalCatalogue, sourceImportAllowed } from "../../../src/modules/learning-studio/academic-catalogue.ts";
import type { AcademicSourceIndex, AcademicSourceIndexEntry } from "../../../src/modules/academic-workspace/types.ts";
import { buildImportedDocument } from "../../../src/modules/learning-studio/import.ts";

const source: AcademicSourceIndexEntry = {
  id: "synthetic-sql", course: "SQL", type: "TD", path: "knowledge/synthetic.txt", status: "CURRENT_PRIMARY",
  canonical: true, provenanceRole: "ORIGINAL_SOURCE", dataClassification: "ACADEMIC_PERSONAL_USE",
  repositoryVisibility: "LOCAL_ONLY", sha256: "a".repeat(64),
};
const index: AcademicSourceIndex = {
  schemaVersion: 1, generatedAt: "2026-10-22",
  provenancePolicy: { originalSourceRole: "ORIGINAL_SOURCE", derivedArtifactRole: "DERIVED", derivedDirectory: "knowledge/.derived", masteryFromSourcePresence: false },
  sources: [source], missingButKnownInChatGPT: ["missing-synthetic.txt"],
};
const document = {
  ...buildImportedDocument("synthetic", { title: "Synthetic SQL", subjectLabel: "SQL", chapter: "Constraints", docType: "TD" },
    [{ pageNumber: 1, text: "Une clé est un identifiant." }], "section", new Date("2026-10-22")),
  provenance: { sourceId: "synthetic", sha256: source.sha256, originalFileName: "synthetic.txt", extractionMethod: "PLAIN_TEXT_LOCAL",
    artifactRole: "DERIVED" as const, originalRole: "ORIGINAL_SOURCE" as const },
};

test("public example and malformed catalogues cannot masquerade as local truth", () => {
  assert.deepEqual(parseLocalCatalogue(index), index);
  assert.throws(() => parseLocalCatalogue({ ...index, _publicSampleNotice: "sample" }), /exemple public/);
  assert.throws(() => parseLocalCatalogue({ ...index, sources: [source, source] }), /invalide/);
  assert.throws(() => parseLocalCatalogue({ ...index, sources: [{ ...source, path: "knowledge/../secret" }] }), /invalide/);
});

test("only a checksum-bound original is available; missing ChatGPT material stays missing", () => {
  assert.equal(catalogueAvailability(index, [document])[0].available, false);
  const bound = bindAcademicSource(document, source);
  assert.equal(catalogueAvailability(index, [bound])[0].available, true);
  assert.equal(catalogueAvailability({ ...index, sources: [{ ...source, sha256: "b".repeat(64) }] }, [bound])[0].available, false);
  assert.deepEqual(index.missingButKnownInChatGPT, ["missing-synthetic.txt"]);
  assert.throws(() => bindAcademicSource(document, { ...source, sha256: "b".repeat(64) }), /Empreinte/);
});

test("source authority and programme presence grant neither exam scope nor mastery", () => {
  for (const status of ["CURRENT_PRIMARY", "PROGRAM_ONLY", "UNVERIFIED"] as const) {
    const bound = bindAcademicSource(document, { ...source, status });
    assert.equal(bound.academicSource?.status, status);
    assert.equal(bound.academicSource?.examScope, "UNCONFIRMED");
    assert.equal(bound.provenance?.artifactRole, "DERIVED");
    assert.equal("mastery" in bound, false);
  }
});

test("company and unknown classifications fail closed before import", () => {
  for (const dataClassification of ["COMPANY_INTERNAL", "COMPANY_RESTRICTED", "UNKNOWN"] as const) {
    const denied = { ...source, dataClassification };
    assert.equal(sourceImportAllowed(denied), false);
    assert.throws(() => bindAcademicSource(document, denied), /Classification/);
  }
});
