/**
 * Practice done with a local agent (Hermes through the ELOS MCP server), handed back to
 * the app as a per-chapter summary next to the learner snapshot.
 *
 * DERIVED_PRACTICE by design: questions answered through an agent are assisted and
 * generated, so this summary is shown as practice and never changes a mastery state.
 * It holds counts only: no question text, answer or course passage.
 */

export const AGENT_PRACTICE_FORMAT = "engineer-learning-os/agent-practice";
export const AGENT_PRACTICE_VERSION = 1;
export const AGENT_PRACTICE_FILE = "elos-practice.json";

export type PracticeAttempt = Readonly<{ at: string; chapterId: string; questionId: string; correct: boolean }>;
export type ChapterLabel = Readonly<{ id: string; title: string; subject: string }>;

export type AgentPracticeChapter = Readonly<{
  chapterId: string;
  title: string;
  subject: string;
  answered: number;
  correct: number;
  /** Questions whose latest answer was wrong: what the agent will ask again first. */
  toRetry: number;
  lastAt: string;
}>;

export type AgentPractice = Readonly<{
  format: typeof AGENT_PRACTICE_FORMAT;
  version: typeof AGENT_PRACTICE_VERSION;
  generatedAt: string;
  evidence: "DERIVED_PRACTICE";
  chapters: readonly AgentPracticeChapter[];
}>;

export function buildAgentPractice(attempts: readonly PracticeAttempt[], chapters: readonly ChapterLabel[], now: Date): AgentPractice {
  const labels = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const byChapter = new Map<string, PracticeAttempt[]>();
  for (const attempt of [...attempts].sort((a, b) => a.at.localeCompare(b.at))) {
    byChapter.set(attempt.chapterId, [...(byChapter.get(attempt.chapterId) ?? []), attempt]);
  }
  return {
    format: AGENT_PRACTICE_FORMAT, version: AGENT_PRACTICE_VERSION, generatedAt: now.toISOString(), evidence: "DERIVED_PRACTICE",
    chapters: [...byChapter].map(([chapterId, list]) => {
      const latest = new Map(list.map((attempt) => [attempt.questionId, attempt.correct]));
      return {
        chapterId, title: labels.get(chapterId)?.title ?? chapterId, subject: labels.get(chapterId)?.subject ?? "",
        answered: list.length, correct: list.filter((attempt) => attempt.correct).length,
        toRetry: [...latest.values()].filter((correct) => !correct).length, lastAt: list[list.length - 1].at,
      };
    }).sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
  };
}

const count = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 0;

/** Strict validation for the app: an unknown or damaged file is rejected, never partially trusted. */
export function parseAgentPractice(text: string): AgentPractice {
  const value = JSON.parse(text) as Partial<AgentPractice>;
  const valid = value?.format === AGENT_PRACTICE_FORMAT && value.version === AGENT_PRACTICE_VERSION && value.evidence === "DERIVED_PRACTICE"
    && typeof value.generatedAt === "string" && Array.isArray(value.chapters)
    && value.chapters.every((chapter) => typeof chapter?.chapterId === "string" && typeof chapter.title === "string" && typeof chapter.subject === "string"
      && count(chapter.answered) && count(chapter.correct) && count(chapter.toRetry) && chapter.correct <= chapter.answered && typeof chapter.lastAt === "string");
  if (!valid) throw new Error("INVALID_AGENT_PRACTICE");
  return value as AgentPractice;
}
