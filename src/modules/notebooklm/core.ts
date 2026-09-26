import type { SourceRecord } from "../source-engine/types";
import type {
  BundleAuthorizationResult,
  ImportedNotebookLMQuestion,
  NotebookLMAutomationPlan,
  NotebookLMProviderResult,
  NotebookLMDerivedArtifact,
  NotebookLMSourceBundle,
  NotebookLMStateSnapshot,
  NotebookLMTask,
} from "./types";

const blockedClassifications = new Set(["PERSONAL", "COMPANY_INTERNAL", "COMPANY_RESTRICTED", "UNKNOWN"]);
const sensitiveMetadata = /(?:api[_-]?key|password|passwd|secret|credential|private[_ -]?key|token)/i;

export function containsSensitiveNotebookLMMetadata(...values: Array<string | null | undefined>) {
  return sensitiveMetadata.test(values.filter(Boolean).join(" "));
}

export function validateNotebookLMSourceBundle(
  bundle: NotebookLMSourceBundle,
  registrySources: SourceRecord[],
  explicitLearnerApproval = false,
): BundleAuthorizationResult {
  const sourceById = new Map(registrySources.map((source) => [source.id, source]));
  const sources = bundle.sourceIds.map((id) => sourceById.get(id)).filter((source): source is SourceRecord => Boolean(source));
  const reasons: string[] = [];
  if (bundle.sourceIds.length === 0) reasons.push("SOURCE_BUNDLE_EMPTY");
  if (sources.length !== bundle.sourceIds.length) reasons.push("SOURCE_NOT_FOUND");
  if (new Set(bundle.sourceIds).size !== bundle.sourceIds.length) reasons.push("DUPLICATE_SOURCE");
  if (blockedClassifications.has(bundle.classification)) reasons.push(`CLASSIFICATION_BLOCKED:${bundle.classification}`);
  if (sources.some((source) => source.classification !== bundle.classification)) reasons.push("CLASSIFICATION_MISMATCH");
  if (sources.some((source) => blockedClassifications.has(source.classification))) reasons.push("SOURCE_CLASSIFICATION_BLOCKED");
  if (bundle.allowedExternalUse === "BLOCKED") reasons.push("EXTERNAL_USE_BLOCKED");
  if (bundle.copyrightStatus === "RESTRICTED" || sources.some((source) => source.copyrightStatus === "RESTRICTED")) reasons.push("COPYRIGHT_RESTRICTED");
  if (sources.some((source) => sensitiveMetadata.test([source.title, source.origin, ...source.notes].join(" ")))) reasons.push("SENSITIVE_METADATA_DETECTED");

  const requiresExplicitApproval = bundle.classification === "ACADEMIC_PERSONAL_USE"
    || bundle.allowedExternalUse === "REQUIRES_EXPLICIT_LEARNER_APPROVAL"
    || bundle.copyrightStatus === "UNKNOWN";
  if (requiresExplicitApproval && !explicitLearnerApproval) reasons.push("EXPLICIT_LEARNER_APPROVAL_REQUIRED");
  return { allowed: reasons.length === 0, requiresExplicitApproval, reasons, sources };
}

export function createNotebookLMTask(
  input: Omit<NotebookLMTask, "schemaVersion" | "authorizationStatus" | "status" | "externalUseApproved" | "artifactIds">,
  bundle: NotebookLMSourceBundle,
  sources: SourceRecord[],
): NotebookLMTask {
  const authorization = validateNotebookLMSourceBundle(bundle, sources);
  const hardBlock = authorization.reasons.some((reason) => reason !== "EXPLICIT_LEARNER_APPROVAL_REQUIRED");
  if (hardBlock) throw new Error(`NOTEBOOKLM_SOURCE_BUNDLE_BLOCKED:${authorization.reasons.join(",")}`);
  const waiting = authorization.requiresExplicitApproval;
  return {
    ...input,
    schemaVersion: 1,
    authorizationStatus: waiting ? "WAITING_FOR_APPROVAL" : "NOT_REQUIRED",
    status: waiting ? "WAITING_FOR_APPROVAL" : "READY",
    externalUseApproved: !waiting,
    artifactIds: [],
  };
}

export function approveNotebookLMTask(task: NotebookLMTask, bundle: NotebookLMSourceBundle, sources: SourceRecord[], explicitApproval: boolean, approvedAt = task.createdAt) {
  if (!explicitApproval || task.status !== "WAITING_FOR_APPROVAL") throw new Error("EXPLICIT_HUMAN_APPROVAL_REQUIRED");
  const authorization = validateNotebookLMSourceBundle(bundle, sources, true);
  if (!authorization.allowed) throw new Error(`NOTEBOOKLM_SOURCE_BUNDLE_BLOCKED:${authorization.reasons.join(",")}`);
  return { ...task, authorizationStatus: "HUMAN_APPROVED" as const, externalUseApproved: true, approvedAt, status: "READY" as const };
}

