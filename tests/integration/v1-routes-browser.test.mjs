import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";

const ORIGIN = process.env.ELOS_ROUTE_TEST_ORIGIN ?? "http://127.0.0.1:3100";
const CHROME = process.env.ELOS_TEST_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const ROUTES = [
  "/", "/daily-english", "/data", "/evidence", "/learn", "/learn/deep-mastery-csv",
  "/learn/excel-csv-foundations-level-1", "/learn/excel-csv-foundations-level-1/held-out",
  "/learn/professional-scenarios/industrial-data-anomaly-report",
  "/learn/runtime-demo", "/learn/technical-english", "/learn/visual-lab", "/notebooklm",
  "/progress", "/review", "/semester", "/sources", "/subjects", "/subjects/networking",
  "/subjects/networking/sources/ch01-introduction-inf3050",
];

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function openChrome() {
  const temp = await mkdtemp(path.join(tmpdir(), "elos-v1-routes-"));
  const browser = spawn(CHROME, [
    "--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + path.join(temp, "profile"),
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-sync",
    "--disable-extensions", "--disable-default-apps", "--disable-component-update",
    "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1", "about:blank",
  ], { stdio: "ignore" });
  let launchError;
  browser.on("error", (error) => { launchError = error; });
  let endpoint;
  for (let attempt = 0; attempt < 200; attempt++) {
    if (launchError) throw launchError;
    try {
      const [port, route] = (await readFile(path.join(temp, "profile/DevToolsActivePort"), "utf8")).trim().split("\n");
      endpoint = "ws://127.0.0.1:" + port + route;
      break;
    } catch {
      await wait(50);
    }
  }
  if (!endpoint) throw new Error("Fresh headless Chrome did not start within ten seconds.");
  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  const events = { exceptions: [], consoleErrors: [], requests: [] };
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(String(data));
    if (message.method === "Runtime.exceptionThrown") events.exceptions.push(message.params.exceptionDetails);
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      events.consoleErrors.push(message.params.args.map((argument) => argument.value ?? argument.description).join(" "));
    }
    if (message.method === "Network.requestWillBeSent") events.requests.push(message.params.request.url);
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timeout);
    if (message.error) item.reject(new Error(message.error.message));
    else item.resolve(message.result);
  });
  function send(method, params = {}, sessionId) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        reject(new Error("CDP timeout: " + method));
      }, 60_000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Runtime.enable", {}, sessionId);
  await send("Page.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
  async function evaluate(expression) {
    const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result.value;
  }
  async function waitFor(pathname) {
    for (let attempt = 0; attempt < 400; attempt++) {
      try {
        const ready = await evaluate("document.readyState === 'complete' && location.pathname === " + JSON.stringify(pathname));
        if (ready) { await wait(250); return; }
      } catch { /* Navigation context changed. */ }
      await wait(25);
    }
    throw new Error("Route did not become ready: " + pathname);
  }
  async function waitForText(text) {
    for (let attempt = 0; attempt < 400; attempt++) {
      try {
        if (await evaluate("document.body?.innerText.includes(" + JSON.stringify(text) + ")")) return;
      } catch { /* Rendering context changed. */ }
      await wait(25);
    }
    throw new Error("Page did not render expected text: " + text);
  }
  async function close() {
    socket.close();
    if (browser.exitCode === null) {
      const stopped = once(browser, "exit").catch(() => {});
      browser.kill("SIGTERM");
      await Promise.race([stopped, wait(3_000)]);
      if (browser.exitCode === null && browser.signalCode === null) {
        browser.kill("SIGKILL");
        await stopped;
      }
    }
    await rm(temp, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
  return { browser, events, evaluate, send, sessionId, waitFor, waitForText, close };
}

test("all V1 routes render accessibly with external network disabled and cached history survives offline", async () => {
  const chrome = await openChrome();
  try {
    for (const route of ROUTES) {
      chrome.events.exceptions.length = 0;
      chrome.events.consoleErrors.length = 0;
      chrome.events.requests.length = 0;
      const navigation = await chrome.send("Page.navigate", { url: ORIGIN + route }, chrome.sessionId);
      assert.equal(navigation.errorText, undefined, route + " navigation failed");
      await chrome.waitFor(route);
      const snapshot = JSON.parse(await chrome.evaluate(`JSON.stringify({
        pathname: location.pathname,
        title: document.title,
        textLength: document.body?.innerText.trim().length ?? 0,
        lang: document.documentElement.lang,
        main: Boolean(document.querySelector("main#main-content")),
        overlay: Boolean(document.querySelector("[data-nextjs-dialog], .nextjs-container-errors-header")),
        duplicateIds: [...document.querySelectorAll("[id]")].map(node => node.id)
          .filter((id, index, values) => id && values.indexOf(id) !== index),
        unlabeled: [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea")]
          .filter(node => {
            const labelledBy = node.getAttribute("aria-labelledby");
            const labels = "labels" in node ? [...node.labels].map(label => label.textContent).join(" ") : "";
            return !(node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent?.trim()
              || labels.trim() || (labelledBy && document.getElementById(labelledBy)?.textContent?.trim()));
          }).map(node => node.tagName + ":" + (node.getAttribute("href") ?? node.getAttribute("type") ?? "")),
        imagesWithoutAlt: [...document.querySelectorAll("img")].filter(image => !image.hasAttribute("alt")).length,
      })`));
      assert.equal(snapshot.pathname, route);
      assert.ok(snapshot.title.includes("Engineer Learning OS"), route + " title");
      assert.ok(snapshot.textLength > 100, route + " meaningful content");
      assert.equal(snapshot.lang, "fr");
      assert.equal(snapshot.main, true);
      assert.equal(snapshot.overlay, false);
      assert.deepEqual(snapshot.duplicateIds, []);
      assert.deepEqual(snapshot.unlabeled, [], route + " unlabeled controls");
      assert.equal(snapshot.imagesWithoutAlt, 0);
      assert.deepEqual(chrome.events.exceptions, [], route + " runtime exceptions");
      assert.deepEqual(chrome.events.consoleErrors, [], route + " console errors");
      const external = chrome.events.requests.filter((url) => {
        try { return new URL(url).origin !== ORIGIN && !url.startsWith("data:") && !url.startsWith("blob:"); }
        catch { return true; }
      });
      assert.deepEqual(external, [], route + " external requests");
    }

    await chrome.send("Page.navigate", { url: ORIGIN + "/data" }, chrome.sessionId);
    await chrome.waitFor("/data");
    await chrome.waitForText("Historique opérationnel");
    await chrome.evaluate(`(() => {
      const now = Date.now();
      const base = { version: 1, component: "LOCAL_STORE", severity: "INFO", durationMs: 8, deviceId: null, queueDepth: 2, backupStatus: null, jobState: null, latencyMs: null, route: "/data" };
      const recent = { ...base, code: "SYNTHETIC_BROWSER_CHECK", timestamp: now, correlationId: "00000000-0000-7000-8000-000000000031" };
      const expired = { ...base, code: "EXPIRED_BROWSER_CHECK", timestamp: now - 91 * 24 * 60 * 60 * 1000, correlationId: "00000000-0000-7000-8000-000000000032" };
      const contaminated = { ...base, code: "CONTAMINATED_BROWSER_CHECK", timestamp: now, correlationId: "00000000-0000-7000-8000-000000000033", answer: "private learner answer" };
      localStorage.setItem("engineer-learning-os:operational-telemetry:v1", JSON.stringify([expired, contaminated, recent]));
      location.reload();
    })()`);
    await chrome.waitFor("/data");
    await chrome.waitForText("SYNTHETIC BROWSER CHECK");
    const operationalHistory = JSON.parse(await chrome.evaluate(`localStorage.getItem("engineer-learning-os:operational-telemetry:v1")`));
    assert.ok(operationalHistory.some((item) => item.code === "SYNTHETIC_BROWSER_CHECK"));
    assert.equal(operationalHistory.some((item) => item.code === "EXPIRED_BROWSER_CHECK"), false);
    assert.equal(JSON.stringify(operationalHistory).includes("private learner answer"), false);
    assert.ok(operationalHistory.every((item) => Object.keys(item).every((key) => [
      "version", "code", "component", "severity", "timestamp", "durationMs", "deviceId", "queueDepth",
      "backupStatus", "jobState", "correlationId", "latencyMs", "route",
    ].includes(key))));

    const assessmentApi = JSON.parse(await chrome.evaluate(`(async () => {
      const submit = async (body) => {
        const response = await fetch("/api/assessment/excel-held-out", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        return { status: response.status, body: await response.json() };
      };
      return JSON.stringify(await Promise.all([
        submit({ delimiter: "comma", anomalyId: "HX-201", explanation: "I inspect the preview and verify each field appears in a separate column." }),
        submit({ delimiter: "semicolon", anomalyId: "HX-206", explanation: "I inspect the preview and verify each field appears in a separate column." }),
        submit({}),
      ]));
    })()`));
    assert.equal(assessmentApi[0].status, 200); assert.equal(assessmentApi[0].body.passed, false);
    assert.equal(assessmentApi[1].status, 200); assert.equal(assessmentApi[1].body.passed, true);
    assert.equal(assessmentApi[2].status, 400); assert.equal(assessmentApi[2].body.error, "INVALID_INPUT");

    await chrome.send("Page.navigate", { url: ORIGIN + "/learn/excel-csv-foundations-level-1/held-out" }, chrome.sessionId);
    await chrome.waitFor("/learn/excel-csv-foundations-level-1/held-out");
    await chrome.evaluate(`localStorage.removeItem("engineer-learning-os:excel-held-out:v1"); localStorage.removeItem("engineer-learning-os:learning-records:v1"); location.reload()`);
    await chrome.waitFor("/learn/excel-csv-foundations-level-1/held-out");
    await chrome.waitForText("Commencer sans aide");
    await chrome.evaluate(`[...document.querySelectorAll("button")].find(node => node.textContent.includes("Commencer sans aide")).click()`);
    await chrome.waitForText("Ton diagnostic");
    await chrome.evaluate(`(() => {
      const set = (selector, value, eventName = "input") => {
        const node = document.querySelector(selector);
        const prototype = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
        node.dispatchEvent(new Event(eventName, { bubbles: true }));
      };
      set("#held-out-delimiter", "semicolon", "change");
      set("#held-out-anomaly", "HX-206");
      const area = document.querySelector("#held-out-explanation");
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(area, "I inspect the preview and verify each field appears in a separate column.");
      area.dispatchEvent(new Event("input", { bubbles: true }));
    })()`);
    await chrome.evaluate(`[...document.querySelectorAll("button")].find(node => node.textContent.trim() === "Pause").click()`);
    await chrome.waitForText("Épreuve en pause");
    await chrome.send("Page.reload", {}, chrome.sessionId);
    await chrome.waitFor("/learn/excel-csv-foundations-level-1/held-out");
    await chrome.waitForText("Épreuve en pause");
    await chrome.evaluate(`[...document.querySelectorAll("button")].find(node => node.textContent.includes("Reprendre exactement ici")).click()`);
    await chrome.waitForText("Ton diagnostic");
    assert.deepEqual(JSON.parse(await chrome.evaluate(`JSON.stringify({ delimiter: document.querySelector("#held-out-delimiter").value, anomalyId: document.querySelector("#held-out-anomaly").value, explanation: document.querySelector("#held-out-explanation").value })`)), {
      delimiter: "semicolon", anomalyId: "HX-206", explanation: "I inspect the preview and verify each field appears in a separate column.",
    });
    await chrome.evaluate(`[...document.querySelectorAll("button")].find(node => node.textContent.includes("Soumettre l’épreuve")).click()`);
    await chrome.waitForText("Transfert autonome démontré");
    const heldOutEvidence = JSON.parse(await chrome.evaluate(`localStorage.getItem("engineer-learning-os:learning-records:v1")`));
    assert.ok(heldOutEvidence.state.evidence.some((item) => item.missionId === "excel-csv-held-out-transfer-v1" && item.evaluationResult.outcome === "SUCCESSFUL_TRANSFER"));

    await chrome.send("Page.navigate", { url: ORIGIN + "/" }, chrome.sessionId);
    await chrome.waitFor("/");
    await chrome.evaluate(`document.querySelector('a[href="/data"]').click()`);
    await chrome.waitFor("/data");
    await chrome.send("Network.emulateNetworkConditions", {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    }, chrome.sessionId);
    await chrome.evaluate("history.back()");
    await chrome.waitFor("/");
    assert.ok((await chrome.evaluate("document.body.innerText.trim().length")) > 100);
    await chrome.evaluate("history.forward()");
    await chrome.waitFor("/data");
    assert.ok((await chrome.evaluate("document.body.innerText.includes('Sauvegarde et état du système')")));
    assert.equal(await chrome.evaluate(`Boolean(document.querySelector("[data-nextjs-dialog]"))`), false);
  } finally {
    await chrome.close();
  }
});
