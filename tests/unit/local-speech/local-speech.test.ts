import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_ASR_CONSENT_KEY,
  cleanTranscript,
  compareReading,
  downloadPercent,
  readLocalAsrConsent,
  toWhisperInput,
  writeLocalAsrConsent,
} from "../../../src/modules/local-speech/core.ts";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test("speech recognition stays off until the learner explicitly enables it", () => {
  const storage = memoryStorage();
  assert.equal(readLocalAsrConsent(storage), false);
  writeLocalAsrConsent(storage, true);
  assert.equal(storage.values.get(LOCAL_ASR_CONSENT_KEY), "ENABLED");
  assert.equal(readLocalAsrConsent(storage), true);
  writeLocalAsrConsent(storage, false);
  assert.equal(readLocalAsrConsent(storage), false);
  // Blocked or missing storage never enables it.
  assert.equal(readLocalAsrConsent(null), false);
  assert.equal(readLocalAsrConsent({ getItem: () => { throw new Error("SecurityError"); }, setItem() {}, removeItem() {} }), false);
});

test("Whisper markers are removed from transcripts", () => {
  assert.equal(cleanTranscript(" [BLANK_AUDIO] Hello , world (music) ♪ again . "), "Hello, world again.");
  assert.equal(cleanTranscript("[BLANK_AUDIO]"), "");
});

test("audio is mixed to mono and resampled to 16 kHz", () => {
  const left = new Float32Array(48_000).fill(0.5);
  const right = new Float32Array(48_000).fill(-0.5);
  const mono = toWhisperInput([left, right], 48_000);
  assert.equal(mono.length, 16_000);
  assert.ok(mono.every((sample) => Math.abs(sample) < 1e-6));

  const ramp = Float32Array.from({ length: 32 }, (_, i) => i);
  const resampled = toWhisperInput([ramp], 32_000);
  assert.equal(resampled.length, 16);
  assert.deepEqual([...resampled.slice(0, 4)], [0, 2, 4, 6]);
  assert.equal(toWhisperInput([new Float32Array(160)], 16_000).length, 160);
  assert.equal(toWhisperInput([], 44_100).length, 0);
});

test("download progress aggregates every model file", () => {
  assert.equal(downloadPercent([]), null);
  assert.equal(downloadPercent([{ file: "a", loaded: 10, total: 0 }]), null);
  assert.equal(downloadPercent([{ file: "a", loaded: 50, total: 100 }, { file: "b", loaded: 300, total: 300 }]), 88);
  assert.equal(downloadPercent([{ file: "a", loaded: 150, total: 100 }]), 100);
});

test("reading comparison highlights only the words that were not heard", () => {
  const result = compareReading("I agree that a resilient network is important.", "i agree that the resilient network is important");
  assert.equal(result.total, 8);
  assert.equal(result.matched, 7);
  assert.equal(result.score, 88);
  assert.deepEqual(result.missed, ["a"]);
  assert.deepEqual(result.words.filter((word) => !word.heard).map((word) => word.word), ["a"]);
});

test("one skipped word does not shift the rest of the alignment", () => {
  const result = compareReading("For two years I struggle with latency.", "for two years i struggle latency");
  assert.deepEqual(result.missed, ["with"]);
  assert.equal(result.matched, 6);
});

test("perfect, empty and contracted readings", () => {
  assert.equal(compareReading("It doesn’t depend on the agenda.", "It doesn't depend on the agenda").score, 100);
  assert.equal(compareReading("Hello world", "").score, 0);
  assert.equal(compareReading("", "anything").total, 0);
  // Punctuation-only tokens are neither counted nor highlighted.
  const dashes = compareReading("Yes — of course", "yes of course");
  assert.equal(dashes.total, 3);
  assert.equal(dashes.words.every((word) => word.heard), true);
});
