import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  createAttemptId,
  createDeviceId,
  createEventId,
  mapLegacyClassification,
  UUIDV7_CANONICAL_PATTERN,
} = await import("../../../src/modules/learning-history/index.ts");

test("UUIDv7 factories create distinct valid opaque IDs", () => {
  const eventId = createEventId();
  const attemptId = createAttemptId();
  const deviceId = createDeviceId();
  assert.match(eventId, UUIDV7_CANONICAL_PATTERN);
  assert.match(attemptId, UUIDV7_CANONICAL_PATTERN);
  assert.match(deviceId, UUIDV7_CANONICAL_PATTERN);
  assert.equal(new Set([eventId, attemptId, deviceId]).size, 3);
});

test("legacy classification mapping is conservative", () => {
  assert.equal(mapLegacyClassification("TRAINING_SYNTHETIC", "METADATA_ONLY"), "SYNC_ALLOWED");
  assert.equal(mapLegacyClassification("PERSONAL", "METADATA_ONLY"), "SYNC_ALLOWED");
  assert.equal(mapLegacyClassification("PERSONAL", "RAW_CONTENT"), "LOCAL_ONLY");
  assert.equal(mapLegacyClassification("COMPANY_INTERNAL", "METADATA_ONLY"), "LOCAL_ONLY");
  assert.equal(mapLegacyClassification("UNKNOWN", "METADATA_ONLY"), "UNKNOWN_BLOCKED");
});
