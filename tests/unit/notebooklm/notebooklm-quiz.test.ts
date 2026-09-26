import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecoveredNotebookLMDerivedArtifact,
  notebookLMArtifactCanPromoteCompetency,
  prepareExplicitAutomationRetry,
  upsertRecoveredNotebookLMArtifact,
} from "../../../src/modules/notebooklm/core.ts";
import { attachNotebookLMQuizCandidates, normalizeNotebookLMQuizCandidates } from "../../../src/modules/notebooklm/quiz-candidates.ts";
import type { NotebookLMDerivedArtifact, NotebookLMSourceBundle, NotebookLMTask } from "../../../src/modules/notebooklm/types.ts";

const context = { artifactId: "QUIZ-A1", sourceBundleId: "BUNDLE-1", conceptIds: ["OSI"] };
const syntheticBundle: NotebookLMSourceBundle = {
  schemaVersion: 1,
  id: "BUNDLE-1",
  title: "Fixture réseau synthétique",
  purpose: "Tests",
  sourceIds: ["SOURCE-1"],
  classification: "TRAINING_SYNTHETIC",
  allowedExternalUse: "ALLOWED",
  copyrightStatus: "KNOWN",
  authorizationStatus: "NOT_REQUIRED",
  notes: [],
};
const validJson = JSON.stringify([
  { question: "À quelle couche appartient IP ?", choices: ["Réseau", "Transport", "Application"], answer: "A", explanation: "IP appartient à la couche réseau.", sourceRefs: ["page 18"] },
  { question: "Que fait l'encapsulation ?", choices: ["Ajoute des en-têtes", "Supprime le réseau"], answer: "Ajoute des en-têtes" },
]);

function runningTask(taskType: "QUIZ" | "STUDY_GUIDE" = "QUIZ"): NotebookLMTask {
  return {
    schemaVersion: 1,
    id: taskType === "QUIZ" ? "QUIZ-TASK" : "GUIDE-TASK",
    taskType,
    sourceBundleId: syntheticBundle.id,
    subjectId: "SUBJECT-NETWORKING",
    conceptIds: ["OSI"],
    purpose: "Fixture synthétique",
    executionMode: "LEGACY_CONTROLLED",
    authorizationStatus: "HUMAN_APPROVED",
    createdAt: "2026-08-27T00:00:00.000Z",
    status: "AUTOMATION_RUNNING",
    promptTemplateId: taskType === "QUIZ" ? "academic-quiz-v1" : "academic-study-guide-v1",
    preparedPrompt: "Fixture synthétique.",
    externalUseApproved: true,
    artifactIds: [],
    activeFollowup: { required: true, label: "Continuer", href: "/learn" },
    approvedAt: "2026-08-27T00:00:00.000Z",
    automationEvents: [],
    notes: [],
  };
}

function recovered(taskType: "QUIZ" | "STUDY_GUIDE" = "QUIZ", providerRef = "provider:quiz:1", content = validJson) {
  return attachNotebookLMQuizCandidates(createRecoveredNotebookLMDerivedArtifact({
    id: providerRef,
    task: runningTask(taskType),
    bundle: syntheticBundle,
    result: {
      status: "SUCCESS",
      providerNotebookRef: "provider:notebook:existing",
      artifact: {
        title: taskType === "QUIZ" ? "Quiz" : "Study Guide",
        providerArtifactRef: providerRef,
        recoveryMode: taskType === "QUIZ" ? "STRUCTURED_EXTRACT" : "TEXT_EXTRACT",
        recoveredContent: content,
      },
    },
    createdAt: "2026-08-27T00:05:00.000Z",
  }));
}

test("A. Quiz and Study Guide tasks reuse the same source bundle mapping", () => {
  assert.equal(runningTask("QUIZ").sourceBundleId, runningTask("STUDY_GUIDE").sourceBundleId);
});

test("E. structured Quiz recovery normalizes questions, choices and answers", () => {
  const artifact = recovered();
  assert.equal(artifact.quizCandidates?.length, 2);
  assert.equal(artifact.quizCandidates?.[0].answer, "Réseau");
  assert.equal(artifact.quizCandidates?.[0].sourceSupport, "PROVIDER_CITED");
});

test("F. malformed question is excluded from active Quiz", () => {
  const result = normalizeNotebookLMQuizCandidates(JSON.stringify([{ question: "", choices: ["A"], answer: "" }]), context);
  assert.equal(result.candidates[0].validForActiveQuiz, false);
});

test("G. duplicate question is retained diagnostically but excluded", () => {
  const content = JSON.stringify([{ question: "OSI ?", answer: "Oui" }, { question: "OSI ?", answer: "Oui" }]);
  const result = normalizeNotebookLMQuizCandidates(content, context);
  assert.equal(result.candidates[1].diagnostics.includes("DUPLICATE_QUESTION"), true);
  assert.equal(result.candidates[1].validForActiveQuiz, false);
});

test("H. missing citation remains explicitly unverified", () => {
  const result = normalizeNotebookLMQuizCandidates(JSON.stringify([{ question: "OSI ?", answer: "Oui" }]), context);
  assert.equal(result.candidates[0].sourceSupport, "UNVERIFIED");
  assert.equal(result.candidates[0].verificationStatus, "DERIVED_UNVERIFIED");
});

test("I. Quiz artifact remains derived and non-canonical", () => {
  const artifact = recovered();
  assert.equal(artifact.canonical, false);
  assert.equal(artifact.verificationStatus, "UNVERIFIED");
});

test("J. generation creates no Evidence", () => {
  assert.equal("evidence" in recovered(), false);
});

test("K. generation cannot promote competency", () => {
  assert.equal(notebookLMArtifactCanPromoteCompetency(recovered()), false);
});

test("L. recovered Quiz state contains no regeneration side effect", () => {
  const artifact = recovered();
  assert.equal("requestAutomation" in artifact, false);
});

test("M. explicit regeneration may preserve a distinct provider artifact", () => {
  const retry = prepareExplicitAutomationRetry({ ...runningTask(), status: "COMPLETED" });
  assert.equal(retry.forceNewArtifact, true);
  const first = recovered("QUIZ", "provider:quiz:1");
  const second = recovered("QUIZ", "provider:quiz:2");
  const artifacts = upsertRecoveredNotebookLMArtifact(upsertRecoveredNotebookLMArtifact({}, first), second);
  assert.equal(Object.keys(artifacts).length, 2);
});

test("failed Quiz retry remains resume-aware rather than forcing regeneration", () => {
  const retry = prepareExplicitAutomationRetry({ ...runningTask(), status: "AUTOMATION_FAILED" });
  assert.equal(retry.forceNewArtifact, false);
});

test("N. Study Guide recovery remains unchanged", () => {
  const guide = recovered("STUDY_GUIDE", "provider:guide:1", "A".repeat(600));
  assert.equal(guide.recoveryMode, "TEXT_EXTRACT");
  assert.equal(guide.quizCandidates, undefined);
});

test("same provider Quiz discovery remains one artifact", () => {
  const first = recovered("QUIZ", "provider:quiz:1");
  const duplicate = { ...first, id: "duplicate" } as NotebookLMDerivedArtifact;
  const artifacts = upsertRecoveredNotebookLMArtifact(upsertRecoveredNotebookLMArtifact({}, first), duplicate);
  assert.equal(Object.keys(artifacts).length, 1);
});

export {};
