import { deriveQuiz } from "./core";
import type { Confidence, QuizQuestion, StudioDocument, StudioQuizAttempt } from "./types";

/**
 * Mock exam: timed, no hints, no citations until the end, questions interleaved
 * across documents (SCI-004) and a confidence rating per answer (SCI-002).
 * The result is DERIVED practice; it never grants a competency state.
 */

export type MockExam = Readonly<{ id: string; createdAt: string; durationSeconds: number; questions: readonly QuizQuestion[] }>;

export const SECONDS_PER_QUESTION = 60;

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Round-robin across documents so that consecutive questions come from different courses. */
export function buildMockExam(documents: readonly StudioDocument[], count: number, seed: number, now: Date): MockExam {
  const random = seededRandom(seed);
  const pool = deriveQuiz(documents, Number.MAX_SAFE_INTEGER);
  const byDocument = new Map<string, QuizQuestion[]>();
  for (const question of pool) {
    const documentId = question.citations[0].documentId;
    byDocument.set(documentId, [...(byDocument.get(documentId) ?? []), question]);
  }
  const queues = [...byDocument.values()].map((questions) => shuffle(questions, random));
  const interleaved: QuizQuestion[] = [];
  for (let round = 0; interleaved.length < count && queues.some((queue) => queue.length > round); round += 1) {
    for (const queue of queues) if (queue[round] && interleaved.length < count) interleaved.push(queue[round]);
  }
  const questions = interleaved.map((question) => ({ ...question, choices: shuffle(question.choices, random) }));
  return { id: `exam:${seed}`, createdAt: now.toISOString(), durationSeconds: questions.length * SECONDS_PER_QUESTION, questions };
}

export type CalibrationRow = Readonly<{ confidence: Confidence; correct: number; total: number }>;
export type MockExamResult = Readonly<{
  attempt: StudioQuizAttempt;
  score: number;
  total: number;
  unanswered: number;
  timedOut: boolean;
  calibration: readonly CalibrationRow[];
  /** Answers marked "sure" that were wrong: the most useful signal for revision. */
  overconfident: readonly string[];
}>;

export function gradeMockExam(
  exam: MockExam,
  answers: Readonly<Record<string, string>>,
  confidences: Readonly<Record<string, Confidence>>,
  startedAt: Date,
  submittedAt: Date,
): MockExamResult {
  const elapsed = Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000);
  const items = exam.questions.map((question) => ({
    questionId: question.id, cardId: question.cardId,
    correct: answers[question.id] === question.answer,
    confidence: confidences[question.id] ?? "GUESS",
  }));
  const calibration = (["SURE", "UNSURE", "GUESS"] as const).map((confidence) => {
    const rows = items.filter((item) => item.confidence === confidence);
    return { confidence, correct: rows.filter((item) => item.correct).length, total: rows.length };
  });
  return {
    attempt: {
      id: `${exam.id}:${submittedAt.getTime()}`, at: submittedAt.toISOString(), evidenceKind: "DERIVED_PRACTICE", canonical: false,
      assisted: false, mode: "MOCK_EXAM", durationSeconds: elapsed, items,
    },
    score: items.filter((item) => item.correct).length,
    total: items.length,
    unanswered: exam.questions.filter((question) => !answers[question.id]).length,
    timedOut: elapsed > exam.durationSeconds,
    calibration,
    overconfident: exam.questions.filter((question, index) => items[index].confidence === "SURE" && !items[index].correct).map((question) => question.answer),
  };
}
