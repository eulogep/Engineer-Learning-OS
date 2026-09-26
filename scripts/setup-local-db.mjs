import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const WORDS = [
  ["embrace", "accepter / serrer", "verbe"],
  ["resilient", "résilient", "adjectif"],
  ["perspective", "perspective / point de vue", "nom"],
  ["overcome", "surmonter", "verbe"],
  ["genuine", "authentique / sincère", "adjectif"],
  ["thrive", "s'épanouir / prospérer", "verbe"],
  ["subtle", "subtil", "adjectif"],
  ["acknowledge", "reconnaître / admettre", "verbe"],
  ["meaningful", "significatif / plein de sens", "adjectif"],
  ["approach", "approche / aborder", "verbe"],
  ["reflection", "réflexion / reflet", "nom"],
  ["collaborate", "collaborer", "verbe"],
  ["challenge", "défi / mettre au défi", "nom"],
  ["inspire", "inspirer", "verbe"],
  ["curiosity", "curiosité", "nom"],
  ["adapt", "s'adapter", "verbe"],
  ["empathy", "empathie", "nom"],
  ["progress", "progrès / progresser", "nom"],
  ["accomplish", "accomplir / réaliser", "verbe"],
  ["insight", "perspicacité / aperçu", "nom"],
  ["determination", "détermination", "nom"],
  ["gratitude", "gratitude / reconnaissance", "nom"],
  ["influence", "influence / influencer", "nom"],
  ["explore", "explorer", "verbe"],
  ["significant", "significatif / important", "adjectif"],
  ["struggle", "lutte / lutter", "verbe"],
  ["transform", "transformer", "verbe"],
  ["opportunity", "opportunité", "nom"],
  ["contribute", "contribuer", "verbe"],
  ["intention", "intention", "nom"],
];

function quote(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

const databasePath = path.resolve(process.env.ELOS_LOCAL_DATABASE_PATH ?? "prisma/dev.db");
mkdirSync(path.dirname(databasePath), { recursive: true });
const seed = WORDS.map(([word, translation, category]) =>
  `INSERT OR IGNORE INTO "Word" ("id", "word", "translation", "category", "status")
VALUES (${quote("seed-" + word)}, ${quote(word)}, ${quote(translation)}, ${quote(category)}, 'nouveau');`
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
