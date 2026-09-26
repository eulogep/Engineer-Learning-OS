/* eslint-disable @typescript-eslint/no-require-imports -- Node strip-types test runner */
import type { NotebookLMSourceBundle, NotebookLMTask } from "../../../src/modules/notebooklm/types.ts";
import type { DataClassification, SourceRecord } from "../../../src/modules/source-engine/types.ts";
const assert = require("node:assert/strict");
const test = require("node:test");
const {
  approveNotebookLMTask,
  beginManualNotebookLMTask,
  completeNotebookLMTask,
  containsSensitiveNotebookLMMetadata,
  createNotebookLMDerivedArtifact,
  createNotebookLMTask,
  legacyExecutionAllowed,
  mergeNotebookLMState,
  notebookLMArtifactCanPromoteCompetency,
  notebookLMDegradedMode,
  traceNotebookLMArtifact,
  validateImportedNotebookLMQuiz,
  validateNotebookLMSourceBundle,
} = require("../../../src/modules/notebooklm/core.ts");
const { resolveNotebookLMPromptTemplate } = require("../../../src/modules/notebooklm/prompt-library.ts");

function source(classification: DataClassification = "PUBLIC", overrides: Partial<SourceRecord> = {}): SourceRecord {
  return {
    schemaVersion: 1,
    materialKind: "ORIGINAL_SOURCE",
    id: "SOURCE-1",
    title: "Source réseau synthétique",
    sourceType: "MARKDOWN",
    domain: "Informatique",
    subject: "Réseaux",
    originalPathOrReference: "fixture/networking.md",
    classification,
    origin: "Fixture locale",
    author: null,
    publisher: null,
    createdAt: null,
    updatedAt: null,
    language: "fr",
    licenseStatus: "KNOWN",
    copyrightStatus: "KNOWN",
    trust: { authority: "OFFICIAL", verification: "VERIFIED", pedagogicalRelevance: "HIGH" },
    freshness: "CURRENT",
    status: "VERIFIED",
    tags: ["réseau"],
    conceptIds: ["OSI_MODEL"],
    competencyIds: ["NETWORK_FUNDAMENTALS"],
    missionIds: [],
    notes: ["Fixture synthétique."],
    provenance: { catalogReference: null, extractedFields: ["title"], inferredFields: [] },
    ...overrides,
  };
}

function bundle(classification: DataClassification = "PUBLIC", overrides: Partial<NotebookLMSourceBundle> = {}): NotebookLMSourceBundle {
  return {
    schemaVersion: 1,
    id: "BUNDLE-1",
    title: "Bundle réseau",
    purpose: "Apprentissage local",
    sourceIds: ["SOURCE-1"],
    classification,
    allowedExternalUse: "ALLOWED",
    copyrightStatus: "KNOWN",
    authorizationStatus: "NOT_REQUIRED",
    notes: [],
    ...overrides,
  };
}

function taskInput(): Omit<NotebookLMTask, "schemaVersion" | "authorizationStatus" | "status" | "externalUseApproved" | "artifactIds"> {
  return {
    id: "TASK-1",
    taskType: "QUIZ",
    sourceBundleId: "BUNDLE-1",
    subjectId: "NETWORKING",
    conceptIds: ["OSI_MODEL"],
    purpose: "Créer un quiz sourcé",
    executionMode: "MANUAL_ASSISTED",
    createdAt: "2026-08-24T10:00:00.000Z",
    promptTemplateId: "academic-quiz-v1",
    preparedPrompt: resolveNotebookLMPromptTemplate("academic-quiz-v1").body,
    activeFollowup: { required: true, label: "Quiz local", href: "/subjects/networking" },
    notes: [],
  };
}

function inProgressTask() {
  return beginManualNotebookLMTask(createNotebookLMTask(taskInput(), bundle(), [source()]));
}

function artifact() {
  return createNotebookLMDerivedArtifact({ id: "ARTIFACT-1", task: inProgressTask(), bundle: bundle(), title: "Quiz déclaré", localReference: "Notebook réseau", createdAt: "2026-08-24T10:05:00.000Z" });
}

