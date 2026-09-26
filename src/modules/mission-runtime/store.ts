"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  activateMissionActivity,
  createMissionAttempt,
  elapsedMissionAttempt,
  pauseMissionAttempt,
  resumeMissionAttempt,
  sanitizeHydratedMissionAttempt,
  suspendMissionActivity,
} from "./attempt-state";
import { evaluateMissionStep } from "./evaluate";
import type { EvidenceMetadata, MissionAttempt, MissionDefinition, MissionEvent, MissionFeedback } from "./types";

type RuntimeState = {
  hydrated: boolean;
  attempts: Record<string, MissionAttempt>;
  drafts: Record<string, string>;
  markHydrated: () => void;
  prepare: (mission: MissionDefinition) => void;
  start: (mission: MissionDefinition) => void;
  viewStep: (mission: MissionDefinition) => void;
  pause: (mission: MissionDefinition) => void;
  resume: (mission: MissionDefinition) => void;
  suspendActivity: (mission: MissionDefinition) => void;
  activateActivity: (mission: MissionDefinition) => void;
  setDraft: (missionId: string, value: string) => void;
  submit: (mission: MissionDefinition, responseOverride?: string) => void;
  submitEvidence: (mission: MissionDefinition, metadata: EvidenceMetadata) => void;
  retry: (mission: MissionDefinition) => void;
  showHint: (mission: MissionDefinition) => void;
  continueStep: (mission: MissionDefinition) => void;
  reset: (mission: MissionDefinition) => void;
};

const NASA_MISSION_RUNTIME_NAMESPACE = "engineer-learning-os:mission-runtime:v2";

const nowEvent = (type: MissionEvent["type"], stepId?: string, value?: number, at = Date.now()): MissionEvent => ({ type, at, stepId, value });

function currentAttempt(state: RuntimeState, mission: MissionDefinition) {
  const saved = state.attempts[mission.id];
  return saved?.missionVersion === mission.version ? saved : createMissionAttempt(mission);
}

