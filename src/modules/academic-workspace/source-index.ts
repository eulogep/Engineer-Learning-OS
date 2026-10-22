import indexJson from "../../../knowledge/index.json" with { type: "json" };
import type { AcademicSourceIndex, AcademicSourceIndexEntry } from "./types";
import { validateAcademicSourceIndex } from "./source-index-validation";
export { validateAcademicSourceIndex } from "./source-index-validation";

const COURSE_KEYS: Readonly<Record<string, string>> = Object.freeze({
  COURSE_WEB_DATABASE: "WEB",
  COURSE_SQL_DATABASE: "SQL",
  COURSE_NETWORK_ARCHITECTURE: "NETWORKS",
  COURSE_SYSTEM_ADMIN: "SYSTEM_ADMINISTRATION",
  COURSE_PROJECT_MANAGEMENT: "PROJECT_MANAGEMENT",
  COURSE_COMMUNICATION: "COMMUNICATION",
  COURSE_ENGLISH: "ENGLISH",
});

const parsedIndex: unknown = indexJson;
if (!validateAcademicSourceIndex(parsedIndex)) throw new Error("INVALID_ACADEMIC_SOURCE_INDEX");

export const academicSourceIndex: AcademicSourceIndex = Object.freeze({
  ...parsedIndex,
  provenancePolicy: Object.freeze({ ...parsedIndex.provenancePolicy }),
  sources: Object.freeze(parsedIndex.sources.map((source) => Object.freeze({ ...source }))),
  missingButKnownInChatGPT: Object.freeze([...parsedIndex.missingButKnownInChatGPT]),
});

export const currentSemesterBaselineSource = academicSourceIndex.sources.find((source) => source.type === "SEMESTER_STATE" && source.status === "CURRENT_PRIMARY") ?? null;
export const missingLocalSources = academicSourceIndex.missingButKnownInChatGPT;

export function sourcesForSemesterCourse(courseId: string): readonly AcademicSourceIndexEntry[] {
  const courseKey = COURSE_KEYS[courseId];
  return Object.freeze(academicSourceIndex.sources.filter((source) => source.course === "CROSS_COURSE" || source.course === courseKey));
}
