import { ImportError } from "./import";

/**
 * Pedagogical base export (schema 1.0: courses.json, exercises.json, flashcards.json).
 *
 * The course map (objectives, prerequisites, examples, analogies, frequent mistakes)
 * is imported as DERIVED_MATERIAL: it is a generated synthesis, not a source, and it
 * never grants mastery. Answer keys are kept apart from the questions, and a quality
 * audit decides which generated exercises are fit for practice.
 */

export type BaseChapter = Readonly<{
  id: string;
  subject: string;
  title: string;
  summary: string;
  example: string;
  analogy: string;
  mistakes: string;
  concepts: readonly Readonly<{ label: string; definition: string }>[];
  objectives: readonly string[];
  prerequisites: readonly string[];
  exerciseIds: readonly string[];
  flashcardIds: readonly string[];
  relatedSourceIds: readonly string[];
}>;

export type BaseExercise = Readonly<{
  id: string;
  chapterId: string;
  type: string;
  difficulty: string;
  prompt: string;
  options: readonly string[];
  sourceIds: readonly string[];
}>;

export type BaseAnswer = Readonly<{ correctOption: number | null; solution: string; commonErrors: readonly string[] }>;
export type BaseFlashcard = Readonly<{ id: string; chapterId: string; front: string; back: string }>;

export type PedagogicalBase = Readonly<{
  classification: "DERIVED_MATERIAL";
  chapters: readonly BaseChapter[];
  exercises: readonly BaseExercise[];
  flashcards: readonly BaseFlashcard[];
  answerKey: ReadonlyMap<string, BaseAnswer>;
}>;

export type QualityCode =
  | "ANSWER_IN_QUESTIONS" | "LONGEST_OPTION_IS_CORRECT" | "REUSED_DISTRACTORS" | "TEMPLATE_PROMPTS"
  | "DUPLICATE_DEFINITIONS" | "DUPLICATE_FLASHCARD_BACKS" | "UNSOURCED_EXERCISES" | "BROKEN_LINKS" | "MISSING_ANSWERS";

export type QualityFinding = Readonly<{ code: QualityCode; severity: "BLOCKING" | "WARNING"; count: number; total: number; message: string }>;

export type QualityReport = Readonly<{
  findings: readonly QualityFinding[];
  /** Content fit for practice; blocked content stays readable but is not used as an assessment. */
  usable: Readonly<{ courseMap: boolean; mcq: boolean; openExercises: boolean; flashcards: boolean }>;
}>;

const ANSWER_FIELDS = ["answer", "correct_option", "solution", "detailed_solution", "correct"];
const MIN_MCQ_FOR_BIAS = 5;
const BIAS_RATIO = 0.6;
const SPREAD_CHAPTERS = 3;

type Json = Record<string, unknown>;
const object = (value: unknown): Json => (value && typeof value === "object" && !Array.isArray(value) ? value as Json : {});
const array = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const texts = (value: unknown): string[] => array(value).map(text).filter(Boolean);

/**
 * Moves the answer key out of exercises.json so the folder shared with an agent holds questions only;
 * the key is stored elsewhere and read by the MCP server alone.
 */
export function splitAnswerKey(exercises: unknown): { questions: Json; answerKey: unknown[] } {
  const { answer_key: answerKey, ...questions } = object(exercises);
  return { questions, answerKey: array(answerKey) };
}