export function beginManualNotebookLMTask(task: NotebookLMTask) {
  const fallbackStatus = task.status === "READY" || task.status === "AUTOMATION_FAILED" || task.status === "HUMAN_LOGIN_REQUIRED";
  if (!fallbackStatus || !task.externalUseApproved) throw new Error("NOTEBOOKLM_TASK_NOT_READY");
  return { ...task, status: "IN_PROGRESS" as const, automationFailure: task.automationFailure ?? null };
}

export function startNotebookLMAutomation(task: NotebookLMTask, plan: NotebookLMAutomationPlan, at: string) {
  if (task.status !== "READY" || !task.externalUseApproved || task.id !== plan.taskId) throw new Error("NOTEBOOKLM_AUTOMATION_NOT_READY");
  if (task.automationPlanId === plan.id || task.automationEvents?.some((event) => event.type === "AUTOMATION_STARTED" && event.detailCode === plan.id)) throw new Error("NOTEBOOKLM_AUTOMATION_ALREADY_STARTED");
  return { ...task, status: "AUTOMATION_RUNNING" as const, automationPlanId: plan.id, automationFailure: null, automationEvents: [...(task.automationEvents ?? []), { type: "AUTOMATION_STARTED" as const, at, detailCode: plan.id }] };
}

export function applyNotebookLMProviderResult(task: NotebookLMTask, result: NotebookLMProviderResult, at: string) {
  if (task.status !== "AUTOMATION_RUNNING") throw new Error("NOTEBOOKLM_AUTOMATION_NOT_RUNNING");
  if (result.status === "HUMAN_LOGIN_REQUIRED") return { ...task, status: "HUMAN_LOGIN_REQUIRED" as const, automationFailure: result.detailCode ?? "HUMAN_LOGIN_REQUIRED", automationEvents: [...(task.automationEvents ?? []), { type: "HUMAN_LOGIN_REQUIRED" as const, at, detailCode: result.detailCode }] };
  if (result.status === "CANCELLED") return { ...task, status: "CANCELLED" as const, automationEvents: [...(task.automationEvents ?? []), { type: "AUTOMATION_CANCELLED" as const, at }] };
  if (result.status === "AUTOMATION_FAILED") return { ...task, status: "AUTOMATION_FAILED" as const, automationFailure: result.detailCode ?? "AUTOMATION_FAILED", automationEvents: [...(task.automationEvents ?? []), { type: "AUTOMATION_FAILED" as const, at, detailCode: result.detailCode }] };
  return { ...task, automationEvents: [...(task.automationEvents ?? []), ...(result.events ?? [])] };
}

export function prepareExplicitAutomationRetry(task: NotebookLMTask) {
  if (!task.externalUseApproved || !["AUTOMATION_FAILED", "HUMAN_LOGIN_REQUIRED", "COMPLETED", "IN_PROGRESS"].includes(task.status)) throw new Error("NOTEBOOKLM_AUTOMATION_RETRY_NOT_ALLOWED");
  return { ...task, status: "READY" as const, automationPlanId: undefined, automationFailure: null, forceNewArtifact: task.status === "COMPLETED" };
}

export function createNotebookLMDerivedArtifact(input: { id: string; task: NotebookLMTask; bundle: NotebookLMSourceBundle; title: string; localReference: string | null; createdAt: string }): NotebookLMDerivedArtifact {
  if (input.task.status !== "IN_PROGRESS") throw new Error("NOTEBOOKLM_TASK_NOT_IN_PROGRESS");
  if (containsSensitiveNotebookLMMetadata(input.title, input.localReference)) throw new Error("SENSITIVE_ARTIFACT_METADATA_BLOCKED");
  return {
    schemaVersion: 1,
    materialKind: "DERIVED_MATERIAL",
    canonical: false,
    id: input.id,
    type: input.task.taskType,
    title: input.title.trim(),
    sourceIds: [...input.bundle.sourceIds],
    sourceBundleId: input.bundle.id,
    conceptIds: [...input.task.conceptIds],
    createdAt: input.createdAt,
    generationMethod: "NOTEBOOKLM",
    generator: "NotebookLM — déclaration manuelle",
    verificationStatus: "UNVERIFIED",
    externalProvider: "NOTEBOOKLM",
    providerNotebookRef: null,
    providerArtifactRef: null,
    promptTemplateId: input.task.promptTemplateId,
    recoveryMode: "METADATA_ONLY",
    localReference: input.localReference?.trim() || null,
    notes: ["Métadonnée déclarée par l’apprenant; contenu non importé et non vérifié."],
  };
}

