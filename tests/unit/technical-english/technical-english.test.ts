/* eslint-disable @typescript-eslint/no-require-imports -- Node strip-types test runner */
import type {} from "node:test";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  MAX_FLUENCY_CORRECTIONS,
  buildTechnicalEnglishFeedback,
  createAudioEvidenceService,
  createTechnicalEnglishAttempt,
  evaluateTechnicalEnglishText,
  microphoneErrorMessage,
  technicalEnglishErrorSignals,
  technicalEnglishEvidenceFromAttempt,
} = require("../../../src/modules/technical-english/core.ts");
const { deriveCompetencyRecord, rebuildCompetencies, upsertEvidence } = require("../../../src/modules/learning-records/core.ts");
const { generateReviewItems, mergeErrorPatterns } = require("../../../src/modules/review-engine/core.ts");

function memoryAudioStore() {
  const values = new Map();
  return {
    values,
    async put(id: string, blob: Blob, metadata: unknown) { values.set(id, { blob, metadata }); },
    async get(id: string) { return values.get(id)?.blob ?? null; },
    async delete(id: string) { values.delete(id); },
  };
}

function completedAttempt(fields: Record<string, unknown> = {}) {
  const base = createTechnicalEnglishAttempt(1_000, "speaking-attempt-1");
  return {
    ...base,
    status: "COMPLETED",
    completedAt: 2_000,
    modality: "TEXT",
    textResponse: "First I import the CSV and check the comma delimiter in the preview so Excel creates separate columns.",
    evaluation: evaluateTechnicalEnglishText("First I import the CSV and check the comma delimiter in the preview so Excel creates separate columns."),
    ...fields,
  };
}

test("scenario A: audio evidence service saves and reloads a valid local recording", async () => {
  const store = memoryAudioStore();
  const service = createAudioEvidenceService(store, () => "audio-one", () => 1_500);
  const blob = new Blob(["synthetic audio"], { type: "audio/webm" });
  const reference = await service.save(blob, 12_000);
  assert.equal(reference.id, "audio-one");
  assert.equal(reference.durationMs, 12_000);
  assert.equal((await service.load(reference))?.size, blob.size);
});

test("scenario B: microphone denial has explicit permission guidance and a text fallback", () => {
  const error = new DOMException("denied", "NotAllowedError");
  const message = microphoneErrorMessage(error);
  assert.match(message, /microphone/i);
  assert.match(message, /écrire/i);
});

test("scenario C: deleting audio removes the local binary", async () => {
  const store = memoryAudioStore();
  const service = createAudioEvidenceService(store, () => "audio-delete", () => 1_500);
  const reference = await service.save(new Blob(["synthetic audio"], { type: "audio/webm" }), 4_000);
  await service.remove(reference);
  assert.equal(await service.load(reference), null);
});

test("scenario D: retries create distinct attempt and evidence identities", () => {
  const first = completedAttempt();
  const second = completedAttempt({ id: "speaking-attempt-2", completedAt: 3_000 });
  const firstEvidence = technicalEnglishEvidenceFromAttempt(first);
  const secondEvidence = technicalEnglishEvidenceFromAttempt(second);
  assert.notEqual(first.id, second.id);
  assert.notEqual(firstEvidence.id, secondEvidence.id);
  assert.equal(upsertEvidence([firstEvidence], [secondEvidence]).length, 2);
});

test("scenario E: persisted metadata can reload audio through a fresh service instance", async () => {
  const store = memoryAudioStore();
  const firstService = createAudioEvidenceService(store, () => "audio-persisted", () => 1_500);
  const reference = await firstService.save(new Blob(["synthetic audio"], { type: "audio/webm" }), 7_000);
  const reloadedService = createAudioEvidenceService(store);
  assert.equal((await reloadedService.load(reference))?.type, "audio/webm");
});

test("scenario F: audio without transcript is honest unverified evidence with no fabricated feedback", () => {
  const attempt = completedAttempt({
    modality: "AUDIO",
    textResponse: "",
    manualTranscript: "",
    transcriptionStatus: "UNAVAILABLE",
    evaluation: evaluateTechnicalEnglishText(""),
    feedback: buildTechnicalEnglishFeedback(evaluateTechnicalEnglishText(""), "FLUENCY_MODE"),
    audioReference: { id: "audio-ref", displayName: "response.webm", mimeType: "audio/webm", size: 12, storedAt: 1_500, durationMs: 8_000, verificationStatus: "UNVERIFIED" },
  });
  const evidence = technicalEnglishEvidenceFromAttempt(attempt);
  assert.equal(evidence.evidenceType, "AUDIO_RESPONSE");
  assert.equal(evidence.verificationStatus, "UNVERIFIED");
  assert.equal(evidence.evaluationResult.outcome, "ENCOUNTERED");
  assert.equal(evidence.evaluationResult.feedbackStatus, "UNAVAILABLE_NO_TRANSCRIPT");
});

