"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { applyNotebookLMProviderResult, approveNotebookLMTask, beginManualNotebookLMTask, completeNotebookLMTask, containsSensitiveNotebookLMMetadata, createNotebookLMDerivedArtifact, createRecoveredNotebookLMDerivedArtifact, prepareExplicitAutomationRetry, recordNotebookLMArtifactRegistered, startNotebookLMAutomation, upsertRecoveredNotebookLMArtifact } from "./core";
import { NotebookLMGuard } from "./guard";
import { LegacyNotebookLMAutomationProvider } from "./legacy-provider";
import { createPilotTransferManifest, networkingNotebookLMBundle, notebookLMPilotSources, notebookLMPilotTasks, notebookLMPromptHashes } from "./pilot-registry";
import { createNotebookLMRestoreCoordinator, migrateNotebookLMPersistedState, NOTEBOOKLM_STORE_VERSION, settleNotebookLMRestore } from "./local-restore";
import { attachNotebookLMQuizCandidates } from "./quiz-candidates";
import type { NotebookLMAutomationPlan, NotebookLMDerivedArtifact, NotebookLMTask } from "./types";

type NotebookLMStore = {
  tasks: Record<string, NotebookLMTask>;
  artifacts: Record<string, NotebookLMDerivedArtifact>;
  plans: Record<string, NotebookLMAutomationPlan>;
  restoreWarning: string | null;
  preparePilot: () => void;
  approve: (taskId: string, explicitApproval: boolean) => void;
  requestAutomation: (taskId: string) => Promise<void>;
  resumeAutomation: (taskId: string) => Promise<void>;
  prepareAutomationRetry: (taskId: string) => void;
  beginManual: (taskId: string) => void;
  registerArtifact: (taskId: string, title: string, reference: string, at?: number, id?: string) => void;
};

const pilotTasksById = Object.fromEntries(notebookLMPilotTasks.map((task) => [task.id, task]));
const guard = new NotebookLMGuard();
const legacyProvider = new LegacyNotebookLMAutomationProvider();
const automationInFlight = new Set<string>();
let lastHydrationError: unknown = null;

function reconcilePilotTask(pilot: NotebookLMTask, existing?: NotebookLMTask): NotebookLMTask {
  if (!existing) return pilot;
  return {
    ...pilot,
    ...existing,
    artifactIds: existing.artifactIds ?? [],
    automationEvents: existing.automationEvents ?? [],
  };
}

