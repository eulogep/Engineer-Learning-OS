import { dayKey, localProgressSummary, localWordId, type KeyValueStorage as DailyStorage, type LocalMissionState } from "../daily-english/local-mission";
import { VOCABULARY } from "../daily-english/vocabulary";
import { difficulties, revisionPlan, studioReviewEvents, type StudioState } from "../learning-studio/core";
import type { Flashcard } from "../learning-studio/types";
import { replaySchedulers } from "../scientific-pedagogy/replay";

/**
 * Learner snapshot for local agents (e.g. Hermes through the ELOS MCP server).
 *
 * Minimal by design: what is due, what is difficult, upcoming exams and streak.
 * It never contains personal sentences, transcriptions, notes, answers or source
 * passages, and it is read-only for the agent: nothing in it can grant mastery.
 */

export const SNAPSHOT_FORMAT = "engineer-learning-os/learner-snapshot";
export const SNAPSHOT_VERSION = 1;
const MAX_ITEMS = 30;

export type ExamInput = Readonly<{ course: string; date: string | null; priority: string }>;

export type LearnerSnapshot = Readonly<{
  format: typeof SNAPSHOT_FORMAT;
  version: typeof SNAPSHOT_VERSION;
  generatedAt: string;
  today: string;
  dailyEnglish: Readonly<{
    streak: number;
    wordsSeen: number;
    wordsMastered: number;
    totalWords: number;
    todayMission: Readonly<{ words: readonly string[]; completed: boolean }> | null;
    dueWords: readonly Readonly<{ word: string; translation: string; due: string }>[];
  }>;
  studio: Readonly<{
    scheduler: "CURRENT_V1" | "FSRS_4_5";
    dueToday: readonly Readonly<{ term: string; source: string }>[];
    next7Days: readonly Readonly<{ day: string; cards: number }>[];
    difficulties: readonly Readonly<{ term: string; errors: number; attempts: number }>[];
    schedulerReplay: Readonly<{ predictions: number; enough: boolean; logLoss: Readonly<Record<string, number>> }>;
  }>;
  exams: readonly Readonly<{ course: string; date: string; priority: string; daysLeft: number }>[];
  privacy: Readonly<{ excludes: readonly string[] }>;
}>;

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function buildLearnerSnapshot(input: Readonly<{
  dailyEnglish: LocalMissionState;
  dailyStorage: DailyStorage | null;
  studio: StudioState;
  cards: readonly Flashcard[];
  documentTitles: Readonly<Record<string, string>>;
  exams: readonly ExamInput[];
  now: Date;
}>): LearnerSnapshot {
  const today = dayKey(input.now);
  const vocabulary = new Map(VOCABULARY.map((entry) => [localWordId(entry.word), entry]));
  const summary = localProgressSummary(input.dailyStorage, input.now);
  const mission = input.dailyEnglish.missions.find((item) => String(item.date).startsWith(today)) ?? null;
  const missionWords = mission ? (JSON.parse(mission.wordIdsJson) as string[]).map((id) => vocabulary.get(id)?.word).filter((word): word is string => !!word) : [];

  const dueWords = Object.entries(input.dailyEnglish.reviews)
    .filter(([, review]) => review.nextReviewDay !== null && review.nextReviewDay <= today)
    .sort((a, b) => String(a[1].nextReviewDay).localeCompare(String(b[1].nextReviewDay)))
    .slice(0, MAX_ITEMS)
    .flatMap(([id, review]) => { const entry = vocabulary.get(id); return entry ? [{ word: entry.word, translation: entry.translation, due: review.nextReviewDay as string }] : []; });

  const plan = revisionPlan(input.cards.map((card) => card.id), input.studio.reviews, today);
  const byId = new Map(input.cards.map((card) => [card.id, card]));
  const replay = replaySchedulers(studioReviewEvents(input.studio));

  return {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    generatedAt: input.now.toISOString(),
    today,
    dailyEnglish: {
      streak: summary.streak, wordsSeen: summary.seen, wordsMastered: summary.mastered, totalWords: summary.total,
      todayMission: mission ? { words: missionWords, completed: mission.completed } : null,
      dueWords,
    },
    studio: {
      scheduler: input.studio.scheduler ?? "CURRENT_V1",
      dueToday: (plan[0]?.due ?? []).slice(0, MAX_ITEMS).flatMap((id) => {
        const card = byId.get(id);
        return card ? [{ term: card.term, source: input.documentTitles[card.documentId] ?? card.documentId }] : [];
      }),
      next7Days: plan.slice(1).map((entry) => ({ day: entry.day, cards: entry.due.length })),
      difficulties: difficulties(input.studio.attempts, input.cards).slice(0, 10),
      schedulerReplay: { predictions: replay.predictions, enough: replay.enough, logLoss: Object.fromEntries(replay.scores.map((score) => [score.scheduler, score.logLoss])) },
    },
    exams: input.exams
      .filter((exam): exam is ExamInput & { date: string } => !!exam.date && exam.date >= today)
      .map((exam) => ({ course: exam.course, date: exam.date, priority: exam.priority, daysLeft: daysBetween(today, exam.date) }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    privacy: { excludes: ["personal sentences", "speech transcriptions", "notes and annotations", "answers", "source passages", "audio"] },
  };
}

/** Strict validation for readers (the MCP server): unknown or damaged files are rejected. */
export function parseLearnerSnapshot(text: string): LearnerSnapshot {
  const value = JSON.parse(text) as Partial<LearnerSnapshot>;
  if (value?.format !== SNAPSHOT_FORMAT || value.version !== SNAPSHOT_VERSION || typeof value.generatedAt !== "string"
    || typeof value.today !== "string" || !value.dailyEnglish || !value.studio || !Array.isArray(value.exams)) {
    throw new Error("INVALID_LEARNER_SNAPSHOT");
  }
  return value as LearnerSnapshot;
}

