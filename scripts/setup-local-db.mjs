import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { VOCABULARY } from "../src/modules/daily-english/vocabulary.ts";

// Single source of truth shared with `prisma/seed.ts` and the browser-only mode.
// Node >= 24 strips the types of this dependency-free module natively.
const WORDS = VOCABULARY.map((entry) => [entry.word, entry.translation, entry.category]);

function quote(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

const databasePath = path.resolve(process.env.ELOS_LOCAL_DATABASE_PATH ?? "prisma/dev.db");
mkdirSync(path.dirname(databasePath), { recursive: true });
const seed = WORDS.map(([word, translation, category]) =>
  `INSERT OR IGNORE INTO "Word" ("id", "word", "translation", "category", "status")
VALUES (${quote("seed-" + word.toLowerCase().replace(/\s+/g, "-"))}, ${quote(word)}, ${quote(translation)}, ${quote(category)}, 'nouveau');`
).join("\n");
const sql = `PRAGMA foreign_keys=ON;
BEGIN IMMEDIATE;
CREATE TABLE IF NOT EXISTS "Word" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "word" TEXT NOT NULL,
  "translation" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT 'general',
  "personalSentence" TEXT,
  "mentalImage" TEXT,
  "emotion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'nouveau',
  "nextReviewDate" DATETIME,
  "lastUsedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "SpeakingSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "audioUrl" TEXT,
  "transcription" TEXT,
  "correctedText" TEXT,
  "feedback" TEXT,
  "repeated" BOOLEAN NOT NULL DEFAULT false,
  "durationSeconds" INTEGER,
  "repeatDurationSeconds" INTEGER,
  "wordsUsedJson" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "DailyMission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "wordIdsJson" TEXT NOT NULL,
  "personalSentencesJson" TEXT NOT NULL,
  "speakingSessionId" TEXT,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
${seed}
COMMIT;
`;
execFileSync("/usr/bin/sqlite3", [databasePath], { input: sql, stdio: ["pipe", "inherit", "inherit"] });
console.log("Local Daily English database is ready at " + path.relative(process.cwd(), databasePath));
