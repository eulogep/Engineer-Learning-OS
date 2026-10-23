import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer, practiceLogFile, readPractice } from "../../../mcp/elos-server.ts";
import { splitAnswerKey } from "../../../src/modules/learning-studio/pedagogical-base.ts";
import { parseAgentPractice } from "../../../src/modules/learner-snapshot/agent-practice.ts";

// Synthetic export: one guessable multiple-choice question and one open exercise per chapter.
const NAMES = ["un", "deux", "trois", "quatre", "cinq"];

function writeBase(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "elos-base-"));
  const folder = path.join(dir, "base-fictive");
  mkdirSync(folder);
  writeFileSync(path.join(folder, "courses.json"), JSON.stringify({ subjects: [{ subject: { name: "Matière fictive" }, modules: [{ chapters: NAMES.map((name) => ({
    id: `ch_${name}`, title: `Chapitre ${name}`, summary: "Résumé.", example: `Exemple ${name}.`, analogy: "Analogie.", mistakes: "Erreur.",
    lessons: [{ objectives: ["Objectif"], prerequisites: ["Base"], concepts: [{ label: "a", definition: "Même." }, { label: "b", definition: "Même." }] }],
  })) }] }] }));
  writeFileSync(path.join(folder, "exercises.json"), JSON.stringify({
    items: NAMES.flatMap((name) => [
      { id: `q_${name}`, chapter_id: `ch_${name}`, type: "qcm", prompt: "QCM ?", options: ["La réponse longue et complète.", "Non.", "Faux.", "Rien."] },
      { id: `o_${name}`, chapter_id: `ch_${name}`, type: "open", prompt: `Explique ${name}.` },
    ]),
    answer_key: NAMES.flatMap((name) => [
      { id: `q_${name}`, answer: { correct_option: 0 }, detailed_solution: "A." },
      { id: `o_${name}`, detailed_solution: `Corrigé ${name}.`, common_errors: ["Oubli"] },
    ]),
  }));
  return dir;
}

async function connect(env: NodeJS.ProcessEnv) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer(env).connect(serverTransport);
  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientTransport);
  return async (name: string, args: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name, arguments: args }) as { content: { text: string }[] };
    return JSON.parse(result.content[0].text) as Record<string, unknown>;
  };
}

test("the course map lists chapters with the audit, and hides copy-pasted definitions", async () => {
  const call = await connect({ NODE_ENV: "test", ELOS_BASE_DIR: writeBase(), ELOS_OCR: "off" });
  const map = await call("elos_course_map") as { bases: { usable: { mcq: boolean }; chapters: { id: string; practiceExercises: number }[] }[] };
  assert.equal(map.bases[0].usable.mcq, false);
  assert.deepEqual(map.bases[0].chapters.map((chapter) => chapter.practiceExercises), [1, 1, 1, 1, 1]);
  const chapter = await call("elos_course_map", { chapter_id: "ch_un" });
  assert.equal(chapter.example, "Exemple un.");
  assert.deepEqual(chapter.notions, ["a", "b"]);
  assert.equal("definitions" in chapter, false);
});

test("an exercise is served without its solution, which is revealed only after an attempt", async () => {
  const call = await connect({ NODE_ENV: "test", ELOS_BASE_DIR: writeBase(), ELOS_OCR: "off" });
  const exercise = await call("elos_course_exercise", { chapter_id: "ch_deux" });
  assert.equal(exercise.exercise_id, "o_deux", "the guessable multiple-choice question is never served");
  assert.ok(!JSON.stringify(exercise).includes("Corrigé"));
  assert.match(String((await call("elos_course_exercise", { exercise_id: "o_deux" })).error), /answer first/);
  assert.match(String((await call("elos_course_exercise", { exercise_id: "q_deux", answer: "A" })).error), /quality audit/);
  const corrected = await call("elos_course_exercise", { exercise_id: "o_deux", answer: "Ma réponse." });
  assert.equal(corrected.referenceSolution, "Corrigé deux.");
  assert.equal(corrected.verified, false);
});

test("without ELOS_BASE_DIR the tools explain how to configure the base", async () => {
  const call = await connect({ NODE_ENV: "test", ELOS_OCR: "off" });
  assert.match(String((await call("elos_course_map")).error), /ELOS_BASE_DIR/);
});