export function parsePedagogicalBase(input: Readonly<{ courses: unknown; exercises?: unknown; flashcards?: unknown; answerKey?: unknown }>): PedagogicalBase & { leakedAnswers: number } {
  const subjects = array(object(input.courses).subjects);
  if (subjects.length === 0) throw new ImportError("courses.json invalide : aucune matière (subjects) trouvée.");

  const chapters: BaseChapter[] = [];
  for (const entry of subjects) {
    const subject = text(object(object(entry).subject).name) || "Sans matière";
    for (const subjectModule of array(object(entry).modules)) {
      for (const raw of array(object(subjectModule).chapters)) {
        const chapter = object(raw);
        const lessons = array(chapter.lessons).map(object);
        const id = text(chapter.id);
        if (!id) continue;
        chapters.push({
          id, subject, title: text(chapter.title) || id, summary: text(chapter.summary), example: text(chapter.example),
          analogy: text(chapter.analogy), mistakes: text(chapter.mistakes),
          concepts: lessons.flatMap((lesson) => array(lesson.concepts).map(object))
            .map((concept) => ({ label: text(concept.label), definition: text(concept.definition) })).filter((concept) => concept.label)
            .concat(texts(chapter.concepts).map((label) => ({ label, definition: "" })))
            .filter((concept, index, all) => all.findIndex((other) => other.label === concept.label) === index),
          objectives: lessons.flatMap((lesson) => texts(lesson.objectives)),
          prerequisites: [...new Set(lessons.flatMap((lesson) => texts(lesson.prerequisites)))],
          exerciseIds: lessons.flatMap((lesson) => texts(lesson.exercise_ids)),
          flashcardIds: lessons.flatMap((lesson) => texts(lesson.flashcard_ids)),
          relatedSourceIds: [...new Set(lessons.flatMap((lesson) => texts(lesson.source_ids)))],
        });
      }
    }
  }
  if (chapters.length === 0) throw new ImportError("courses.json invalide : aucun chapitre exploitable.");

  const exercisesFile = object(input.exercises);
  let leakedAnswers = 0;
  const exercises: BaseExercise[] = array(exercisesFile.items).map(object).flatMap((item) => {
    const id = text(item.id);
    if (!id) return [];
    if (ANSWER_FIELDS.some((field) => field in item)) leakedAnswers += 1;
    // Only whitelisted fields are kept: an answer shipped inside a question never reaches the learner.
    return [{ id, chapterId: text(item.chapter_id), type: text(item.type), difficulty: text(item.difficulty), prompt: text(item.prompt), options: texts(item.options), sourceIds: texts(item.source_ids) }];
  });

  const answerKey = new Map<string, BaseAnswer>();
  for (const raw of array(input.answerKey ?? exercisesFile.answer_key).map(object)) {
    const id = text(raw.id);
    if (!id) continue;
    const correct = object(raw.answer).correct_option;
    answerKey.set(id, { correctOption: typeof correct === "number" ? correct : null, solution: text(raw.detailed_solution), commonErrors: texts(raw.common_errors) });
  }

  const flashcards: BaseFlashcard[] = array(object(input.flashcards).items).map(object).flatMap((item) => {
    const id = text(item.id);
    return id ? [{ id, chapterId: text(item.chapter_id), front: text(item.front), back: text(item.back) }] : [];
  });

  return { classification: "DERIVED_MATERIAL", chapters, exercises, flashcards, answerKey, leakedAnswers };
}

function spreadAcrossChapters(entries: readonly (readonly [string, string])[]): { repeated: Set<string>; occurrences: number } {
  const chaptersByText = new Map<string, Set<string>>();
  for (const [chapterId, value] of entries) chaptersByText.set(value, (chaptersByText.get(value) ?? new Set()).add(chapterId));
  const repeated = new Set([...chaptersByText].filter(([, chapterIds]) => chapterIds.size >= SPREAD_CHAPTERS).map(([value]) => value));
  return { repeated, occurrences: entries.filter(([, value]) => repeated.has(value)).length };
}