test("scenario G: manual transcript is linked and enables deterministic concept feedback", () => {
  const transcript = "First I import the CSV, select the comma delimiter, and verify separate columns in the preview.";
  const evaluation = evaluateTechnicalEnglishText(transcript);
  const evidence = technicalEnglishEvidenceFromAttempt(completedAttempt({
    modality: "AUDIO",
    textResponse: "",
    manualTranscript: transcript,
    transcriptionStatus: "MANUAL_AVAILABLE",
    evaluation,
    feedback: buildTechnicalEnglishFeedback(evaluation, "ACCURACY_MODE"),
    audioReference: { id: "audio-manual", displayName: "response.webm", mimeType: "audio/webm", size: 12, storedAt: 1_500, durationMs: 8_000, verificationStatus: "UNVERIFIED" },
  }));
  assert.equal(evidence.evaluationResult.transcriptionStatus, "MANUAL_AVAILABLE");
  assert.equal(evidence.evaluationResult.feedbackStatus, "AVAILABLE");
  assert.ok(evidence.evaluationResult.technicalConceptCoverage.found.includes("delimiter"));
});

test("scenario H: fluency feedback never exceeds three corrections", () => {
  const feedback = buildTechnicalEnglishFeedback(evaluateTechnicalEnglishText("I explain this problem now with a simple example for my project manager today."), "FLUENCY_MODE");
  assert.ok(feedback.corrections.length <= MAX_FLUENCY_CORRECTIONS);
});

test("scenario I: text fallback creates distinct traceable evidence and practiced competency", () => {
  const evidence = technicalEnglishEvidenceFromAttempt(completedAttempt());
  const competency = deriveCompetencyRecord("TECHNICAL_ENGLISH_EXPLANATION", [evidence]);
  assert.equal(evidence.evidenceType, "TEXT_RESPONSE");
  assert.equal(evidence.verificationStatus, "VALID");
  assert.equal(competency.status, "PRACTICED");
  assert.deepEqual(competency.supportingEvidenceIds, [evidence.id]);
});

test("scenario J: T-0012 runtime contains no network call", () => {
  const root = path.resolve(process.cwd(), "src");
  const files = [
    "modules/technical-english/core.ts",
    "modules/technical-english/audio-store.ts",
    "modules/technical-english/browser-store.ts",
    "modules/technical-english/startup.ts",
    "components/technical-english/AudioResponse.tsx",
    "components/technical-english/TechnicalEnglishWorkspace.tsx",
    "components/technical-english/TechnicalEnglishRecordBridge.tsx",
  ];
  const source = files.map((file: string) => fs.readFileSync(path.join(root, file), "utf8")).join("\n");
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|WebSocket|https?:\/\//);
});

test("incomplete technical response creates conservative error memory but no premature review item", () => {
  const text = "I check the file and I can open it now.";
  const evaluation = evaluateTechnicalEnglishText(text);
  const attempt = completedAttempt({ textResponse: text, evaluation, feedback: buildTechnicalEnglishFeedback(evaluation, "FLUENCY_MODE") });
  const evidence = technicalEnglishEvidenceFromAttempt(attempt);
  const signals = technicalEnglishErrorSignals(attempt, [evidence.id]);
  const patterns = mergeErrorPatterns([], signals);
  assert.equal(patterns.length, 1);
  assert.equal(patterns[0].concept, "TECHNICAL_CSV_EXPLANATION");
  assert.deepEqual(generateReviewItems([], patterns, 3_000), []);
});

test("rebuilding the expanded competency map preserves Technical English without inventing professional or academic progress", () => {
  const technicalEvidence = technicalEnglishEvidenceFromAttempt(completedAttempt());
  const competencies = rebuildCompetencies([technicalEvidence]);
  assert.equal(competencies.length, 9);
  assert.equal(competencies.find((item: { competencyId: string }) => item.competencyId === "TECHNICAL_ENGLISH_EXPLANATION").status, "PRACTICED");
  assert.equal(competencies.find((item: { competencyId: string }) => item.competencyId === "DAILY_ENGLISH_GUIDED_PRACTICE").status, "NOT_SEEN");
  assert.equal(competencies.find((item: { competencyId: string }) => item.competencyId === "DATA_ANOMALY_IDENTIFICATION").status, "NOT_SEEN");
  assert.equal(competencies.find((item: { competencyId: string }) => item.competencyId === "NETWORK_FUNDAMENTALS").status, "NOT_SEEN");
});

test("valid English technical explanation confirms language, content and competency evidence", () => {
  const text = "If a CSV opens in one column, I first check the delimiter used during import.";
  const evaluation = evaluateTechnicalEnglishText(text);
  assert.equal(evaluation.languageStatus, "TARGET_LANGUAGE_CONFIRMED");
  assert.equal(evaluation.contentStatus, "SUFFICIENT");
  assert.equal(evaluation.competencyEvidenceStatus, "VALID");
});

