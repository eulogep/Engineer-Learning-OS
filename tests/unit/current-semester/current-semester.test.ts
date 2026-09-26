import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { appendSemesterRevision, currentCourseConceptIds, declaredBaselineClaims, programmeOnlyConceptIds, selectSemesterRecommendations } from "../../../src/modules/current-semester/core.ts";
import { CURRENT_SEMESTER_HISTORY, CURRENT_SEMESTER_PROVENANCE, CURRENT_SEMESTER_STATE, SEMESTER_EXAM_MODES } from "../../../src/modules/current-semester/registry.ts";
import type { SemesterStateRevision } from "../../../src/modules/current-semester/types.ts";

const emptySignals = { retrievalDueConceptIds: [], recentErrorConceptIds: [], assistanceDependentConceptIds: [], transferGapConceptIds: [] } as const;
const byId = (id: string) => {
  const course = CURRENT_SEMESTER_STATE.courses.find((candidate) => candidate.id === id);
  assert.ok(course);
  return course;
};

describe("current semester academic state", () => {
  it("records the seven current courses with their professor and priority", () => {
    assert.deepEqual(CURRENT_SEMESTER_STATE.courses.map(({ title, professor, priority }) => ({ title, professor, priority })), [
      { title: "Base de données WEB", professor: "Enseignant exemple", priority: "P0" },
      { title: "Base de données SQL", professor: "Enseignant exemple", priority: "P1" },
      { title: "Architecture des Réseaux", professor: "Enseignant exemple", priority: "P2" },
      { title: "Administration des systèmes", professor: "Enseignant exemple", priority: "P2" },
      { title: "Gestion de Projet", professor: "Enseignant exemple", priority: "P3" },
      { title: "Communication", professor: "Enseignant exemple", priority: "P3" },
      { title: "Anglais", professor: "Enseignant exemple", priority: "P3" },
    ]);
  });

  it("keeps programme scope separate from the current network course", () => {
    const network = byId("COURSE_NETWORK_ARCHITECTURE");
    const current = currentCourseConceptIds(network);
    const programme = programmeOnlyConceptIds(network);
    assert.deepEqual(current, ["NETWORK_OSI", "NETWORK_TCP_IP", "NETWORK_ENCAPSULATION", "NETWORK_LAYER_RESPONSIBILITIES"]);
    for (const id of ["NETWORK_PROGRAM_VLAN", "NETWORK_PROGRAM_STP", "NETWORK_PROGRAM_OSPF", "NETWORK_PROGRAM_BGP", "NETWORK_PROGRAM_EIGRP"]) assert.ok(programme.includes(id));
    assert.equal(current.some((id) => programme.includes(id)), false);
  });

  it("does not turn current-course declarations into canonical mastery", () => {
    const claims = declaredBaselineClaims(CURRENT_SEMESTER_STATE);
    assert.ok(claims.length > 0);
    assert.equal(claims.every((claim) => claim.claim?.startsWith("DECLARED_")), true);
    assert.doesNotMatch(JSON.stringify(claims), /PRACTICED|DEMONSTRATED|RETAINED|ERROR_OBSERVED|EventId/);
  });

  it("never schedules unconfirmed programme-only concepts", () => {
    const recommendations = selectSemesterRecommendations(CURRENT_SEMESTER_STATE, { now: new Date("2027-01-10T12:00:00+01:00").getTime(), signals: emptySignals });
    for (const course of CURRENT_SEMESTER_STATE.courses) {
      for (const recommendation of recommendations.filter((item) => item.courseId === course.id)) {
        const item = course.backlog.find((candidate) => candidate.id === recommendation.backlogItemId);
        assert.ok(item);
        if (item.kind === "PRACTICE" || item.kind === "ASSESSMENT") assert.equal(item.conceptIds.every((id) => !programmeOnlyConceptIds(course).includes(id)), true);
      }
    }
  });

  it("uses deadlines as an ordering signal", () => {
    const recommendations = selectSemesterRecommendations(CURRENT_SEMESTER_STATE, { now: new Date("2027-01-10T12:00:00+01:00").getTime(), signals: emptySignals });
    assert.equal(recommendations[0].courseId, "COURSE_WEB_DATABASE");
    assert.ok(recommendations[0].reasonCodes.includes("EXAM_WITHIN_2_DAYS"));
  });

  it("lets canonical evidence signals change the recommendation order", () => {
    const signals = { retrievalDueConceptIds: ["SQL_CARDINALITY"], recentErrorConceptIds: ["SQL_CARDINALITY"], assistanceDependentConceptIds: ["SQL_CARDINALITY"], transferGapConceptIds: ["SQL_CARDINALITY"] };
    const recommendations = selectSemesterRecommendations(CURRENT_SEMESTER_STATE, { now: new Date("2027-01-10T12:00:00+01:00").getTime(), signals });
    assert.equal(recommendations[0].courseId, "COURSE_SQL_DATABASE");
    assert.equal(recommendations[0].backlogItemId, "SQL_CARDINALITY_DRILLS");
    for (const reason of ["RETRIEVAL_DUE", "RECENT_ERROR", "ASSISTANCE_DEPENDENCE", "TRANSFER_GAP"]) assert.ok(recommendations[0].reasonCodes.includes(reason));
  });

  it("reuses canonical history for exam modes and still requires evidence", () => {
    assert.equal(SEMESTER_EXAM_MODES.length, 2);
    for (const mode of SEMESTER_EXAM_MODES) {
      assert.equal(mode.evidencePolicy, "REUSE_CANONICAL_ELOS_HISTORY");
      assert.equal(mode.masteryPolicy, "EVIDENCE_REQUIRED");
    }
  });

  it("updates the registry additively with ordered revisions", () => {
    const revision2: SemesterStateRevision = { ...CURRENT_SEMESTER_STATE, revision: 2, updatedAt: "2027-01-10" };
    const updated = appendSemesterRevision(CURRENT_SEMESTER_HISTORY, revision2);
    assert.equal(updated.length, 2);
    assert.equal(updated[0], CURRENT_SEMESTER_STATE);
    assert.equal(updated[1], revision2);
    assert.throws(() => appendSemesterRevision(updated, revision2), /INVALID_SEMESTER_REVISION/);
  });

  it("attaches source provenance to every imported record", () => {
    assert.deepEqual(CURRENT_SEMESTER_STATE.source, CURRENT_SEMESTER_PROVENANCE);
    for (const course of CURRENT_SEMESTER_STATE.courses) {
      assert.deepEqual(course.provenance, CURRENT_SEMESTER_PROVENANCE);
      assert.equal(course.concepts.every((concept) => concept.provenance === CURRENT_SEMESTER_PROVENANCE), true);
      assert.equal(course.backlog.every((item) => item.provenance === CURRENT_SEMESTER_PROVENANCE), true);
    }
  });

  it("requires source collection for system administration", () => {
    const system = byId("COURSE_SYSTEM_ADMIN");
    assert.equal(system.currentCourseState, "SOURCE_COLLECTION_NEEDED");
    assert.deepEqual(currentCourseConceptIds(system), []);
    assert.equal(system.backlog.every((item) => item.kind === "SOURCE_COLLECTION"), true);
  });

  it("keeps advanced SQL topics unconfirmed and out of the current course", () => {
    const sql = byId("COURSE_SQL_DATABASE");
    const advanced = sql.concepts.filter((concept) => ["SQL_JOIN", "SQL_GROUP_BY", "SQL_HAVING", "SQL_ADVANCED_AGGREGATES"].includes(concept.id));
    assert.equal(advanced.every((concept) => concept.scope === "PROGRAM_SCOPE_ONLY" && concept.examScope === "UNCONFIRMED"), true);
  });

  it("preserves the three distinct English tracks", () => {
    assert.deepEqual(byId("COURSE_ENGLISH").tracks, ["GENERAL_ENGLISH", "TECHNICAL_ENGLISH", "PROFESSIONAL_PRESENTATION_ENGLISH"]);
  });
});
