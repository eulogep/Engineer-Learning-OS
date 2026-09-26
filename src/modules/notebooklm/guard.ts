import { containsSensitiveNotebookLMMetadata, validateNotebookLMSourceBundle } from "./core.ts";
import type { SourceRecord } from "../source-engine/types";
import type { AuthorizedTransferManifest, NotebookLMAutomationPlan, NotebookLMSourceBundle, NotebookLMTask } from "./types";

const MAX_FILES = 3;
const MAX_TOTAL_SIZE_BYTES = 25 * 1024 * 1024;
const sha256Pattern = /^[A-F0-9]{64}$/i;
const unsafePathPattern = /(^[\\/])|(^[A-Za-z]:)|[*?]|(?:^|[\\/])\.\.(?:[\\/]|$)/;

export type NotebookLMGuardInput = {
  task: NotebookLMTask;
  bundle: NotebookLMSourceBundle;
  sources: SourceRecord[];
  manifest: AuthorizedTransferManifest;
  providerId: string;
  notebookTitle: string;
  promptHash: string;
  createdAt: string;
  forceNewArtifact?: boolean;
};

export class NotebookLMGuard {
  createExecutionPlan(input: NotebookLMGuardInput): Readonly<NotebookLMAutomationPlan> {
    const { task, bundle, sources, manifest } = input;
    const authorization = validateNotebookLMSourceBundle(bundle, sources, true);
    if (!authorization.allowed) throw new Error(`NOTEBOOKLM_GUARD_BUNDLE_BLOCKED:${authorization.reasons.join(",")}`);
    if (task.status !== "READY" || !task.externalUseApproved) throw new Error("NOTEBOOKLM_GUARD_TASK_NOT_APPROVED");
    if (task.authorizationStatus !== "HUMAN_APPROVED" && task.authorizationStatus !== "NOT_REQUIRED") throw new Error("NOTEBOOKLM_GUARD_AUTHORIZATION_MISSING");
    if (!task.approvedAt || manifest.approvedAt !== task.approvedAt) throw new Error("NOTEBOOKLM_GUARD_APPROVAL_MISMATCH");
    if (manifest.taskId !== task.id || manifest.bundleId !== bundle.id || task.sourceBundleId !== bundle.id) throw new Error("NOTEBOOKLM_GUARD_MANIFEST_SCOPE_MISMATCH");
    if (manifest.files.length === 0 || manifest.files.length > MAX_FILES) throw new Error("NOTEBOOKLM_GUARD_FILE_COUNT_BLOCKED");

    const bundleIds = new Set(bundle.sourceIds);
    const manifestIds = new Set(manifest.files.map((file) => file.sourceId));
    if (manifestIds.size !== manifest.files.length || manifestIds.size !== bundleIds.size || [...manifestIds].some((id) => !bundleIds.has(id))) throw new Error("NOTEBOOKLM_GUARD_EXPLICIT_FILE_MANIFEST_REQUIRED");
    if (manifest.files.some((file) => unsafePathPattern.test(file.relativePath))) throw new Error("NOTEBOOKLM_GUARD_UNSAFE_PATH");
    if (manifest.files.some((file) => !sha256Pattern.test(file.sha256) || file.sizeBytes <= 0)) throw new Error("NOTEBOOKLM_GUARD_FILE_INTEGRITY_REQUIRED");
    if (manifest.files.reduce((sum, file) => sum + file.sizeBytes, 0) > MAX_TOTAL_SIZE_BYTES) throw new Error("NOTEBOOKLM_GUARD_TOTAL_SIZE_BLOCKED");
    if (manifest.files.some((file) => file.classification !== bundle.classification)) throw new Error("NOTEBOOKLM_GUARD_CLASSIFICATION_MISMATCH");
    if (containsSensitiveNotebookLMMetadata(task.preparedPrompt, task.promptTemplateId, input.notebookTitle)) throw new Error("NOTEBOOKLM_GUARD_SENSITIVE_PROMPT_METADATA");
    if (!sha256Pattern.test(input.promptHash)) throw new Error("NOTEBOOKLM_GUARD_PROMPT_HASH_REQUIRED");
    if (task.taskType !== "STUDY_GUIDE" && task.taskType !== "QUIZ") throw new Error("NOTEBOOKLM_GUARD_ARTIFACT_TYPE_BLOCKED");

    const frozenFiles = manifest.files.map((file) => Object.freeze({ ...file }));
    const frozenManifest = Object.freeze({ ...manifest, files: Object.freeze(frozenFiles) });
    return Object.freeze({
      schemaVersion: 1,
      id: `automation:${task.id}:${input.createdAt}`,
      taskId: task.id,
      sourceBundleId: bundle.id,
      destination: "NOTEBOOKLM",
      providerId: input.providerId,
      notebookTitle: input.notebookTitle,
      artifactType: task.taskType,
      resolvedPrompt: task.preparedPrompt,
      promptTemplateId: task.promptTemplateId,
      promptHash: input.promptHash,
      manifest: frozenManifest,
      createdAt: input.createdAt,
      forceNewArtifact: input.forceNewArtifact === true,
    });
  }
}