export function auditPedagogicalBase(base: PedagogicalBase & { leakedAnswers?: number }): QualityReport {
  const findings: QualityFinding[] = [];
  const add = (code: QualityCode, severity: QualityFinding["severity"], count: number, total: number, message: string) => {
    if (count > 0) findings.push({ code, severity, count, total, message });
  };
  const chapterIds = new Set(base.chapters.map((chapter) => chapter.id));

  add("ANSWER_IN_QUESTIONS", "WARNING", base.leakedAnswers ?? 0, base.exercises.length, "Des questions contenaient leur réponse : elle a été retirée à l’import.");

  const mcq = base.exercises.filter((exercise) => exercise.options.length >= 2 && base.answerKey.get(exercise.id)?.correctOption != null);
  const longest = mcq.filter((exercise) => {
    const correct = base.answerKey.get(exercise.id)?.correctOption as number;
    const length = exercise.options[correct]?.length ?? 0;
    return exercise.options.every((option, index) => index === correct || option.length < length);
  }).length;
  const biased = mcq.length >= MIN_MCQ_FOR_BIAS && longest / mcq.length >= BIAS_RATIO;
  if (biased) add("LONGEST_OPTION_IS_CORRECT", "BLOCKING", longest, mcq.length, "La bonne réponse est presque toujours la plus longue : le QCM se devine sans connaître le cours.");

  const distractors = mcq.flatMap((exercise) => exercise.options
    .filter((_, index) => index !== base.answerKey.get(exercise.id)?.correctOption)
    .map((option) => [exercise.chapterId, option] as const));
  const reused = spreadAcrossChapters(distractors);
  const reusedDistractors = reused.occurrences / Math.max(1, distractors.length) >= 0.5;
  add("REUSED_DISTRACTORS", reusedDistractors ? "BLOCKING" : "WARNING", reused.occurrences, distractors.length, `${reused.repeated.size} mauvaises réponses génériques reviennent dans ${SPREAD_CHAPTERS} chapitres ou plus.`);

  const prompts = spreadAcrossChapters(base.exercises.map((exercise) => [exercise.chapterId, exercise.prompt] as const));
  add("TEMPLATE_PROMPTS", "WARNING", prompts.occurrences, base.exercises.length, `${prompts.repeated.size} énoncés passe-partout répétés d’un chapitre à l’autre.`);

  const duplicateDefinitions = base.chapters.filter((chapter) => {
    const definitions = chapter.concepts.map((concept) => concept.definition).filter(Boolean);
    return definitions.length > 1 && new Set(definitions).size === 1;
  }).length;
  add("DUPLICATE_DEFINITIONS", "WARNING", duplicateDefinitions, base.chapters.length, "Dans ces chapitres, toutes les notions ont la même définition (le résumé du chapitre).");

  const backs = new Map<string, number>();
  for (const card of base.flashcards) backs.set(card.back, (backs.get(card.back) ?? 0) + 1);
  const duplicateBacks = [...backs.values()].filter((count) => count > 1).reduce((sum, count) => sum + count, 0);
  const flashcardsBlocked = duplicateBacks / Math.max(1, base.flashcards.length) >= 0.5;
  add("DUPLICATE_FLASHCARD_BACKS", flashcardsBlocked ? "BLOCKING" : "WARNING", duplicateBacks, base.flashcards.length, "Plusieurs cartes ont exactement le même verso : elles ne testent pas une notion précise.");

  const unsourced = base.exercises.filter((exercise) => exercise.sourceIds.length === 0).length;
  add("UNSOURCED_EXERCISES", "WARNING", unsourced, base.exercises.length, "Exercices générés sans page source citée : à vérifier contre le cours.");

  const broken = base.exercises.filter((exercise) => !chapterIds.has(exercise.chapterId)).length
    + base.flashcards.filter((card) => !chapterIds.has(card.chapterId)).length;
  add("BROKEN_LINKS", "WARNING", broken, base.exercises.length + base.flashcards.length, "Éléments rattachés à un chapitre inconnu.");

  const missing = base.exercises.filter((exercise) => !base.answerKey.has(exercise.id)).length;
  add("MISSING_ANSWERS", "WARNING", missing, base.exercises.length, "Exercices sans corrigé.");

  const open = base.exercises.filter((exercise) => exercise.options.length < 2 && base.answerKey.has(exercise.id) && chapterIds.has(exercise.chapterId));
  return {
    findings: findings.sort((a, b) => Number(b.severity === "BLOCKING") - Number(a.severity === "BLOCKING")),
    usable: { courseMap: base.chapters.length > 0, mcq: mcq.length > 0 && !biased && !reusedDistractors, openExercises: open.length > 0, flashcards: base.flashcards.length > 0 && !flashcardsBlocked },
  };
}

/** Exercises fit for practice in a chapter, given the audit: blocked multiple-choice questions are left out. */
export function practiceExercises(base: PedagogicalBase, report: QualityReport, chapterId: string): BaseExercise[] {
  return base.exercises.filter((exercise) => exercise.chapterId === chapterId && base.answerKey.has(exercise.id)
    && (exercise.options.length >= 2 ? report.usable.mcq : report.usable.openExercises));
}
