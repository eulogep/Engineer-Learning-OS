/* eslint-disable @typescript-eslint/no-require-imports -- Node strip-types test runner */
import type { NotebookLMAutomationPlan } from "../../../src/modules/notebooklm/types.ts";
// The local NotebookLM bridge must never start a process unless it is explicitly enabled on a trusted
// local server, and the existing controlled behaviour must be unchanged once it is.
const assert = require("node:assert/strict");
const test = require("node:test");
const { EventEmitter } = require("node:events");
const { mkdtemp, mkdir, writeFile, rm } = require("node:fs/promises");
const { readFileSync } = require("node:fs");
const { createHash } = require("node:crypto");
const os = require("node:os");
const path = require("node:path");

const { handleNotebookLMExecute } = require("../../../src/modules/notebooklm/execute-handler.ts");
const { runControlledLegacyProvider, verifyControlledManifest } = require("../../../src/modules/notebooklm/server-runner.ts");
const { evaluateNotebookLMAutomationRequest, isNotebookLMAutomationEnabled, NOTEBOOKLM_AUTOMATION_FLAG } = require("../../../src/modules/notebooklm/automation-gate.ts");
const { approveNotebookLMTask } = require("../../../src/modules/notebooklm/core.ts");
const { NotebookLMGuard } = require("../../../src/modules/notebooklm/guard.ts");
const { createPilotTransferManifest, networkingNotebookLMBundle, notebookLMPilotSources, notebookLMPilotTasks, notebookLMPromptHashes } = require("../../../src/modules/notebooklm/pilot-registry.ts");

const ENABLED = { [NOTEBOOKLM_AUTOMATION_FLAG]: "ENABLED" };
const URL_LOCAL = "http://localhost:3000/api/notebooklm/execute";

function validPlan(): NotebookLMAutomationPlan {
  const template = notebookLMPilotTasks[0];
  const approvedAt = "2026-09-26T10:00:00.000Z";
  const task = approveNotebookLMTask(template, networkingNotebookLMBundle, notebookLMPilotSources, true, approvedAt);
  return new NotebookLMGuard().createExecutionPlan({
    task, bundle: networkingNotebookLMBundle, sources: notebookLMPilotSources, manifest: createPilotTransferManifest(task),
    providerId: "LEGACY_NOTEBOOKLM_SKILL_1_3_0_CONTROLLED", notebookTitle: "ELOS — Networking — OSI TCP-IP Foundations",
    promptHash: notebookLMPromptHashes[task.promptTemplateId], createdAt: "2026-09-26T10:00:01.000Z", forceNewArtifact: false,
  });
}

function request(body: unknown, headers: object = {}, raw?: string) {
  return new Request(URL_LOCAL, {
    method: "POST",
    headers: { host: "localhost:3000", "content-type": "application/json", ...(headers as Record<string, string>) },
    body: raw ?? JSON.stringify(body),
  });
}

// A stand-in for child_process.spawn that records every call and answers like the script would.
function fakeSpawn(resultLine = 'ELOS_NOTEBOOKLM_RESULT={"status":"SUCCESS"}') {
  const calls: Array<{ command: string; args: string[]; options: Record<string, unknown>; stdin?: string }> = [];
  const spawn = (command: string, args: string[], options: Record<string, unknown>) => {
    const call = { command, args, options } as (typeof calls)[number];
    calls.push(call);
    type Emitter = InstanceType<typeof EventEmitter>;
    const child = new EventEmitter() as Emitter & { stdout: Emitter; stderr: Emitter; stdin: { end: (data: string) => void }; kill: () => void };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = () => undefined;
    child.stdin = { end: (data: string) => { call.stdin = data; setImmediate(() => { child.stdout.emit("data", Buffer.from(resultLine)); child.emit("close", 0); }); } };
    return child;
  };
  return { spawn, calls };
}

const passing = { access: async () => undefined, verifyManifest: async () => undefined };

test("AUTOMATION_DISABLED: the default refuses with 404 and spawns nothing", async () => {
  for (const env of [{}, { [NOTEBOOKLM_AUTOMATION_FLAG]: "" }, { [NOTEBOOKLM_AUTOMATION_FLAG]: "DISABLED" }, { [NOTEBOOKLM_AUTOMATION_FLAG]: "true" }, { [NOTEBOOKLM_AUTOMATION_FLAG]: "1" }, { [NOTEBOOKLM_AUTOMATION_FLAG]: "enabled" }, { NEXT_PUBLIC_ELOS_NOTEBOOKLM_AUTOMATION: "ENABLED" }]) {
    const { spawn, calls } = fakeSpawn();
    let verified = 0;
    const response = await handleNotebookLMExecute(request({ plan: validPlan(), operation: "EXECUTE" }), { env, runner: { spawn: spawn as never, ...passing, verifyManifest: async () => { verified += 1; } } });
    assert.equal(response.status, 404, JSON.stringify(env));
    assert.equal((await response.json()).detailCode, "AUTOMATION_DISABLED");
    assert.equal(calls.length, 0, "no process may start");
    assert.equal(verified, 0, "nothing is validated or read before the gate");
  }
});

