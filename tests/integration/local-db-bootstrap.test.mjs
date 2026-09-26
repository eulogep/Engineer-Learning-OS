import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("local Daily English bootstrap is additive and idempotent", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "elos-local-db-"));
  const database = path.join(directory, "daily-english.db");
  const environment = { ...process.env, ELOS_LOCAL_DATABASE_PATH: database };
  try {
    execFileSync(process.execPath, ["scripts/setup-local-db.mjs"], { env: environment, stdio: "pipe" });
    const first = execFileSync("/usr/bin/sqlite3", [database,
      "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('Word','SpeakingSession','DailyMission'); SELECT COUNT(*) FROM Word;",
    ], { encoding: "utf8" }).trim().split("\n");
    assert.deepEqual(first, ["3", "30"]);

    execFileSync("/usr/bin/sqlite3", [database,
      "INSERT INTO Word (id,word,translation,category,status) VALUES ('learner-row','custom','privé','test','actif');",
    ]);
    execFileSync(process.execPath, ["scripts/setup-local-db.mjs"], { env: environment, stdio: "pipe" });
    const second = execFileSync("/usr/bin/sqlite3", [database,
      "SELECT COUNT(*) FROM Word; SELECT COUNT(*) FROM Word WHERE id='learner-row';",
    ], { encoding: "utf8" }).trim().split("\n");
    assert.deepEqual(second, ["31", "1"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
