import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  EXTERNAL_ZAI_DISABLED_CODE,
  isExternalZaiClientProcessingEnabled,
  isExternalZaiServerProcessingEnabled,
} from "../../../src/config/external-ai.ts";

test("external ZAI processing is disabled unless both scopes are explicitly enabled", () => {
  assert.equal(isExternalZaiServerProcessingEnabled({}), false);
  assert.equal(isExternalZaiClientProcessingEnabled({}), false);
  assert.equal(isExternalZaiServerProcessingEnabled({ ELOS_EXTERNAL_ZAI_PROCESSING: "enabled" }), false);
  assert.equal(isExternalZaiClientProcessingEnabled({ NEXT_PUBLIC_ELOS_EXTERNAL_ZAI_PROCESSING: "enabled" }), false);
  assert.equal(isExternalZaiServerProcessingEnabled({ ELOS_EXTERNAL_ZAI_PROCESSING: "ENABLED" }), true);
  assert.equal(isExternalZaiClientProcessingEnabled({ NEXT_PUBLIC_ELOS_EXTERNAL_ZAI_PROCESSING: "ENABLED" }), true);
  assert.equal(EXTERNAL_ZAI_DISABLED_CODE, "EXTERNAL_ZAI_PROCESSING_DISABLED");
});

test("speaking and correction routes gate external processing before reading owner data", () => {
  for (const relativePath of [
    "src/app/api/speaking-session/route.ts",
    "src/app/api/correction/route.ts",
  ]) {
    const source = readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
    const gate = source.indexOf("if (!isExternalZaiServerProcessingEnabled())");
    assert.ok(gate >= 0, `${relativePath} must enforce the external-processing gate`);
    assert.ok(gate < source.indexOf("request.json()"), `${relativePath} must reject before reading the request body`);
    assert.ok(gate < source.indexOf("getZAI()", gate), `${relativePath} must reject before creating the provider client`);
    assert.match(source.slice(gate, source.indexOf("try", gate)), /status: 403/);
  }
});
