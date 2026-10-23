import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../../../mcp/elos-server.ts";

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