export const useMissionRuntimeStore = create<RuntimeState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      attempts: {},
      drafts: {},
      markHydrated: () => set((state) => ({
        hydrated: true,
        attempts: Object.fromEntries(
          Object.entries(state.attempts).map(([missionId, attempt]) => [missionId, sanitizeHydratedMissionAttempt(attempt)]),
        ),
      })),
      prepare: (mission) => set((state) => {
        const existing = state.attempts[mission.id];
        if (existing?.missionVersion === mission.version) return state;
        return { attempts: { ...state.attempts, [mission.id]: createMissionAttempt(mission) } };
      }),
      start: (mission) => set((state) => {
        const attempt = currentAttempt(state, mission);
        if (attempt.status !== "READY") return state;
        const at = Date.now();
        return {
          attempts: {
            ...state.attempts,
            [mission.id]: {
              ...attempt,
              status: "IN_PROGRESS",
              startedAt: at,
              activeSince: at,
              events: [...attempt.events, nowEvent("TIME_TO_START_LEARNING", undefined, at - attempt.createdAt, at), nowEvent("MISSION_STARTED", undefined, undefined, at)],
            },
          },
        };
      }),
      viewStep: (mission) => set((state) => {
        const attempt = currentAttempt(state, mission);
        if (attempt.status !== "IN_PROGRESS") return state;
        const step = mission.steps[attempt.currentStepIndex];
        if (attempt.events.some((event) => event.type === "STEP_VIEWED" && event.stepId === step.id)) return state;
        return { attempts: { ...state.attempts, [mission.id]: { ...attempt, events: [...attempt.events, nowEvent("STEP_VIEWED", step.id)] } } };
      }),
      pause: (mission) => set((state) => {
        const attempt = currentAttempt(state, mission);
        return { attempts: { ...state.attempts, [mission.id]: pauseMissionAttempt(attempt) } };
      }),
      resume: (mission) => set((state) => {
        const attempt = currentAttempt(state, mission);
        return { attempts: { ...state.attempts, [mission.id]: resumeMissionAttempt(attempt) } };
      }),
      suspendActivity: (mission) => set((state) => {
        const attempt = currentAttempt(state, mission);
        const suspended = suspendMissionActivity(attempt);
        if (suspended === attempt) return state;
        return { attempts: { ...state.attempts, [mission.id]: suspended } };
      }),
      activateActivity: (mission) => set((state) => {
        const attempt = currentAttempt(state, mission);
        const activated = activateMissionActivity(attempt);
        if (activated === attempt) return state;
        return { attempts: { ...state.attempts, [mission.id]: activated } };
      }),
      setDraft: (missionId, draft) => set((state) => ({ drafts: { ...state.drafts, [missionId]: draft } })),
      submit: (mission, responseOverride) => {
        const state = get();
        const attempt = currentAttempt(state, mission);
        if (attempt.status !== "IN_PROGRESS") return;
        const step = mission.steps[attempt.currentStepIndex];
        const response = responseOverride ?? state.drafts[mission.id] ?? "";
        const attemptNumber = (attempt.attempts[step.id] ?? 0) + 1;
        const result = evaluateMissionStep(step, response, attemptNumber);
        const outcomeEvent = result.correct ? "ANSWER_CORRECT" : "ANSWER_INCORRECT";
        const extraEvents: MissionEvent[] = step.kind === "self_assessment"
          ? [nowEvent("SELF_EVALUATION_SUBMITTED", step.id, Number(response))]
          : [];
        set({
          attempts: {
            ...state.attempts,
            [mission.id]: {
              ...attempt,
              responses: { ...attempt.responses, [step.id]: response },
              attempts: { ...attempt.attempts, [step.id]: attemptNumber },
              feedback: { ...attempt.feedback, [step.id]: result },
              events: [...attempt.events, nowEvent("ANSWER_SUBMITTED", step.id, attemptNumber), nowEvent(outcomeEvent, step.id, attemptNumber), ...extraEvents],
            },
          },
        });
      },
      submitEvidence: (mission, metadata) => {
        const state = get();
        const attempt = currentAttempt(state, mission);
        if (attempt.status !== "IN_PROGRESS") return;
        const step = mission.steps[attempt.currentStepIndex];
        const attemptNumber = (attempt.attempts[step.id] ?? 0) + 1;
        const result = evaluateMissionStep(step, metadata.id, attemptNumber);
        set({
          attempts: {
            ...state.attempts,
            [mission.id]: {
              ...attempt,
              responses: { ...attempt.responses, [step.id]: metadata.id },
              evidence: { ...attempt.evidence, [step.id]: metadata },
              attempts: { ...attempt.attempts, [step.id]: attemptNumber },
              feedback: { ...attempt.feedback, [step.id]: result },
              events: [...attempt.events, nowEvent("EVIDENCE_SUBMITTED", step.id, metadata.size), nowEvent("ANSWER_SUBMITTED", step.id, attemptNumber), nowEvent("ANSWER_CORRECT", step.id, attemptNumber)],
            },
          },
        });
      },
      retry: (mission) => set((state) => {
        const attempt = currentAttempt(state, mission);
        const step = mission.steps[attempt.currentStepIndex];
        const feedback = { ...attempt.feedback };
        delete feedback[step.id];
        return {
          drafts: { ...state.drafts, [mission.id]: "" },
          attempts: { ...state.attempts, [mission.id]: { ...attempt, feedback, events: [...attempt.events, nowEvent("RETRY", step.id)] } },
        };
      }),
      showHint: (mission) => set((state) => {
        const attempt = currentAttempt(state, mission);
        if (attempt.status !== "IN_PROGRESS") return state;
        const step = mission.steps[attempt.currentStepIndex];
        const current = attempt.hintsUsed[step.id] ?? 0;
        const attemptCount = attempt.attempts[step.id] ?? 0;
        if (current >= (step.hints?.length ?? 0) || (current > 0 && attemptCount < current)) return state;
        return { attempts: { ...state.attempts, [mission.id]: { ...attempt, hintsUsed: { ...attempt.hintsUsed, [step.id]: current + 1 }, events: [...attempt.events, nowEvent("HINT_USED", step.id, current + 1)] } } };
      }),
      continueStep: (mission) => set((state) => {
        const attempt = currentAttempt(state, mission);
        const step = mission.steps[attempt.currentStepIndex];
        const result: MissionFeedback | undefined = attempt.feedback[step.id];
        if (!result?.correct) return state;
        const completed = Array.from(new Set([...attempt.completedStepIds, step.id]));
        const last = attempt.currentStepIndex === mission.steps.length - 1;
        const at = Date.now();
        return {
          drafts: { ...state.drafts, [mission.id]: "" },
          attempts: {
            ...state.attempts,
            [mission.id]: {
              ...attempt,
              status: last ? "COMPLETED" : "IN_PROGRESS",
              currentStepIndex: last ? attempt.currentStepIndex : attempt.currentStepIndex + 1,
              completedStepIds: completed,
              elapsedMs: last ? elapsedMissionAttempt(attempt, at) : attempt.elapsedMs,
              activeSince: last ? null : attempt.activeSince,
              completedAt: last ? at : null,
              events: [...attempt.events, nowEvent("STEP_COMPLETE", step.id, undefined, at), ...(last ? [nowEvent("MISSION_COMPLETED", undefined, undefined, at)] : [])],
            },
          },
        };
      }),
      reset: (mission) => set((state) => ({
        drafts: { ...state.drafts, [mission.id]: "" },
        attempts: { ...state.attempts, [mission.id]: createMissionAttempt(mission) },
      })),
    }),
    {
      name: NASA_MISSION_RUNTIME_NAMESPACE,
      skipHydration: true,
      partialize: ({ attempts, drafts }) => ({ attempts, drafts }),
    },
  ),
);
