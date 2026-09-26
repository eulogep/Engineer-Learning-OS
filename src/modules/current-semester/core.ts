import type {
  SemesterBacklogItem,
  SemesterCourse,
  SemesterEvidenceSignals,
  SemesterRecommendation,
  SemesterStateRevision,
} from "./types";

const PLATEAU_PRIORITY_BANDS = { P0: 400, P1: 300, P2: 200, P3: 100 } as const;

export function appendSemesterRevision(
  history: readonly SemesterStateRevision[],
  incoming: SemesterStateRevision,
): readonly SemesterStateRevision[] {
  const latest = history.at(-1);
  if (latest && (incoming.semesterId !== latest.semesterId || incoming.revision !== latest.revision + 1
    || incoming.updatedAt < latest.updatedAt)) throw new Error("INVALID_SEMESTER_REVISION");
  if (!Number.isInteger(incoming.revision) || incoming.revision < 1) throw new Error("INVALID_SEMESTER_REVISION");
  return Object.freeze([...history, incoming]);
}

export function currentCourseConceptIds(course: SemesterCourse): readonly string[] {
  return Object.freeze(course.concepts.filter((concept) => concept.scope === "CURRENT_COURSE").map((concept) => concept.id));
}

export function programmeOnlyConceptIds(course: SemesterCourse): readonly string[] {
  return Object.freeze(course.concepts.filter((concept) => concept.scope === "PROGRAM_SCOPE_ONLY").map((concept) => concept.id));
}

export function declaredBaselineClaims(state: SemesterStateRevision) {
  return Object.freeze(state.courses.flatMap((course) => course.concepts
    .filter((concept) => concept.baselineClaim !== null)
    .map((concept) => Object.freeze({ courseId: course.id, conceptId: concept.id, claim: concept.baselineClaim,
      provenance: concept.provenance }))));
}

function backlogIsSchedulable(course: SemesterCourse, item: SemesterBacklogItem): boolean {
  if (item.kind === "SOURCE_COLLECTION" || item.kind === "PROJECT" || item.kind === "COMMUNICATION") return true;
  const current = new Set(currentCourseConceptIds(course));
  return item.conceptIds.length > 0 && item.conceptIds.every((conceptId) => current.has(conceptId));
}

function deadlineScore(examDate: string | null, now: number): Readonly<{ score: number; reason: string | null }> {
  if (!examDate) return { score: 0, reason: null };
  const remainingDays = Math.ceil((new Date(`${examDate}T23:59:59+02:00`).getTime() - now) / 86_400_000);
  if (remainingDays < 0) return { score: 0, reason: "EXAM_DATE_PASSED" };
  if (remainingDays <= 2) return { score: 160, reason: "EXAM_WITHIN_2_DAYS" };
  if (remainingDays <= 7) return { score: 100, reason: "EXAM_WITHIN_7_DAYS" };
  if (remainingDays <= 21) return { score: 50, reason: "EXAM_WITHIN_21_DAYS" };
  return { score: 10, reason: "EXAM_SCHEDULED" };
}

export function selectSemesterRecommendations(
  state: SemesterStateRevision,
  input: Readonly<{ now: number; signals: SemesterEvidenceSignals }>,
): readonly SemesterRecommendation[] {
  const due = new Set(input.signals.retrievalDueConceptIds);
  const errors = new Set(input.signals.recentErrorConceptIds);
  const assistance = new Set(input.signals.assistanceDependentConceptIds);
  const transfer = new Set(input.signals.transferGapConceptIds);
  const recommendations: SemesterRecommendation[] = [];
  for (const course of state.courses) {
    const deadline = deadlineScore(course.examDate, input.now);
    for (const item of course.backlog.filter((candidate) => backlogIsSchedulable(course, candidate))) {
      const reasons = [`COURSE_PRIORITY_${course.priority}`];
      let score = PLATEAU_PRIORITY_BANDS[course.priority] + deadline.score;
      if (deadline.reason) reasons.push(deadline.reason);
      if (item.conceptIds.some((id) => due.has(id))) { score += 200; reasons.push("RETRIEVAL_DUE"); }
      if (item.conceptIds.some((id) => errors.has(id))) { score += 160; reasons.push("RECENT_ERROR"); }
      if (item.conceptIds.some((id) => assistance.has(id))) { score += 100; reasons.push("ASSISTANCE_DEPENDENCE"); }
      if (item.conceptIds.some((id) => transfer.has(id))) { score += 80; reasons.push("TRANSFER_GAP"); }
      recommendations.push(Object.freeze({ courseId: course.id, backlogItemId: item.id, score,
        reasonCodes: Object.freeze(reasons) }));
    }
  }
  return Object.freeze(recommendations.sort((left, right) => right.score - left.score
    || left.courseId.localeCompare(right.courseId) || left.backlogItemId.localeCompare(right.backlogItemId)));
}
