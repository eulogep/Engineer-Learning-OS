import { spawn, spawnSync } from "node:child_process";
import { globSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { once } from "node:events";

const root = process.cwd();
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), "elos-v1-validation-"));
const databasePath = path.join(temporaryDirectory, "daily-english.db");
const baseEnvironment = {
  ...process.env,
  DATABASE_URL: "file:" + databasePath,
  ELOS_LOCAL_DATABASE_PATH: databasePath,
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  NEXT_PUBLIC_ELOS_REMOTE_SYNC_MODE: "DISABLED",
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_ANON_KEY: "",
};
let application;
let serverLog = "";

function run(label, executable, arguments_, environment = baseEnvironment) {
  const startedAt = Date.now();
  console.log("\n== " + label + " ==");
  const result = spawnSync(executable, arguments_, { cwd: root, env: environment, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(label + " failed with exit code " + result.status);
  console.log("PASS " + label + " (" + ((Date.now() - startedAt) / 1000).toFixed(1) + "s)");
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForApplication(origin) {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (application.exitCode !== null) throw new Error("Local application exited before readiness.\n" + serverLog.slice(-4_000));
    try {
      const response = await fetch(origin + "/");
      if (response.ok) return;
    } catch { /* Server is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Local application did not become ready.\n" + serverLog.slice(-4_000));
}

async function stopApplication() {
  if (!application || application.exitCode !== null) return;
  const stopped = once(application, "exit").catch(() => {});
  application.kill("SIGTERM");
  await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 3_000))]);
  if (application.exitCode === null && application.signalCode === null) {
    application.kill("SIGKILL");
    await stopped;
  }
}

function scanRelease() {
  console.log("\n== release security boundaries ==");
  const tracked = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  if (tracked.status !== 0) throw new Error("git ls-files failed");
  const sensitivePath = /(^|\/)(\.env($|\.)|[^/]+\.(db|sqlite|sqlite3)$|cookies?\.json$|storage-state|browser-profile)/i;
  const sensitive = tracked.stdout.split("\n").filter(Boolean)
    .filter((file) => file !== ".env.example" && sensitivePath.test(file));
  if (sensitive.length) throw new Error("Sensitive paths are tracked: " + sensitive.join(", "));

  const candidateFiles = globSync("{src,tests,scripts,docs,public}/**/*").filter((file) => {
    try { return statSync(file).isFile(); } catch { return false; }
  });
  const secretPattern = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-[A-Za-z0-9]{20,}|postgres(?:ql)?:\/\/[^\s]+:[^\s@]+@/;
  for (const file of candidateFiles) {
    const content = readFileSync(file, "utf8");
    if (secretPattern.test(content)) throw new Error("Secret-like value found in " + file);
  }

  const heldOutCsv = readFileSync("public/training-data/excel-csv-foundations/held-out/plant-readings.csv", "utf8");
  for (const [rowIndex, row] of heldOutCsv.trim().split(/\r?\n/).entries()) {
    if (rowIndex === 0) continue;
    for (const cell of row.split(";")) {
      if (/^[=+@]/.test(cell) || /^-[^0-9]/.test(cell)) throw new Error("Spreadsheet formula prefix found in held-out CSV");
    }
  }

  const staticBundle = globSync(".next/static/**/*").filter((file) => {
    try { return statSync(file).isFile(); } catch { return false; }
  }).map((file) => readFileSync(file, "utf8")).join("\n");
  if (/HX-206|EXPECTED_ANOMALY_ID|EXPECTED_DELIMITER/.test(staticBundle)) throw new Error("Held-out key leaked into the client bundle");
  const serverBundle = globSync(".next/server/**/*").filter((file) => {
    try { return statSync(file).isFile(); } catch { return false; }
  }).map((file) => readFileSync(file, "utf8")).join("\n");
  if (!serverBundle.includes("HX-206")) throw new Error("Held-out evaluator key is missing from the server build");

  const diffCheck = spawnSync("git", ["-c", "core.whitespace=cr-at-eol", "diff", "--check"], { cwd: root, encoding: "utf8" });
  if (diffCheck.status !== 0) throw new Error("Git whitespace check failed:\n" + diffCheck.stdout);
  console.log("PASS release security boundaries");
}

try {
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("Node.js 24 or newer is required");
  run("synthetic local database", process.execPath, ["scripts/setup-local-db.mjs"]);
  run("product TypeScript", path.join(root, "node_modules/.bin/tsc"), ["--noEmit", "--pretty", "false"]);
  run("product ESLint", path.join(root, "node_modules/.bin/eslint"), ["src", "tests", "scripts", "next.config.ts"]);

  const domainTests = [
    ...globSync("tests/unit/*/*.test.ts"),
    ...globSync("tests/integration/*.test.ts"),
    ...globSync("tests/integration/mission-runtime/*.test.cjs"),
    "tests/integration/local-db-bootstrap.test.mjs",
  ].sort();
  run("domain and integration regression", process.execPath, ["--experimental-strip-types", "--loader", "./tests/unit/learning-history/node-loader.mjs", "--test", ...domainTests]);
  run("real Chrome IndexedDB, recovery and audio", process.execPath, ["--experimental-strip-types", "--test",
    "tests/integration/learning-history/indexeddb-browser.test.ts",
    "tests/integration/learning-history/export-restore-browser.test.ts",
    "tests/integration/technical-english/audio-browser.test.ts",
  ]);
  run("production build", path.join(root, "node_modules/.bin/next"), ["build"]);
  scanRelease();

  const port = await findFreePort();
  const origin = "http://127.0.0.1:" + port;
  application = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: baseEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [application.stdout, application.stderr]) stream.on("data", (chunk) => { serverLog = (serverLog + chunk).slice(-20_000); });
  await waitForApplication(origin);
  run("real Chrome routes, held-out flow and cached offline navigation", process.execPath, ["--test", "tests/integration/v1-routes-browser.test.mjs"], { ...baseEnvironment, ELOS_ROUTE_TEST_ORIGIN: origin });
  await stopApplication();
  console.log("\nV1_LOCAL_VALIDATION PASS");
} finally {
  await stopApplication();
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
