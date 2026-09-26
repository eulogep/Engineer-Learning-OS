import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

const require = createRequire(import.meta.url);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class DevTools {
  sequence = 0;
  pending = new Map();
  exceptions = [];
  constructor(socket) {
    this.socket = socket;
    socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.method === "Runtime.exceptionThrown") this.exceptions.push(message.params.exceptionDetails);
      const item = this.pending.get(message.id);
      if (!item) return;
      this.pending.delete(message.id); clearTimeout(item.timeout);
      if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
    });
    socket.addEventListener("close", () => {
      for (const item of this.pending.values()) { clearTimeout(item.timeout); item.reject(new Error("Browser closed")); }
      this.pending.clear();
    });
  }
  send(method, params = {}, sessionId = undefined) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error("CDP timeout: " + method)); }, 60000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  async evaluate(tab, expression) {
    const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, tab.sessionId);
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text);
    return response.result.value;
  }
}

/** Real Chrome, an ephemeral profile, loopback-only fixtures. No user browser/session is reused. */
export async function createBrowserHarness(errorTypes) {
  const root = process.cwd();
  const temp = await mkdtemp(path.join(tmpdir(), "elos-indexeddb-test-"));
  let browser;
  let server;
  let cdp;
  let sequence = 0;
  async function close() {
    if (browser && browser.exitCode === null) {
      const stopped = once(browser, "exit").catch(() => {});
      browser.kill("SIGTERM");
      await Promise.race([stopped, wait(3000)]);
      if (browser.exitCode === null && browser.signalCode === null) { browser.kill("SIGKILL"); await stopped; }
    }
    cdp?.socket.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await rm(temp, { recursive: true, force: true });
  }
  try {
    const compiled = require("next/dist/compiled/webpack/webpack");
    const compiler = compiled.webpack({ mode: "development", target: "web", devtool: false,
      entry: path.join(root, "tests/integration/learning-history/browser-fixture.ts"),
      output: { path: temp, filename: "bundle.js" },
      resolve: { extensions: [".ts", ".js"], alias: { "@": path.join(root, "src") } },
      module: { rules: [{ test: /\.ts$/, exclude: /node_modules/,
        use: path.join(root, "tests/integration/learning-history/typescript-loader.mjs") }] },
    });
    await new Promise((resolve, reject) => compiler.run((error, stats) => {
      compiler.close(() => {});
      if (error) reject(error);
      else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })));
      else resolve();
    }));
    const bundle = await readFile(path.join(temp, "bundle.js"));
    server = createServer((request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Security-Policy", "default-src 'self'; connect-src 'none'; img-src 'none'");
      if (request.url === "/bundle.js") { response.setHeader("Content-Type", "text/javascript"); response.end(bundle); }
      else if (request.url === "/") { response.setHeader("Content-Type", "text/html"); response.end('<!doctype html><title>ELOS synthetic IndexedDB tests</title><script src="/bundle.js"></script>'); }
      else { response.statusCode = 404; response.end(); }
    });
    server.listen(0, "127.0.0.1"); await once(server, "listening");
    const origin = "http://127.0.0.1:" + server.address().port;
    browser = spawn(process.env.ELOS_TEST_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
      "--headless=new", "--remote-debugging-port=0", "--user-data-dir=" + path.join(temp, "profile"),
      "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-sync",
      "--disable-extensions", "--disable-default-apps", "--disable-component-update",
      "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1", "about:blank",
    ], { stdio: "ignore" });
    let launchError;
    browser.on("error", (error) => { launchError = error; });
    let endpoint;
    for (let i = 0; i < 200; i++) {
      if (launchError) throw launchError;
      try {
        const [port, route] = (await readFile(path.join(temp, "profile/DevToolsActivePort"), "utf8")).trim().split("\n");
        endpoint = "ws://127.0.0.1:" + port + route; break;
      } catch { await wait(50); }
    }
    if (!endpoint) throw new Error("Fresh headless Chrome did not start within ten seconds.");
    const socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    cdp = new DevTools(socket);
    async function ready(tab) {
      for (let i = 0; i < 200; i++) {
        try { if (await cdp.evaluate(tab, "typeof globalThis.canonicalTest === 'object'")) return; } catch { /* Navigation context changing. */ }
        await wait(25);
      }
      const page = await cdp.evaluate(tab, "({url:location.href, text:document.body?.innerText})");
      throw new Error("Synthetic browser fixture did not load: " + JSON.stringify({ page, exceptions: cdp.exceptions }));
    }
    async function newTab() {
      const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
      const tab = { targetId, sessionId };
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Runtime.enable", {}, sessionId);
      await cdp.send("Page.navigate", { url: origin }, sessionId);
      await ready(tab); return tab;
    }
    const mainTab = await newTab();
    async function call(tab, method, ...args) {
      const result = await cdp.evaluate(tab, "globalThis.canonicalTest.call(" + JSON.stringify(method) + "," + JSON.stringify(args) + ")");
      if (!result.ok) {
        const error = new Error(result.error.message);
        // Preserve domain error identity across the browser test transport, not browser exception objects.
        const constructor = errorTypes[result.error.name];
        if (constructor) Object.setPrototypeOf(error, constructor.prototype);
        Object.assign(error, result.error); throw error;
      }
      return result.value;
    }
    async function createRepository({ name = "elos-test-" + crypto.randomUUID(), tab = mainTab, id = "repository-" + (++sequence) } = {}) {
      await call(tab, "create", id, name);
      /** @type {Promise<unknown>} */
      let pending = Promise.resolve();
      /** @template T @param {() => Promise<T>} fn @returns {Promise<T>} */
      const enqueue = (fn) => { const result = pending.catch(() => {}).then(fn); pending = result; return result; };
      const invoke = (method, args) => enqueue(() => call(tab, "invoke", id, method, args));
      const methods = new Set(["appendEvent", "appendEventWithOutbox", "getEventById", "hasEvent", "countEvents",
        "readEventsAfter", "readEventsByAttemptId", "readEventsByEvidenceId", "readEventsByType", "readTombstones",
        "getOutboxJobById", "getOutboxJobByEventId", "countOutboxJobs", "putDefinition", "getDefinition",
        "verifyDefinitionHash", "listReferencedDefinitions", "saveCheckpoint", "getCheckpoint"]);
      const repository = new Proxy({}, { get(_target, method) {
        if (method === "iterateEventsForExport") return async function* (batchSize) {
          for (const event of await invoke(method, [batchSize])) yield event;
        };
        if (!methods.has(method)) return undefined;
        return (...args) => invoke(method, args);
      } });
      return { repository, name, tab, id,
        failNextAtomicWriteAfterEvent() { void enqueue(() => call(tab, "fail", id, "AFTER_EVENT_WRITE")); },
        call: (method, ...args) => enqueue(() => call(tab, method, id, ...args)),
        inspect: () => enqueue(() => call(tab, "inspect", name)),
      };
    }
    return { close, newTab, mainTab, createRepository, call,
      async reload(tab) {
        await cdp.evaluate(tab, "globalThis.canonicalTest = undefined");
        await cdp.send("Page.reload", {}, tab.sessionId); await ready(tab);
      },
      version: await cdp.send("Browser.getVersion"),
    };
  } catch (error) { await close(); throw error; }
}
