import assert from "node:assert/strict";
import test from "node:test";
import {
  PROTOCOL_SEQUENCES,
  ROUTING_CHALLENGES,
  computeSubnet,
  evaluateSubnetAnswer,
  generateSubnetChallenge,
  solveLongestPrefixMatch,
} from "../../../src/modules/cs-labs/networking-lab.ts";
import {
  LINUX_MISSIONS,
  SOC_TRIAGE_CASES,
  runVirtualLinuxCommand,
} from "../../../src/modules/cs-labs/linux-cyber-lab.ts";
import {
  CS_DRILL_QUESTIONS,
  SQL_CHALLENGES,
  evaluateSqlQuery,
} from "../../../src/modules/cs-labs/sql-algo-lab.ts";
import {
  CS_LABS_STORAGE_KEY,
  CYU_SAE_SCENARIOS,
  DEFAULT_CS_LABS_PROGRESS,
  incrementSubnetSolved,
  markCsItemSolved,
  readCsLabsProgress,
  writeCsLabsProgress,
} from "../../../src/modules/cs-labs/sae-scenarios.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test("computeSubnet computes exact IPv4 CIDR network, broadcast, hosts, and binary masks", () => {
  const c26 = computeSubnet("192.168.42.130", 26);
  assert.equal(c26.subnetMask, "255.255.255.192");
  assert.equal(c26.networkAddress, "192.168.42.128");
  assert.equal(c26.broadcastAddress, "192.168.42.191");
  assert.equal(c26.firstHost, "192.168.42.129");
  assert.equal(c26.lastHost, "192.168.42.190");
  assert.equal(c26.usableHosts, 62);

  const c30 = computeSubnet("10.0.1.5", 30);
  assert.equal(c30.networkAddress, "10.0.1.4");
  assert.equal(c30.broadcastAddress, "10.0.1.7");
  assert.equal(c30.usableHosts, 2);

  const challenge = generateSubnetChallenge("seed-1", "B2");
  assert.deepEqual(challenge, generateSubnetChallenge("seed-1", "B2"));
  const good = evaluateSubnetAnswer(challenge, {
    networkAddress: challenge.solution.networkAddress,
    broadcastAddress: challenge.solution.broadcastAddress,
    usableHosts: String(challenge.solution.usableHosts),
  });
  assert.equal(good.allCorrect, true);
});

test("Longest Prefix Match solver matches every curated routing challenge and protocol sequences are valid", () => {
  for (const rc of ROUTING_CHALLENGES) {
    const winner = solveLongestPrefixMatch(rc.destinationIp, rc.routes);
    assert.equal(winner?.id, rc.expectedRouteId, rc.id);
  }
  assert.equal(PROTOCOL_SEQUENCES.length, 4);
  for (const seq of PROTOCOL_SEQUENCES) {
    assert.equal(seq.initialOrder.length, seq.expectedOrder.length);
    assert.deepEqual([...seq.initialOrder].sort(), [...seq.expectedOrder].sort());
  }
});

test("virtual Linux sandbox executes safe commands and solves all 4 CYU missions", () => {
  // Mission 1: chmod 600
  let s1 = LINUX_MISSIONS[0].initialState;
  assert.equal(LINUX_MISSIONS[0].isSolved(s1), false);
  const lsOut = runVirtualLinuxCommand(s1, "ls -la ~/.ssh");
  assert.match(lsOut.stdout, /id_ed25519/);
  s1 = runVirtualLinuxCommand(s1, "chmod 600 ~/.ssh/id_ed25519").nextState;
  assert.equal(LINUX_MISSIONS[0].isSolved(s1), true);

  // Mission 2: grep + ufw deny
  let s2 = LINUX_MISSIONS[1].initialState;
  const grepOut = runVirtualLinuxCommand(s2, "grep Failed /var/log/auth.log");
  assert.match(grepOut.stdout, /203\.0\.113\.45/);
  s2 = runVirtualLinuxCommand(s2, "ufw deny from 203.0.113.45").nextState;
  assert.equal(LINUX_MISSIONS[1].isSolved(s2), true);

  // Mission 3: stop telnet-legacy
  let s3 = LINUX_MISSIONS[2].initialState;
  const ssOut = runVirtualLinuxCommand(s3, "ss -tulpn");
  assert.match(ssOut.stdout, /telnet-legacy/);
  s3 = runVirtualLinuxCommand(s3, "systemctl stop telnet-legacy").nextState;
  assert.equal(LINUX_MISSIONS[2].isSolved(s3), true);

  // Mission 4: restart nginx
  let s4 = LINUX_MISSIONS[3].initialState;
  assert.equal(LINUX_MISSIONS[3].isSolved(s4), false);
  s4 = runVirtualLinuxCommand(s4, "systemctl restart nginx").nextState;
  assert.equal(LINUX_MISSIONS[3].isSolved(s4), true);

  // Unknown command reports friendly error without crashing
  const unknown = runVirtualLinuxCommand(s1, "rm -rf /");
  assert.equal(unknown.isError, true);

  // SOC cases integrity
  assert.equal(SOC_TRIAGE_CASES.length, 4);
  for (const item of SOC_TRIAGE_CASES) {
    assert.ok(item.choices.includes(item.correctAnswer));
  }
});

test("SQL evaluator accepts model queries, flags missing clauses, and CS drills/SAE scenarios are valid", () => {
  for (const sql of SQL_CHALLENGES) {
    const ok = evaluateSqlQuery(sql, sql.modelQuery);
    assert.equal(ok.correct, true, sql.id);
    const bad = evaluateSqlQuery(sql, "SELECT * FROM unknown_table");
    assert.equal(bad.correct, false, sql.id);
    assert.ok(bad.missingKeywords.length > 0);
  }

  assert.equal(CS_DRILL_QUESTIONS.length, 8);
  for (const q of CS_DRILL_QUESTIONS) {
    assert.ok(q.choices.includes(q.correctAnswer), q.id);
  }

  assert.equal(CYU_SAE_SCENARIOS.length, 4);
  for (const sae of CYU_SAE_SCENARIOS) {
    for (const step of sae.steps) {
      assert.ok(step.choices.includes(step.correctAnswer), step.id);
    }
  }
});

test("CS labs local progress persists cleanly and degrades safely on corrupted storage", () => {
  const storage = memoryStorage();
  let state = incrementSubnetSolved(DEFAULT_CS_LABS_PROGRESS);
  state = markCsItemSolved(state, "linuxSolvedIds", "linux-ssh-chmod");
  state = markCsItemSolved(state, "linuxSolvedIds", "linux-ssh-chmod"); // idempotent
  state = markCsItemSolved(state, "saeSolvedIds", "sae-dhcp-vlan");
  writeCsLabsProgress(storage, state);

  const restored = readCsLabsProgress(storage);
  assert.equal(restored.subnetSolvedCount, 1);
  assert.deepEqual(restored.linuxSolvedIds, ["linux-ssh-chmod"]);
  assert.deepEqual(restored.saeSolvedIds, ["sae-dhcp-vlan"]);

  const corrupted = readCsLabsProgress(memoryStorage({ [CS_LABS_STORAGE_KEY]: "{bad" }));
  assert.deepEqual(corrupted, DEFAULT_CS_LABS_PROGRESS);
});