test("AUTOMATION_DISABLED: a disabled request is refused before its body is read", async () => {
  const { spawn, calls } = fakeSpawn();
  const response = await handleNotebookLMExecute(request(undefined, {}, "{ not json"), { env: {}, runner: { spawn: spawn as never, ...passing } });
  assert.equal(response.status, 404);
  assert.equal(calls.length, 0);
});

test("AUTOMATION_DISABLED: the runner itself refuses, so no other caller can spawn by accident", async () => {
  const { spawn, calls } = fakeSpawn();
  await assert.rejects(runControlledLegacyProvider(validPlan(), "EXECUTE", { env: {}, spawn: spawn as never, ...passing }), /AUTOMATION_DISABLED/);
  assert.equal(calls.length, 0);
});

test("the switch is a server-only variable and the source never reads a NEXT_PUBLIC one", () => {
  assert.equal(NOTEBOOKLM_AUTOMATION_FLAG, "ELOS_NOTEBOOKLM_AUTOMATION");
  assert.equal(isNotebookLMAutomationEnabled(ENABLED), true);
  for (const file of ["src/modules/notebooklm/automation-gate.ts", "src/modules/notebooklm/server-runner.ts", "src/modules/notebooklm/execute-handler.ts", "src/app/api/notebooklm/execute/route.ts"]) {
    assert.doesNotMatch(readFileSync(path.join(process.cwd(), file), "utf8").replace(/\/\/.*$/gm, ""), /NEXT_PUBLIC_\w*NOTEBOOKLM/);
  }
});