export const useNotebookLMStore = create<NotebookLMStore>()(persist((set, get) => ({
  tasks: {},
  artifacts: {},
  plans: {},
  restoreWarning: null,
  preparePilot: () => set((state) => ({
    tasks: {
      ...state.tasks,
      ...Object.fromEntries(Object.values(pilotTasksById).map((pilot) => [pilot.id, reconcilePilotTask(pilot, state.tasks[pilot.id])])),
    },
  })),
  approve: (taskId, explicitApproval) => set((state) => {
    const task = state.tasks[taskId];
    if (!task) return state;
    return { tasks: { ...state.tasks, [taskId]: approveNotebookLMTask(task, networkingNotebookLMBundle, notebookLMPilotSources, explicitApproval, new Date().toISOString()) } };
  }),
  requestAutomation: async (taskId) => {
    if (automationInFlight.has(taskId)) return;
    const task = get().tasks[taskId];
    if (!task || task.status !== "READY") return;
    automationInFlight.add(taskId);
    try {
      const at = new Date().toISOString();
      const plan = guard.createExecutionPlan({ task, bundle: networkingNotebookLMBundle, sources: notebookLMPilotSources, manifest: createPilotTransferManifest(task), providerId: legacyProvider.id, notebookTitle: "ELOS — Networking — OSI TCP-IP Foundations", promptHash: notebookLMPromptHashes[task.promptTemplateId], createdAt: at, forceNewArtifact: task.forceNewArtifact });
      set((state) => ({ plans: { ...state.plans, [plan.id]: plan }, tasks: { ...state.tasks, [taskId]: startNotebookLMAutomation(state.tasks[taskId], plan, at) } }));
      const result = await legacyProvider.prepareTask(plan);
      set((state) => {
        const updated = applyNotebookLMProviderResult(state.tasks[taskId], result, new Date().toISOString());
        if (result.status !== "SUCCESS" || !result.artifact) return { tasks: { ...state.tasks, [taskId]: updated } };
        const existing = Object.values(state.artifacts).find((artifact) => artifact.providerArtifactRef === result.artifact?.providerArtifactRef);
        const artifact = attachNotebookLMQuizCandidates(createRecoveredNotebookLMDerivedArtifact({ id: existing?.id ?? `notebooklm:${globalThis.crypto.randomUUID()}`, task: updated, bundle: networkingNotebookLMBundle, result, createdAt: new Date().toISOString() }));
        const artifacts = upsertRecoveredNotebookLMArtifact(state.artifacts, artifact);
        const completed = completeNotebookLMTask(updated, artifacts[artifact.id]);
        const registered = recordNotebookLMArtifactRegistered(completed, artifacts[artifact.id], new Date().toISOString());
        return { artifacts, tasks: { ...state.tasks, [taskId]: registered } };
      });
    } finally {
      automationInFlight.delete(taskId);
    }
  },
  resumeAutomation: async (taskId) => {
    const task = get().tasks[taskId];
    if (!task || task.status !== "HUMAN_LOGIN_REQUIRED") return;
    set((state) => ({ tasks: { ...state.tasks, [taskId]: prepareExplicitAutomationRetry(state.tasks[taskId]) } }));
    await get().requestAutomation(taskId);
  },
  prepareAutomationRetry: (taskId) => set((state) => {
    const task = state.tasks[taskId];
    if (!task) return state;
    return { tasks: { ...state.tasks, [taskId]: prepareExplicitAutomationRetry(task) } };
  }),
  beginManual: (taskId) => set((state) => {
    const task = state.tasks[taskId];
    if (!task) return state;
    return { tasks: { ...state.tasks, [taskId]: beginManualNotebookLMTask(task) } };
  }),
  registerArtifact: (taskId, title, reference, at = Date.now(), id = globalThis.crypto.randomUUID()) => set((state) => {
    const task = state.tasks[taskId];
    if (!task || !title.trim() || containsSensitiveNotebookLMMetadata(title, reference)) return state;
    const artifact = createNotebookLMDerivedArtifact({ id: `notebooklm:${id}`, task, bundle: networkingNotebookLMBundle, title, localReference: reference, createdAt: new Date(at).toISOString() });
    return {
      tasks: { ...state.tasks, [taskId]: recordNotebookLMArtifactRegistered(completeNotebookLMTask(task, artifact), artifact, new Date(at).toISOString()) },
      artifacts: { ...state.artifacts, [artifact.id]: artifact },
    };
  }),
}), {
  name: "engineer-learning-os:notebooklm:v1",
  skipHydration: true,
  version: NOTEBOOKLM_STORE_VERSION,
  migrate: (persisted) => persisted as NotebookLMStore,
  merge: (persisted, current) => {
    const migrated = migrateNotebookLMPersistedState(persisted);
    return {
      ...current,
      ...migrated.state,
      restoreWarning: migrated.quarantinedRecords > 0 ? "LOCAL_RECORDS_QUARANTINED" : null,
    };
  },
  onRehydrateStorage: () => (_state, error) => {
    lastHydrationError = error ?? null;
  },
  partialize: ({ tasks, artifacts, plans }) => ({ tasks, artifacts, plans }),
}));

const coordinatedRestore = createNotebookLMRestoreCoordinator(() => settleNotebookLMRestore(async () => {
  if (typeof window === "undefined") throw new Error("BROWSER_STORAGE_UNAVAILABLE");
  lastHydrationError = null;
  await useNotebookLMStore.persist.rehydrate();
  if (lastHydrationError) throw new Error("LOCAL_RESTORE_FAILED");
  useNotebookLMStore.getState().preparePilot();
}));

export function restoreNotebookLMStore() {
  return coordinatedRestore();
}
