// Prints the ELOS evening review from the practice summary the agent writes next to the
// learner snapshot (elos-practice.json). No model, no network. Scheduled by Hermes:
// see docs/integrations/HERMES.md.
import { readFileSync } from "node:fs";
import path from "node:path";
import { AGENT_PRACTICE_FILE, parseAgentPractice, type AgentPractice } from "../src/modules/learner-snapshot/agent-practice.ts";
import { buildEveningMessage } from "../src/modules/learner-snapshot/coach.ts";

const stateFile = process.env.ELOS_STATE_FILE ?? path.join(process.env.HOME ?? "", "ELOS-Hermes", "elos-state.json");
let practice: AgentPractice | null = null;
try { practice = parseAgentPractice(readFileSync(path.join(path.dirname(stateFile), AGENT_PRACTICE_FILE), "utf8")); } catch { practice = null; }
console.log(buildEveningMessage(practice, new Date()));
