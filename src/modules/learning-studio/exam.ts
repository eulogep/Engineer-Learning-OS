import { deriveQuiz, deriveFlashcards, allPassages, citationFor } from "./core";
import type { Confidence, QuizQuestion, StudioDocument, StudioQuizAttempt } from "./types";

/**
 * Mock exam: timed, no hints, no citations until the end, questions interleaved
 * across documents (SCI-004) and a confidence rating per answer (SCI-002).
 * The result is DERIVED practice; it never grants a competency state.
 */

export type ExamQuestion = QuizQuestion & Readonly<{ responseType?: "MULTIPLE_CHOICE" | "OPEN_RESPONSE" }>;
export type MockExam = Readonly<{ id: string; createdAt: string; durationSeconds: number; questions: readonly ExamQuestion[] }>;
export type ExamOptions = Readonly<{ durationSeconds?: number; includeOpenResponses?: boolean }>;

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
export function buildMockExam(documents: readonly StudioDocument[], count: number, seed: number, now: Date, options: ExamOptions = {}): MockExam {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("INVALID_EXAM_COUNT");
  if (options.durationSeconds !== undefined && (!Number.isInteger(options.durationSeconds) || options.durationSeconds < 60 || options.durationSeconds > 10800)) throw new Error("INVALID_EXAM_DURATION");
  const random = seededRandom(seed);
  const technical: ExamQuestion[] = options.includeOpenResponses ? allPassages(documents).flatMap(({ document, page, passage }) => {
    const sql = /\b(?:SELECT\s+.+\s+FROM|CREATE\s+TABLE|INSERT\s+INTO)\b/i.test(passage.text);
    const php = /<\?php|\$_(?:POST|SESSION)\s*\[|\b(?:mysqli_query|session_start)\s*\(/.test(passage.text);
    if (!sql && !php) return [];
    return [{ id: `technical:${document.id}:${page.pageNumber}:${passage.id}`, cardId: `technical:${document.id}:${passage.id}`,
      responseType: "OPEN_RESPONSE" as const,
      prompt: `${sql ? "SQL : décris les opérations, les données et contraintes concernées. Précise les résultats attendus et les informations manquantes pour les déterminer." : "WEB : trace le flux des données, les entrées, les opérations serveur et les effets sur la session ou la base. Identifie les informations manquantes."}\n\nExtrait à analyser :\n${passage.text}\n\nSignale une erreur uniquement si tu peux la justifier ; propose alors une correction.`,
      choices: [], answer: passage.text, materialKind: "DERIVED_MATERIAL" as const, canonical: false as const,
      citations: [citationFor(document, page.pageNumber, passage.id, passage.text)] }];
  }) : [];
  const pool: ExamQuestion[] = [...technical, ...deriveQuiz(documents, Number.MAX_SAFE_INTEGER)];
  const byDocument = new Map<string, ExamQuestion[]>();
  for (const question of pool) {
    const documentId = question.citations[0].documentId;
    byDocument.set(documentId, [...(byDocument.get(documentId) ?? []), question]);
  }
  const queues = [...byDocument.values()].map((questions) => shuffle(questions, random));
  const interleaved: ExamQuestion[] = [];
  for (let round = 0; interleaved.length < count && queues.some((queue) => queue.length > round); round += 1) {
    for (const queue of queues) if (queue[round] && interleaved.length < count) interleaved.push(queue[round]);
  }
  const cards = options.includeOpenResponses ? deriveFlashcards(documents) : [];
  const questions: ExamQuestion[] = interleaved.map((question, index) => {
    if (question.responseType === "OPEN_RESPONSE") return question;
    const card = cards.find((item) => item.id === question.cardId);
    if (card && index % 2 === 0) return { ...question, responseType: "OPEN_RESPONSE",
      prompt: `Explique « ${card.term} » avec tes propres mots, puis propose un exemple d’application et justifie-le.`, choices: [],
      answer: card.definition };
    return { ...question, responseType: "MULTIPLE_CHOICE", choices: shuffle(question.choices, random) };
  });
  return { id: `exam:${seed}`, createdAt: now.toISOString(), durationSeconds: options.durationSeconds ?? questions.length * SECONDS_PER_QUESTION, questions };
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
  pending: number;
}>;

export function gradeMockExam(
  exam: MockExam,
  answers: Readonly<Record<string, string>>,
  confidences: Readonly<Record<string, Confidence>>,
  startedAt: Date,
  submittedAt: Date,
): MockExamResult {
  const elapsed = Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000);
  if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error("INVALID_EXAM_TIMESTAMPS");
  const autoQuestions = exam.questions.filter((question) => question.responseType !== "OPEN_RESPONSE");
  const pendingResponses = exam.questions.filter((question) => question.responseType === "OPEN_RESPONSE").map((question) => ({
    questionId: question.id, prompt: question.prompt, response: answers[question.id] ?? "", citations: question.citations,
    status: "PENDING_HUMAN_VALIDATION" as const, confidence: confidences[question.id] ?? "GUESS",
  }));
  const items = autoQuestions.map((question) => ({
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
      assisted: false, mode: "MOCK_EXAM", durationSeconds: elapsed, items, pendingResponses,
    },
    score: items.filter((item) => item.correct).length,
    total: items.length,
    unanswered: exam.questions.filter((question) => !answers[question.id]?.trim()).length,
    timedOut: elapsed >= exam.durationSeconds,
    calibration,
    overconfident: autoQuestions.filter((question, index) => items[index].confidence === "SURE" && !items[index].correct).map((question) => question.answer),
    pending: pendingResponses.length,
  };
}
