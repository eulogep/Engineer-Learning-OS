// Prints the ELOS morning coach message from the learner snapshot (ELOS_STATE_FILE),
// writes it next to the snapshot (coach-du-jour.md) and, with --notify, shows a macOS
// notification. No model, no network. Scheduled by Hermes: see docs/integrations/HERMES.md.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildMorningMessage } from "../src/modules/learner-snapshot/coach.ts";
import { parseLearnerSnapshot, type LearnerSnapshot } from "../src/modules/learner-snapshot/core.ts";

const file = process.env.ELOS_STATE_FILE ?? path.join(process.env.HOME ?? "", "ELOS-Hermes", "elos-state.json");
let snapshot: LearnerSnapshot | null = null;
try { snapshot = parseLearnerSnapshot(readFileSync(file, "utf8")); } catch { snapshot = null; }
const message = buildMorningMessage(snapshot, new Date());
try { writeFileSync(path.join(path.dirname(file), "coach-du-jour.md"), message + "\n", { mode: 0o600 }); } catch { /* folder missing: stdout only */ }
if (process.argv.includes("--notify") && process.platform === "darwin") {
  const summary = message.split("\n").filter((line) => /^(📚|❓|🎯)/u.test(line)).join(" ").slice(0, 220) || "Ouvre ELOS pour ta séance du jour.";
  try {
    execFileSync("osascript", ["-e", "on run argv", "-e", "display notification (item 1 of argv) with title \"ELOS — séance du jour\"", "-e", "end run", summary]);
  } catch { /* notifications disabled: the message is still printed */ }
}
console.log(message);