test("AUTOMATION_ENABLED but not a trusted local context: refused, nothing spawned", async () => {
  const cases: Array<[string, Record<string, string>, Record<string, string>, number, string]> = [
    ["hosted platform", { ...ENABLED, VERCEL: "1" }, {}, 403, "AUTOMATION_NOT_LOCAL"],
    ["serverless runtime", { ...ENABLED, AWS_LAMBDA_FUNCTION_NAME: "fn" }, {}, 403, "AUTOMATION_NOT_LOCAL"],
    ["behind a proxy (client address)", ENABLED, { "x-forwarded-for": "203.0.113.9" }, 403, "AUTOMATION_NOT_LOCAL"],
    ["behind a proxy (address chain)", ENABLED, { "x-forwarded-for": "203.0.113.9, 127.0.0.1" }, 403, "AUTOMATION_NOT_LOCAL"],
    ["rewritten forwarded host", ENABLED, { "x-forwarded-host": "app.example.com" }, 403, "AUTOMATION_NOT_LOCAL"],
    ["real client ip header", ENABLED, { "x-real-ip": "203.0.113.9" }, 403, "AUTOMATION_NOT_LOCAL"],
    ["cdn client ip header", ENABLED, { "cf-connecting-ip": "203.0.113.9" }, 403, "AUTOMATION_NOT_LOCAL"],
    ["non-loopback host", ENABLED, { host: "app.example.com" }, 403, "AUTOMATION_NOT_LOCAL"],
    ["LAN address", ENABLED, { host: "192.168.1.20:3000" }, 403, "AUTOMATION_NOT_LOCAL"],
    ["cross-origin page", ENABLED, { origin: "https://evil.example" }, 403, "CROSS_ORIGIN_BLOCKED"],
    ["cross-site fetch metadata", ENABLED, { "sec-fetch-site": "cross-site" }, 403, "CROSS_ORIGIN_BLOCKED"],
    ["simple form content type", ENABLED, { "content-type": "text/plain" }, 415, "JSON_REQUIRED"],
  ];
  for (const [label, env, headers, status, detailCode] of cases) {
    const { spawn, calls } = fakeSpawn();
    const response = await handleNotebookLMExecute(request({ plan: validPlan(), operation: "EXECUTE" }, headers), { env, runner: { spawn: spawn as never, ...passing } });
    assert.equal(response.status, status, label);
    assert.equal((await response.json()).detailCode, detailCode, label);
    assert.equal(calls.length, 0, label);
  }
  // Same-origin loopback requests pass the gate.
  // The Next.js server adds these headers to every request it hands to a route (seen on a real server).
  const injectedByNext = { "x-forwarded-for": "::1", "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "http", "x-forwarded-port": "3000" };
  for (const headers of [injectedByNext, { ...injectedByNext, "x-forwarded-for": "127.0.0.1", host: "127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000" }, {}, { origin: "http://localhost:3000" }, { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000", "sec-fetch-site": "same-origin" }, { host: "[::1]:3000" }]) {
    assert.equal(evaluateNotebookLMAutomationRequest(request({}, headers), ENABLED).allowed, true, JSON.stringify(headers));
  }
});

test("AUTOMATION_ENABLED + invalid plan: 400 and nothing spawned", async () => {
  const good = validPlan();
  const invalid: Array<[string, unknown, string?]> = [
    ["missing plan", { operation: "EXECUTE" }],
    ["null plan", { plan: null, operation: "EXECUTE" }],
    ["unknown task", { plan: { ...good, taskId: "NOT-A-PILOT-TASK" }, operation: "EXECUTE" }],
    ["tampered prompt", { plan: { ...good, resolvedPrompt: `${good.resolvedPrompt} EXTRA` }, operation: "EXECUTE" }],
    ["tampered manifest", { plan: { ...good, manifest: { ...good.manifest, files: [{ ...good.manifest.files[0], relativePath: "../../etc/passwd" }] } }, operation: "EXECUTE" }],
    ["malformed JSON", undefined, "{ not json"],
  ];
  for (const [label, body, raw] of invalid) {
    const { spawn, calls } = fakeSpawn();
    const response = await handleNotebookLMExecute(request(body, {}, raw), { env: ENABLED, runner: { spawn: spawn as never, ...passing } });
    assert.equal(response.status, 400, label);
    assert.equal(calls.length, 0, label);
  }
});

test("AUTOMATION_ENABLED + valid controlled plan: the existing controlled behaviour, with fixed paths", async () => {
  const { spawn, calls } = fakeSpawn('noise\nELOS_NOTEBOOKLM_RESULT={"status":"SUCCESS"}');
  const workspace = path.resolve("/tmp/elos-workspace");
  const plan = validPlan();
  // Extra fields that try to steer the executable or script are ignored.
  const response = await handleNotebookLMExecute(
    request({ plan, operation: "INSPECT_HOME", python: "/bin/sh", script: "/tmp/evil.py", executable: "/bin/sh", args: ["-c", "id"] }),
    { env: ENABLED, runner: { spawn: spawn as never, ...passing, cwd: workspace } },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "SUCCESS" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, path.join(workspace, "skill notebooklm", ".venv", "Scripts", "python.exe"));
  assert.deepEqual(calls[0].args, [path.join(workspace, "skill notebooklm", "scripts", "elos_automation.py"), "--operation", "INSPECT_HOME"]);
  assert.equal(calls[0].options.cwd, workspace);
  assert.equal("shell" in calls[0].options && calls[0].options.shell, false);
  assert.deepEqual(JSON.parse(calls[0].stdin ?? "{}").plan.id, plan.id);
});

test("AUTOMATION_ENABLED + human login required maps to 401 as before", async () => {
  const { spawn } = fakeSpawn('ELOS_NOTEBOOKLM_RESULT={"status":"HUMAN_LOGIN_REQUIRED"}');
  const response = await handleNotebookLMExecute(request({ plan: validPlan(), operation: "EXECUTE" }), { env: ENABLED, runner: { spawn: spawn as never, ...passing } });
  assert.equal(response.status, 401);
});

test("the operation allowlist still holds: an unlisted operation never reaches spawn", async () => {
  for (const operation of ["RUN_SHELL", "../../bin/sh", "execute", ""]) {
    const { spawn, calls } = fakeSpawn();
    const response = await handleNotebookLMExecute(request({ plan: validPlan(), operation: operation || undefined }), { env: ENABLED, runner: { spawn: spawn as never, ...passing } });
    const body = await response.json();
    if (operation === "") assert.equal(calls.length, 1, "an omitted operation defaults to EXECUTE");
    else {
      assert.equal(body.detailCode, "OPERATION_BLOCKED", operation);
      assert.equal(calls.length, 0, operation);
    }
  }
});

test("manifest checks still run before spawn: a missing pilot file blocks the run", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "elos-notebooklm-"));
  try {
    const { spawn, calls } = fakeSpawn();
    const response = await handleNotebookLMExecute(request({ plan: validPlan(), operation: "EXECUTE" }), { env: ENABLED, runner: { spawn: spawn as never, access: async () => undefined, cwd: workspace } });
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("file-boundary and hash checks are unchanged", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "elos-notebooklm-"));
  try {
    await mkdir(path.join(workspace, "files"), { recursive: true });
    const content = Buffer.from("controlled fixture");
    await writeFile(path.join(workspace, "files", "fixture.txt"), content);
    const file = { sourceId: "S", relativePath: "files/fixture.txt", sha256: createHash("sha256").update(content).digest("hex"), sizeBytes: content.length, classification: "ACADEMIC_PERSONAL_USE" };
    const planWith = (entry: unknown) => ({ manifest: { files: [entry] } });
    await verifyControlledManifest(planWith(file), workspace);
    await assert.rejects(verifyControlledManifest(planWith({ ...file, relativePath: "../outside.txt" }), workspace), /MANIFEST_PATH_OUTSIDE_WORKSPACE/);
    await assert.rejects(verifyControlledManifest(planWith({ ...file, sha256: "0".repeat(64) }), workspace), /MANIFEST_FILE_INTEGRITY_MISMATCH/);
    await assert.rejects(verifyControlledManifest(planWith({ ...file, sizeBytes: content.length + 1 }), workspace), /MANIFEST_FILE_INTEGRITY_MISMATCH/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