test("answer keys moved outside the shared folder are still used, and inline keys are reported", async () => {
  const dir = writeBase();
  const exercisesFile = path.join(dir, "base-fictive", "exercises.json");
  const { questions, answerKey } = splitAnswerKey(JSON.parse(readFileSync(exercisesFile, "utf8")));
  const answers = mkdtempSync(path.join(tmpdir(), "elos-answers-"));
  writeFileSync(exercisesFile, JSON.stringify(questions));
  writeFileSync(path.join(answers, "base-fictive.json"), JSON.stringify(answerKey));
  assert.ok(!readFileSync(exercisesFile, "utf8").includes("Corrigé"), "the shared folder holds questions only");

  const call = await connect({ NODE_ENV: "test", ELOS_BASE_DIR: dir, ELOS_ANSWERS_DIR: answers, ELOS_OCR: "off" });
  const map = await call("elos_course_map") as { bases: { warning?: string }[] };
  assert.equal(map.bases[0].warning, undefined);
  assert.equal((await call("elos_course_exercise", { exercise_id: "o_trois", answer: "Ma réponse." })).referenceSolution, "Corrigé trois.");

  const inline = await connect({ NODE_ENV: "test", ELOS_BASE_DIR: writeBase(), ELOS_OCR: "off" });
  assert.match(String(((await inline("elos_course_map")) as { bases: { warning?: string }[] }).bases[0].warning), /split-base/);
});

test("course questions come from the learner's files, are graded after the attempt and logged outside the shared folder", async () => {
  const base = mkdtempSync(path.join(tmpdir(), "elos-src-"));
  const root = path.join(base, "cours");
  mkdirSync(path.join(root, "Reseaux"), { recursive: true });
  writeFileSync(path.join(root, "Reseaux", "ip.md"), [
    "Le masque de sous-réseau est la valeur qui sépare la partie réseau de la partie hôte.",
    "Une adresse IPv4 est un identifiant de 32 bits attribué à une interface.",
    "La passerelle désigne le routeur qui relie le réseau local aux autres réseaux.",
    "Le commutateur est un équipement qui relie les machines d'un même réseau local.",
  ].join("\n\n"));
  const bases = path.join(base, "bases", "lp");
  mkdirSync(bases, { recursive: true });
  writeFileSync(path.join(bases, "courses.json"), JSON.stringify({ subjects: [{ subject: { name: "Architecture des réseaux" }, modules: [{ chapters: [{ id: "ch_ip", title: "IPv4", lessons: [{ concepts: [{ label: "IPv4" }, { label: "masque" }] }] }] }] }] }));
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", ELOS_SOURCES_DIR: root, ELOS_BASE_DIR: path.dirname(bases), ELOS_STATE_FILE: path.join(base, "elos-state.json"), ELOS_OCR: "off" };
  const call = await connect(env);

  const question = await call("elos_course_exercise", { chapter_id: "ch_ip" }) as { exercise_id: string; type: string; options: string[] };
  assert.equal(question.type, "qcm_from_courses");
  assert.equal(question.options.length, 4);
  assert.ok(!JSON.stringify(question).includes("quote"), "no citation before the attempt");
  assert.match(String((await call("elos_course_exercise", { exercise_id: question.exercise_id })).error), /answer first/);

  const graded = await call("elos_course_exercise", { exercise_id: question.exercise_id, answer: "aucune de ces notions" }) as { correct: boolean; citation: { quote: string }; evidence: string };
  assert.equal(graded.correct, false);
  assert.ok(graded.citation.quote.length > 0);
  assert.match(graded.evidence, /not mastery/);

  const log = practiceLogFile(root, env);
  assert.ok(!log.startsWith(root + path.sep), "the log lives outside the shared course folder");
  assert.ok(existsSync(log));
  assert.equal(readPractice(log).length, 1);
  const retry = await call("elos_course_exercise", { retry: true }) as { exercise_id?: string; retry: boolean; message?: string };
  assert.equal(retry.exercise_id, question.exercise_id, "the missed question comes back first");
  const summary = parseAgentPractice(readFileSync(path.join(base, "elos-practice.json"), "utf8"));
  assert.deepEqual([summary.chapters[0].chapterId, summary.chapters[0].answered], ["ch_ip", 1]);
  const map = await call("elos_course_map") as { bases: { chapters: { practice: { answered: number } | null }[] }[] };
  assert.equal(map.bases[0].chapters[0].practice?.answered, 1);
});