export function createRecoveredNotebookLMDerivedArtifact(input: { id: string; task: NotebookLMTask; bundle: NotebookLMSourceBundle; result: NotebookLMProviderResult; createdAt: string }): NotebookLMDerivedArtifact {
  if (input.task.status !== "AUTOMATION_RUNNING") throw new Error("NOTEBOOKLM_AUTOMATION_NOT_RUNNING");
  const recovered = input.result.artifact;
  if (input.result.status !== "SUCCESS" || !recovered || !input.result.providerNotebookRef) throw new Error("NOTEBOOKLM_RECOVERED_ARTIFACT_REQUIRED");
  if (containsSensitiveNotebookLMMetadata(recovered.title, recovered.providerArtifactRef)) throw new Error("SENSITIVE_ARTIFACT_METADATA_BLOCKED");
  return {
    schemaVersion: 1,
    materialKind: "DERIVED_MATERIAL",
    canonical: false,
    id: input.id,
    type: input.task.taskType,
    title: recovered.title.trim(),
    sourceIds: [...input.bundle.sourceIds],
    sourceBundleId: input.bundle.id,
    conceptIds: [...input.task.conceptIds],
    createdAt: input.createdAt,
    generationMethod: "NOTEBOOKLM",
    generator: "NotebookLM — skill legacy contrôlée",
    verificationStatus: "UNVERIFIED",
    externalProvider: "NOTEBOOKLM",
    providerNotebookRef: input.result.providerNotebookRef,
    providerArtifactRef: recovered.providerArtifactRef,
    promptTemplateId: input.task.promptTemplateId,
    recoveryMode: recovered.recoveryMode,
    recoveredContent: recovered.recoveredContent?.trim() || null,
    localReference: null,
    notes: ["Résultat récupéré automatiquement; dérivé, non canonique et non vérifié."],
  };
}

export function completeNotebookLMTask(task: NotebookLMTask, artifact: NotebookLMDerivedArtifact) {
  if (artifact.sourceBundleId !== task.sourceBundleId) throw new Error("ARTIFACT_TRACEABILITY_MISMATCH");
  return { ...task, status: "COMPLETED" as const, artifactIds: [...new Set([...task.artifactIds, artifact.id])] };
}

export function recordNotebookLMArtifactRegistered(task: NotebookLMTask, artifact: NotebookLMDerivedArtifact, at: string) {
  const detailCode = artifact.providerArtifactRef ?? artifact.id;
  if (task.automationEvents?.some((event) => event.type === "ARTIFACT_REGISTERED" && event.detailCode === detailCode)) return task;
  return {
    ...task,
    automationEvents: [...(task.automationEvents ?? []), { type: "ARTIFACT_REGISTERED" as const, at, detailCode }],
  };
}

export function notebookLMArtifactCanPromoteCompetency(_artifact: NotebookLMDerivedArtifact) { return false; }

export function upsertRecoveredNotebookLMArtifact(current: Record<string, NotebookLMDerivedArtifact>, incoming: NotebookLMDerivedArtifact) {
  const existing = Object.values(current).find((artifact) => incoming.providerArtifactRef && artifact.providerArtifactRef === incoming.providerArtifactRef);
  if (!existing) return { ...current, [incoming.id]: incoming };
  return { ...current, [existing.id]: { ...existing, ...incoming, id: existing.id } };
}

export function traceNotebookLMArtifact(artifact: NotebookLMDerivedArtifact, task: NotebookLMTask, bundle: NotebookLMSourceBundle, sources: SourceRecord[]) {
  const valid = task.artifactIds.includes(artifact.id)
    && artifact.sourceBundleId === task.sourceBundleId
    && task.sourceBundleId === bundle.id
    && artifact.sourceIds.every((id) => bundle.sourceIds.includes(id) && sources.some((source) => source.id === id));
  return { valid, artifactId: artifact.id, taskId: task.id, sourceBundleId: bundle.id, sourceIds: [...artifact.sourceIds] };
}

export function validateImportedNotebookLMQuiz(questions: ImportedNotebookLMQuestion[]) {
  const ids = new Set<string>();
  const errors: string[] = [];
  questions.forEach((question, index) => {
    if (!question.id || ids.has(question.id)) errors.push(`QUESTION_${index + 1}_DUPLICATE_OR_MISSING_ID`);
    ids.add(question.id);
    if (!question.prompt.trim() || !question.answer.trim()) errors.push(`QUESTION_${index + 1}_MALFORMED`);
    if (question.choices && (question.choices.length < 2 || new Set(question.choices).size !== question.choices.length)) errors.push(`QUESTION_${index + 1}_INVALID_CHOICES`);
    if (!question.sourceSupportConfirmed || question.sourceIds.length === 0) errors.push(`QUESTION_${index + 1}_SOURCE_SUPPORT_REQUIRED`);
    if (question.verificationStatus !== "DERIVED_UNVERIFIED") errors.push(`QUESTION_${index + 1}_INVALID_VERIFICATION_STATUS`);
  });
  return { valid: errors.length === 0, errors };
}

export function mergeNotebookLMState(current: NotebookLMStateSnapshot, incoming: NotebookLMStateSnapshot): NotebookLMStateSnapshot {
  return { schemaVersion: 1, tasks: { ...current.tasks, ...incoming.tasks }, artifacts: { ...current.artifacts, ...incoming.artifacts } };
}

export function notebookLMDegradedMode(available: boolean) {
  return available ? { degraded: false, message: null } : { degraded: true, message: "NotebookLM unavailable — continue with local learning mode" };
}

export function legacyExecutionAllowed(task: NotebookLMTask, explicitApproval: boolean) {
  return task.executionMode === "LEGACY_CONTROLLED" && task.authorizationStatus === "HUMAN_APPROVED" && explicitApproval;
}