test("French unrelated transcript is invalid evidence and cannot promote Technical English", () => {
  const text = "Je teste mon interface et je veux mon propre OS.";
  const evaluation = evaluateTechnicalEnglishText(text);
  const attempt = completedAttempt({ modality: "AUDIO", textResponse: "", manualTranscript: text, transcriptionStatus: "MANUAL_AVAILABLE", evaluation, audioReference: { id: "french-audio", displayName: "french.webm", mimeType: "audio/webm", size: 12, storedAt: 1_500, durationMs: 29_000, verificationStatus: "UNVERIFIED" } });
  const evidence = technicalEnglishEvidenceFromAttempt(attempt);
  assert.equal(evaluation.languageStatus, "TARGET_LANGUAGE_NOT_CONFIRMED");
  assert.equal(evaluation.contentStatus, "INSUFFICIENT");
  assert.equal(evidence.evaluationResult.competencyEvidenceStatus, "INVALID");
  assert.equal(evidence.verificationStatus, "INVALID");
  assert.equal(deriveCompetencyRecord("TECHNICAL_ENGLISH_EXPLANATION", [evidence]).status, "NOT_SEEN");
  assert.deepEqual(technicalEnglishErrorSignals(attempt, [evidence.id]), []);
});

test("English unrelated response confirms language but invalidates technical content", () => {
  const evaluation = evaluateTechnicalEnglishText("I really like this application and I am testing the interface.");
  assert.equal(evaluation.languageStatus, "TARGET_LANGUAGE_CONFIRMED");
  assert.equal(evaluation.contentStatus, "INSUFFICIENT");
  assert.equal(evaluation.competencyEvidenceStatus, "INVALID");
});

test("French technical vocabulary does not validate an English competency", () => {
  const evaluation = evaluateTechnicalEnglishText("Je vérifie le délimiteur et l'import du CSV.");
  assert.equal(evaluation.languageStatus, "TARGET_LANGUAGE_NOT_CONFIRMED");
  assert.ok(evaluation.foundConcepts.includes("delimiter"));
  assert.equal(evaluation.competencyEvidenceStatus, "INVALID");
});

test("audio-only attempt remains recorded but language and content stay unevaluated", () => {
  const evidence = technicalEnglishEvidenceFromAttempt(completedAttempt({
    modality: "AUDIO",
    textResponse: "",
    manualTranscript: "",
    transcriptionStatus: "UNAVAILABLE",
    evaluation: evaluateTechnicalEnglishText(""),
    audioReference: { id: "audio-only", displayName: "audio.webm", mimeType: "audio/webm", size: 12, storedAt: 1_500, durationMs: 20_000, verificationStatus: "UNVERIFIED" },
  }));
  assert.equal(evidence.evaluationResult.captureStatus, "VALID");
  assert.equal(evidence.evaluationResult.languageStatus, "UNKNOWN");
  assert.equal(evidence.evaluationResult.contentStatus, "UNKNOWN");
  assert.equal(evidence.evaluationResult.competencyEvidenceStatus, "UNEVALUATED");
  assert.equal(evidence.verificationStatus, "UNVERIFIED");
});

test("short keyword stuffing cannot create strong competency evidence", () => {
  const evaluation = evaluateTechnicalEnglishText("CSV delimiter column import.");
  assert.notEqual(evaluation.contentStatus, "SUFFICIENT");
  assert.notEqual(evaluation.competencyEvidenceStatus, "VALID");
  assert.equal(evaluation.passed, false);
});

test("a meaningful paraphrase can pass without every expected keyword", () => {
  const evaluation = evaluateTechnicalEnglishText("When Excel shows all the data in one field, I would choose the correct separator while opening the file so each value appears separately.");
  assert.equal(evaluation.languageStatus, "TARGET_LANGUAGE_CONFIRMED");
  assert.equal(evaluation.contentStatus, "SUFFICIENT");
  assert.equal(evaluation.competencyEvidenceStatus, "VALID");
  assert.ok(evaluation.missingConcepts.length >= 1);
});

test("copying the prompt verbatim is not a successful explanation", () => {
  const evaluation = evaluateTechnicalEnglishText("Explain in English what you should check when a CSV opens in one column in Excel.");
  assert.notEqual(evaluation.contentStatus, "SUFFICIENT");
  assert.notEqual(evaluation.competencyEvidenceStatus, "VALID");
});

test("historical evidence is reclassified in place without deleting the attempt identity", () => {
  const valid = technicalEnglishEvidenceFromAttempt(completedAttempt());
  const frenchText = "Je teste mon interface et je veux mon propre OS.";
  const reclassified = technicalEnglishEvidenceFromAttempt(completedAttempt({ textResponse: frenchText, evaluation: evaluateTechnicalEnglishText(frenchText) }));
  const evidence = upsertEvidence([valid], [reclassified]);
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].id, valid.id);
  assert.equal(evidence[0].verificationStatus, "INVALID");
  assert.equal(deriveCompetencyRecord("TECHNICAL_ENGLISH_EXPLANATION", evidence).status, "NOT_SEEN");
});
