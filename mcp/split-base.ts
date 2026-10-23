// Moves a pedagogical base's answer key out of the folder shared with the agent.
// Usage: npm run mcp:split-base -- <base folder> <answers dir>
// Writes <answers dir>/<base name>.json (mode 600) and rewrites exercises.json without it.
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { splitAnswerKey } from "../src/modules/learning-studio/pedagogical-base.ts";

const [folder, answersDir] = process.argv.slice(2).map((value) => path.resolve(value));
if (!folder || !answersDir) throw new Error("Usage: npm run mcp:split-base -- <base folder> <answers dir>");
if (answersDir === folder || answersDir.startsWith(folder + path.sep) || folder.startsWith(answersDir + path.sep)) throw new Error("The answers dir must be outside the base folder.");

const exercisesFile = path.join(folder, "exercises.json");
const { questions, answerKey } = splitAnswerKey(JSON.parse(readFileSync(exercisesFile, "utf8")));
if (answerKey.length === 0) { console.log("No answer key in exercises.json: nothing to do."); process.exit(0); }
mkdirSync(answersDir, { recursive: true, mode: 0o700 });
chmodSync(answersDir, 0o700);
const target = path.join(answersDir, `${path.basename(folder)}.json`);
writeFileSync(target, JSON.stringify(answerKey), { mode: 0o600 });
writeFileSync(exercisesFile, JSON.stringify(questions, null, 1));
console.log(`${answerKey.length} answers moved to ${target}; exercises.json now holds questions only.`);