test("A. PUBLIC bundle is allowed without approval", () => assert.equal(validateNotebookLMSourceBundle(bundle(), [source()]).allowed, true));
test("B. TRAINING_SYNTHETIC bundle is allowed", () => assert.equal(validateNotebookLMSourceBundle(bundle("TRAINING_SYNTHETIC"), [source("TRAINING_SYNTHETIC")]).allowed, true));
test("C. ACADEMIC_PERSONAL_USE requires explicit learner approval", () => {
  const academic = bundle("ACADEMIC_PERSONAL_USE", { allowedExternalUse: "REQUIRES_EXPLICIT_LEARNER_APPROVAL", copyrightStatus: "UNKNOWN" });
  assert.equal(validateNotebookLMSourceBundle(academic, [source("ACADEMIC_PERSONAL_USE", { copyrightStatus: "UNKNOWN" })]).requiresExplicitApproval, true);
  assert.equal(validateNotebookLMSourceBundle(academic, [source("ACADEMIC_PERSONAL_USE", { copyrightStatus: "UNKNOWN" })], true).allowed, true);
});
test("D. PERSONAL bundle is blocked", () => assert.equal(validateNotebookLMSourceBundle(bundle("PERSONAL"), [source("PERSONAL")]).allowed, false));
test("E. COMPANY_INTERNAL bundle is blocked", () => assert.equal(validateNotebookLMSourceBundle(bundle("COMPANY_INTERNAL"), [source("COMPANY_INTERNAL")]).allowed, false));
test("F. COMPANY_RESTRICTED bundle is blocked", () => assert.equal(validateNotebookLMSourceBundle(bundle("COMPANY_RESTRICTED"), [source("COMPANY_RESTRICTED")]).allowed, false));
test("G. UNKNOWN bundle is blocked", () => assert.equal(validateNotebookLMSourceBundle(bundle("UNKNOWN"), [source("UNKNOWN")]).allowed, false));
test("H. task creation produces a provider-agnostic READY task", () => assert.equal(createNotebookLMTask(taskInput(), bundle(), [source()]).status, "READY"));
test("I. human approval transitions an academic task to READY", () => {
  const academic = bundle("ACADEMIC_PERSONAL_USE", { allowedExternalUse: "REQUIRES_EXPLICIT_LEARNER_APPROVAL", copyrightStatus: "UNKNOWN" });
  const sources = [source("ACADEMIC_PERSONAL_USE", { copyrightStatus: "UNKNOWN" })];
  const waiting = createNotebookLMTask({ ...taskInput(), sourceBundleId: academic.id }, academic, sources);
  assert.equal(approveNotebookLMTask(waiting, academic, sources, true).status, "READY");
});
test("J. task cannot bypass approval", () => {
  const academic = bundle("ACADEMIC_PERSONAL_USE", { allowedExternalUse: "REQUIRES_EXPLICIT_LEARNER_APPROVAL", copyrightStatus: "UNKNOWN" });
  const waiting = createNotebookLMTask({ ...taskInput(), sourceBundleId: academic.id }, academic, [source("ACADEMIC_PERSONAL_USE", { copyrightStatus: "UNKNOWN" })]);
  assert.throws(() => beginManualNotebookLMTask(waiting), /NOT_READY/);
});
test("K. stable prompt template resolves", () => assert.equal(resolveNotebookLMPromptTemplate("academic-quiz-v1").taskType, "QUIZ"));
test("L. NotebookLM output creates a DERIVED artifact", () => assert.equal(artifact().materialKind, "DERIVED_MATERIAL"));
test("M. NotebookLM artifact is never canonical", () => assert.equal(artifact().canonical, false));
test("N. artifact traceability resolves task, bundle and source", () => {
  const task = inProgressTask();
  const derived = createNotebookLMDerivedArtifact({ id: "ARTIFACT-1", task, bundle: bundle(), title: "Quiz", localReference: null, createdAt: "2026-08-24T10:05:00.000Z" });
  const completed = completeNotebookLMTask(task, derived);
  assert.equal(traceNotebookLMArtifact(derived, completed, bundle(), [source()]).valid, true);
});
test("O. artifact alone cannot promote competency", () => assert.equal(notebookLMArtifactCanPromoteCompetency(artifact()), false));
test("P. active-learning follow-up is mandatory", () => assert.equal(createNotebookLMTask(taskInput(), bundle(), [source()]).activeFollowup.required, true));
test("Q. degraded mode preserves local learning", () => assert.match(notebookLMDegradedMode(false).message, /local learning mode/));
test("R. legacy automation requires explicit approval", () => {
  const legacy = { ...createNotebookLMTask(taskInput(), bundle(), [source()]), executionMode: "LEGACY_CONTROLLED", authorizationStatus: "HUMAN_APPROVED" };
  assert.equal(legacyExecutionAllowed(legacy, false), false);
  assert.equal(legacyExecutionAllowed(legacy, true), true);
});
test("S. persisted model contains no API key, cookie or credential field", () => {
  const snapshot = JSON.stringify({ schemaVersion: 1, tasks: { "TASK-1": inProgressTask() }, artifacts: { "ARTIFACT-1": artifact() } });
  assert.doesNotMatch(snapshot, /api[_-]?key|cookie|credential|access[_-]?token/i);
  assert.equal(containsSensitiveNotebookLMMetadata("api_key=forbidden"), true);
  assert.throws(() => createNotebookLMDerivedArtifact({ id: "BLOCKED", task: inProgressTask(), bundle: bundle(), title: "access token", localReference: null, createdAt: "2026-08-24T10:05:00.000Z" }), /SENSITIVE_ARTIFACT_METADATA_BLOCKED/);
});
test("T. state merge is idempotent by task and artifact id", () => {
  const task = inProgressTask();
  const derived = artifact();
  const snapshot = { schemaVersion: 1, tasks: { [task.id]: task }, artifacts: { [derived.id]: derived } };
  const merged = mergeNotebookLMState(snapshot, snapshot);
  assert.equal(Object.keys(merged.tasks).length, 1);
  assert.equal(Object.keys(merged.artifacts).length, 1);
});
test("U. imported quiz remains DERIVED_UNVERIFIED until source support is checked", () => {
  const invalid = validateImportedNotebookLMQuiz([{ id: "Q1", prompt: "Couche IP ?", answer: "Réseau", artifactId: "A1", sourceBundleId: "B1", sourceIds: ["SOURCE-1"], conceptIds: ["OSI_MODEL"], verificationStatus: "DERIVED_UNVERIFIED", sourceSupportConfirmed: false }]);
  assert.equal(invalid.valid, false);
});
