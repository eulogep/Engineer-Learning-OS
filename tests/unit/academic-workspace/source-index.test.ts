import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { academicSourceIndex, currentSemesterBaselineSource, missingLocalSources, sourcesForSemesterCourse, validateAcademicSourceIndex } from "../../../src/modules/academic-workspace/source-index.ts";

describe("local academic source index", () => {
  it("validates the supplied source registry without duplicate identities", () => {
    assert.equal(validateAcademicSourceIndex(academicSourceIndex), true);
    assert.equal(academicSourceIndex.sources.length, 5);
    assert.equal(new Set(academicSourceIndex.sources.map((source) => source.id)).size, 5);
  });

  it("keeps the semester baseline non-canonical and separate from mastery", () => {
    assert.ok(currentSemesterBaselineSource);
    assert.equal(currentSemesterBaselineSource.status, "CURRENT_PRIMARY");
    assert.equal(currentSemesterBaselineSource.canonical, false);
    assert.equal("mastery" in currentSemesterBaselineSource, false);
    assert.equal(academicSourceIndex.provenancePolicy.masteryFromSourcePresence, false);
  });

  it("keeps the official programme in programme scope", () => {
    const programme = academicSourceIndex.sources.find((source) => source.id === "lprc-program");
    assert.ok(programme);
    assert.equal(programme.status, "PROGRAM_ONLY");
    assert.notEqual(programme.status, "CURRENT_PRIMARY");
  });

  it("marks every original and keeps derived material separate", () => {
    assert.equal(academicSourceIndex.sources.every((source) => source.provenanceRole === "ORIGINAL_SOURCE"), true);
    assert.equal(academicSourceIndex.provenancePolicy.derivedArtifactRole, "DERIVED");
    assert.equal(academicSourceIndex.provenancePolicy.derivedDirectory, "knowledge/.derived");
  });

  it("isolates professional company context from Git", () => {
    const professional = academicSourceIndex.sources.find((source) => source.course === "PROFESSIONAL");
    assert.ok(professional);
    assert.equal(professional.path.startsWith("knowledge-private/"), true);
    assert.equal(professional.dataClassification, "COMPANY_INTERNAL");
    assert.equal(professional.repositoryVisibility, "LOCAL_ONLY");
  });

  it("links the library to semester courses without changing classifications", () => {
    const web = sourcesForSemesterCourse("COURSE_WEB_DATABASE");
    assert.deepEqual(web.map((source) => source.status), ["CURRENT_PRIMARY", "PROGRAM_ONLY"]);
    const english = sourcesForSemesterCourse("COURSE_ENGLISH");
    assert.equal(english.some((source) => source.id === "english-app-research"), true);
    assert.equal(english.some((source) => source.id === "daily-english-project-memory"), true);
  });

  it("preserves known missing sources instead of fabricating them", () => {
    assert.equal(missingLocalSources.length, 3);
    assert.equal(missingLocalSources.some((source) => source.includes("example-calendar.pdf")), true);
  });
});
