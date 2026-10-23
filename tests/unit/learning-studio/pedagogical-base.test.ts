import assert from "node:assert/strict";
import test from "node:test";
import { auditPedagogicalBase, parsePedagogicalBase, practiceExercises } from "../../../src/modules/learning-studio/pedagogical-base.ts";
import { ImportError } from "../../../src/modules/learning-studio/import.ts";

// Synthetic export in the schema 1.0 shape (no real course content).
const CHAPTERS = ["alpha", "beta", "gamma", "delta", "epsilon"];
const GENERIC = ["Réponse générique A.", "Réponse générique B.", "Réponse générique C."];

function courses() {
  return { schema_version: "1.0", subjects: [{ subject: { id: "s1", name: "Matière fictive" }, modules: [{ id: "m1", title: "Module", chapters: CHAPTERS.map((name) => ({
    id: `ch_${name}`, title: `Chapitre ${name}`, concepts: [`${name}-1`, `${name}-2`], summary: `Résumé ${name}.`, example: `Exemple ${name}.`,
    analogy: `Analogie ${name}.`, mistakes: `Erreur ${name}.`,
    lessons: [{ id: `l_${name}`, concepts: [1, 2].map((n) => ({ label: `${name}-${n}`, definition: `Résumé ${name}.` })), objectives: [`Objectif ${name}`], prerequisites: ["Base commune"], exercise_ids: [`q_${name}`, `o_${name}`], flashcard_ids: [`f_${name}_1`, `f_${name}_2`] }],
  })) }] }] };
}

function biasedExercises() {
  return {
    items: CHAPTERS.flatMap((name) => [
      { id: `q_${name}`, chapter_id: `ch_${name}`, type: "qcm", prompt: `Que résume ${name} ?`, options: [`Le résumé complet et détaillé du chapitre ${name}.`, ...GENERIC], source_ids: [] },
      { id: `o_${name}`, chapter_id: `ch_${name}`, type: "open", prompt: "Comment progresser sur ce chapitre ?", source_ids: [] },
    ]),
    answer_key: CHAPTERS.flatMap((name) => [
      { id: `q_${name}`, answer: { correct_option: 0 }, detailed_solution: "A.", common_errors: [] },
      { id: `o_${name}`, answer: {}, detailed_solution: `Grille ${name}.`, common_errors: ["Oubli"] },
    ]),
  };
}

const flashcards = { items: CHAPTERS.flatMap((name) => [1, 2].map((n) => ({ id: `f_${name}_${n}`, chapter_id: `ch_${name}`, front: `${name}-${n} ?`, back: `Résumé ${name}.` }))) };

test("the course map keeps examples, analogies, mistakes and lesson links as derived material", () => {
  const base = parsePedagogicalBase({ courses: courses(), exercises: biasedExercises(), flashcards });
  assert.equal(base.classification, "DERIVED_MATERIAL");
  assert.equal(base.chapters.length, 5);
  const alpha = base.chapters[0];
  assert.deepEqual([alpha.subject, alpha.example, alpha.analogy, alpha.mistakes], ["Matière fictive", "Exemple alpha.", "Analogie alpha.", "Erreur alpha."]);
  assert.deepEqual(alpha.exerciseIds, ["q_alpha", "o_alpha"]);
  assert.equal(base.answerKey.get("o_alpha")?.solution, "Grille alpha.");
  assert.deepEqual(alpha.concepts.map((concept) => concept.label), ["alpha-1", "alpha-2"]);
});

test("an answer shipped inside a question never reaches the question objects", () => {
  const exercises = biasedExercises();
  (exercises.items[0] as Record<string, unknown>).detailed_solution = "fuite";
  const base = parsePedagogicalBase({ courses: courses(), exercises });
  assert.equal(base.leakedAnswers, 1);
  assert.ok(!JSON.stringify(base.exercises).includes("fuite"));
  assert.ok(auditPedagogicalBase(base).findings.some((finding) => finding.code === "ANSWER_IN_QUESTIONS"));
});

test("a guessable multiple-choice bank and copy-pasted flashcards are blocked for practice", () => {
  const base = parsePedagogicalBase({ courses: courses(), exercises: biasedExercises(), flashcards });
  const report = auditPedagogicalBase(base);
  const codes = new Map(report.findings.map((finding) => [finding.code, finding]));
  assert.equal(codes.get("LONGEST_OPTION_IS_CORRECT")?.severity, "BLOCKING");
  assert.equal(codes.get("REUSED_DISTRACTORS")?.severity, "BLOCKING");
  assert.equal(codes.get("DUPLICATE_DEFINITIONS")?.count, 5);
  assert.equal(codes.get("DUPLICATE_FLASHCARD_BACKS")?.severity, "BLOCKING");
  assert.equal(codes.get("TEMPLATE_PROMPTS")?.count, 5);
  assert.equal(codes.get("UNSOURCED_EXERCISES")?.count, 10);
  assert.deepEqual(report.usable, { courseMap: true, mcq: false, openExercises: true, flashcards: false });
  assert.deepEqual(practiceExercises(base, report, "ch_alpha").map((exercise) => exercise.id), ["o_alpha"]);
});

test("a balanced, sourced bank passes the audit", () => {
  const exercises = {
    items: CHAPTERS.map((name, index) => ({ id: `q_${name}`, chapter_id: `ch_${name}`, type: "qcm", prompt: `Question propre ${name} ?`, source_ids: ["src_1"],
      options: [`Option ${name} un`, `Autre ${name} deux plus longue`, `Choix ${name} trois`, `Réponse ${name} quatre`] })),
    answer_key: CHAPTERS.map((name, index) => ({ id: `q_${name}`, answer: { correct_option: index % 4 }, detailed_solution: "Justification." })),
  };
  const cards = { items: CHAPTERS.map((name) => ({ id: `f_${name}`, chapter_id: `ch_${name}`, front: `${name} ?`, back: `Définition propre de ${name}.` })) };
  const report = auditPedagogicalBase(parsePedagogicalBase({ courses: courses(), exercises, flashcards: cards }));
  assert.deepEqual(report.findings.filter((finding) => finding.severity === "BLOCKING"), []);
  assert.equal(report.usable.mcq, true);
  assert.equal(report.usable.flashcards, true);
});

test("a file that is not a course export is refused", () => {
  assert.throws(() => parsePedagogicalBase({ courses: { hello: "world" } }), ImportError);
});
