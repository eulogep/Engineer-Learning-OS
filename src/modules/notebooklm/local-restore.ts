import type { NotebookLMAutomationPlan, NotebookLMDerivedArtifact, NotebookLMTask } from "./types";

export const NOTEBOOKLM_STORE_VERSION = 3;
export type NotebookLMHydrationState = "NOT_STARTED" | "RESTORING" | "READY" | "FAILED";
export type NotebookLMPersistedState = {
  tasks: Record<string, NotebookLMTask>;
  artifacts: Record<string, NotebookLMDerivedArtifact>;
  plans: Record<string, NotebookLMAutomationPlan>;
};

const taskStatuses = new Set([
  "DRAFT", "WAITING_FOR_APPROVAL", "READY", "AUTOMATION_RUNNING", "AUTOMATION_FAILED",
  "HUMAN_LOGIN_REQUIRED", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string"))]
    : [];
}

function migrateTask(value: unknown): NotebookLMTask | null {
  const item = record(value);
  if (!item || typeof item.id !== "string" || typeof item.sourceBundleId !== "string") return null;
  if (typeof item.status !== "string" || !taskStatuses.has(item.status)) return null;
  return {
    ...item,
    schemaVersion: 1,
    taskType: typeof item.taskType === "string" ? item.taskType : "CUSTOM",
    subjectId: typeof item.subjectId === "string" ? item.subjectId : "UNKNOWN",
    conceptIds: strings(item.conceptIds),
    purpose: typeof item.purpose === "string" ? item.purpose : item.id,
    executionMode: typeof item.executionMode === "string" ? item.executionMode : "MANUAL_ASSISTED",
    authorizationStatus: typeof item.authorizationStatus === "string" ? item.authorizationStatus : "WAITING_FOR_APPROVAL",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "1970-01-01T00:00:00.000Z",
    promptTemplateId: typeof item.promptTemplateId === "string" ? item.promptTemplateId : "legacy",
    preparedPrompt: typeof item.preparedPrompt === "string" ? item.preparedPrompt : "",
    externalUseApproved: item.externalUseApproved === true,
    artifactIds: strings(item.artifactIds),
    activeFollowup: record(item.activeFollowup)
      ? item.activeFollowup as NotebookLMTask["activeFollowup"]
      : { required: true, label: "Continuer l'apprentissage", href: "/learn" },
    automationEvents: Array.isArray(item.automationEvents)
      ? item.automationEvents.filter((event) => {
          const candidate = record(event);
          return Boolean(candidate && typeof candidate.type === "string" && typeof candidate.at === "string");
        }) as NotebookLMTask["automationEvents"]
      : [],
    notes: strings(item.notes),
  } as NotebookLMTask;
}

function migrateArtifact(value: unknown): NotebookLMDerivedArtifact | null {
  const item = record(value);
  if (!item || typeof item.id !== "string" || typeof item.title !== "string" || typeof item.sourceBundleId !== "string") return null;
  return {
    ...item,
    sourceIds: strings(item.sourceIds),
    conceptIds: strings(item.conceptIds),
    notes: strings(item.notes),
  } as unknown as NotebookLMDerivedArtifact;
}

function migratePlan(value: unknown): NotebookLMAutomationPlan | null {
  const item = record(value);
  if (!item || typeof item.id !== "string" || typeof item.taskId !== "string" || typeof item.sourceBundleId !== "string") return null;
  return item as unknown as NotebookLMAutomationPlan;
}

export function migrateNotebookLMPersistedState(value: unknown): {
  state: NotebookLMPersistedState;
  quarantinedRecords: number;
} {
  const input = record(value) ?? {};
  let quarantinedRecords = record(value) ? 0 : 1;
  const artifacts: Record<string, NotebookLMDerivedArtifact> = {};
  const artifactAliases = new Map<string, string>();
  const providerArtifacts = new Map<string, string>();

  for (const [key, raw] of Object.entries(record(input.artifacts) ?? {})) {
    const artifact = migrateArtifact(raw);
    if (!artifact) {
      quarantinedRecords += 1;
      continue;
    }
    const providerKey = artifact.providerArtifactRef || null;
    const existingId = providerKey ? providerArtifacts.get(providerKey) : undefined;
    if (existingId) {
      artifacts[existingId] = { ...artifacts[existingId], ...artifact, id: existingId };
      artifactAliases.set(artifact.id, existingId);
      artifactAliases.set(key, existingId);
      continue;
    }
    artifacts[artifact.id] = artifact;
    artifactAliases.set(key, artifact.id);
    artifactAliases.set(artifact.id, artifact.id);
    if (providerKey) providerArtifacts.set(providerKey, artifact.id);
  }

  const tasks: Record<string, NotebookLMTask> = {};
  for (const raw of Object.values(record(input.tasks) ?? {})) {
    const task = migrateTask(raw);
    if (!task) {
      quarantinedRecords += 1;
      continue;
    }
    tasks[task.id] = {
      ...task,
      artifactIds: [...new Set(task.artifactIds.map((id) => artifactAliases.get(id) ?? id))],
    };
  }

  const plans: Record<string, NotebookLMAutomationPlan> = {};
  for (const raw of Object.values(record(input.plans) ?? {})) {
    const plan = migratePlan(raw);
    if (!plan) {
      quarantinedRecords += 1;
      continue;
    }
    plans[plan.id] = plan;
  }

  return { state: { tasks, artifacts, plans }, quarantinedRecords };
}

export async function settleNotebookLMRestore(
  rehydrate: () => void | Promise<void>,
  timeoutMs = 4_000,
): Promise<{ state: "READY" | "FAILED"; failureCode: string | null }> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(rehydrate),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("LOCAL_RESTORE_TIMEOUT")), timeoutMs);
      }),
    ]);
    return { state: "READY", failureCode: null };
  } catch (error) {
    return {
      state: "FAILED",
      failureCode: error instanceof Error && error.message === "LOCAL_RESTORE_TIMEOUT"
        ? "LOCAL_RESTORE_TIMEOUT"
        : "LOCAL_RESTORE_FAILED",
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createNotebookLMRestoreCoordinator<T>(run: () => Promise<T>) {
  let inFlight: Promise<T> | null = null;
  return () => {
    if (!inFlight) inFlight = run().finally(() => { inFlight = null; });
    return inFlight;
  };
}
