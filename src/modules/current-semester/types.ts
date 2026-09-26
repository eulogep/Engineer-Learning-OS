export type SemesterPriority = "P0" | "P1" | "P2" | "P3";
export type CurrentCourseState = "CONFIRMED" | "PARTIAL" | "SOURCE_COLLECTION_NEEDED";
export type ConceptScope = "CURRENT_COURSE" | "PROGRAM_SCOPE_ONLY";
export type ExamScope = "CONFIRMED" | "PROBABLE" | "UNCONFIRMED" | "NOT_APPLICABLE";
export type BaselineClaim = "DECLARED_STABLE" | "DECLARED_CONSOLIDATE" | "DECLARED_NOT_MASTERED" | "DECLARED_TEST";

export type SemesterProvenance = Readonly<{
  sourceId: "CURRENT_SEMESTER_STATE_2026_2027";
  sourceReference: "CURRENT_SEMESTER_STATE.md";
  sourceUpdatedAt: "2026-09-14";
}>;

export type SemesterConcept = Readonly<{
  id: string;
  label: string;
  scope: ConceptScope;
  examScope: ExamScope;
  baselineClaim: BaselineClaim | null;
  provenance: SemesterProvenance;
}>;

export type SemesterBacklogItem = Readonly<{
  id: string;
  label: string;
  kind: "PRACTICE" | "ASSESSMENT" | "PROJECT" | "COMMUNICATION" | "SOURCE_COLLECTION";
  conceptIds: readonly string[];
  provenance: SemesterProvenance;
}>;

export type SemesterCourse = Readonly<{
  id: string;
  slug: string;
  title: string;
  professor: string;
  priority: SemesterPriority;
  currentCourseState: CurrentCourseState;
  examDate: string | null;
  examNotes: readonly string[];
  context: string | null;
  tracks: readonly string[];
  preferredPracticeModes: readonly string[];
  concepts: readonly SemesterConcept[];
  backlog: readonly SemesterBacklogItem[];
  provenance: SemesterProvenance;
}>;

export type SemesterStateRevision = Readonly<{
  semesterId: "LICENCE_PRO_RESEAUX_CYBERSECURITE_2026_2027";
  revision: number;
  status: "ACTIVE";
  updatedAt: string;
  source: SemesterProvenance;
  courses: readonly SemesterCourse[];
}>;

export type SemesterEvidenceSignals = Readonly<{
  retrievalDueConceptIds: readonly string[];
  recentErrorConceptIds: readonly string[];
  assistanceDependentConceptIds: readonly string[];
  transferGapConceptIds: readonly string[];
}>;

export type SemesterRecommendation = Readonly<{
  courseId: string;
  backlogItemId: string;
  score: number;
  reasonCodes: readonly string[];
}>;

export type SemesterExamMode = Readonly<{
  id: "WEB_EXAM_MODE" | "SQL_EXAM_MODE";
  courseId: string;
  title: string;
  activityTypes: readonly string[];
  conceptIds: readonly string[];
  evidencePolicy: "REUSE_CANONICAL_ELOS_HISTORY";
  masteryPolicy: "EVIDENCE_REQUIRED";
  provenance: SemesterProvenance;
}>;
