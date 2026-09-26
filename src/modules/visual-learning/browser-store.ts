"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { arrayMove } from "@dnd-kit/sortable";
import { createVisualAttempt, submitVisualAttempt } from "./core";
import type { VisualAttemptOrigin, VisualClassification, VisualLearningAttempt, VisualTaskDefinition } from "./types";

type VisualLearningState = {
  hydrated: boolean;
  activeAttemptId: string | null;
  attempts: Record<string, VisualLearningAttempt>;
  markHydrated: () => void;
  ensureAttempt: (definition: VisualTaskDefinition, origin?: VisualAttemptOrigin, at?: number) => void;
  startNewAttempt: (definition: VisualTaskDefinition, origin?: VisualAttemptOrigin, at?: number) => void;
  moveLayer: (activeId: string, overId: string, at?: number) => void;
  classifyLayer: (nodeId: string, classification: VisualClassification, at?: number) => void;
  submit: (definition: VisualTaskDefinition, at?: number) => void;
  showHint: (at?: number) => void;
  restartCurrent: (definition: VisualTaskDefinition, at?: number) => void;
};

function attemptId(at: number) {
  return `visual:${at}:${globalThis.crypto.randomUUID()}`;
}

export const useVisualLearningStore = create<VisualLearningState>()(
  persist(
    (set) => ({
      hydrated: false,
      activeAttemptId: null,
      attempts: {},
      markHydrated: () => set({ hydrated: true }),
      ensureAttempt: (definition, origin = null, at = Date.now()) => set((state) => {
        const active = state.activeAttemptId ? state.attempts[state.activeAttemptId] : null;
        const originChanged = origin && active?.origin?.originErrorPatternId !== origin.originErrorPatternId;
        if (active && !originChanged) return state;
        const attempt = createVisualAttempt(definition, attemptId(at), at, origin);
        return { activeAttemptId: attempt.id, attempts: { ...state.attempts, [attempt.id]: attempt } };
      }),
      startNewAttempt: (definition, origin = null, at = Date.now()) => set((state) => {
        const attempt = createVisualAttempt(definition, attemptId(at), at, origin);
        return { activeAttemptId: attempt.id, attempts: { ...state.attempts, [attempt.id]: attempt } };
      }),
      moveLayer: (activeId, overId, at = Date.now()) => set((state) => {
        const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : null;
        if (!attempt || attempt.status === "COMPLETED") return state;
        const from = attempt.order.indexOf(activeId);
        const to = attempt.order.indexOf(overId);
        if (from < 0 || to < 0 || from === to) return state;
        const updated = { ...attempt, order: arrayMove(attempt.order, from, to), lastEvaluation: null, updatedAt: at };
        return { attempts: { ...state.attempts, [attempt.id]: updated } };
      }),
      classifyLayer: (nodeId, classification, at = Date.now()) => set((state) => {
        const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : null;
        if (!attempt || attempt.status === "COMPLETED") return state;
        const updated = { ...attempt, classifications: { ...attempt.classifications, [nodeId]: classification }, lastEvaluation: null, updatedAt: at };
        return { attempts: { ...state.attempts, [attempt.id]: updated } };
      }),
      submit: (definition, at = Date.now()) => set((state) => {
        const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : null;
        if (!attempt || attempt.status === "COMPLETED") return state;
        const updated = submitVisualAttempt(attempt, definition, at);
        return { attempts: { ...state.attempts, [attempt.id]: updated } };
      }),
      showHint: (at = Date.now()) => set((state) => {
        const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : null;
        if (!attempt || attempt.status === "COMPLETED" || attempt.hintsUsed > 0) return state;
        const updated = { ...attempt, hintsUsed: 1, updatedAt: at };
        return { attempts: { ...state.attempts, [attempt.id]: updated } };
      }),
      restartCurrent: (definition, at = Date.now()) => set((state) => {
        const attempt = state.activeAttemptId ? state.attempts[state.activeAttemptId] : null;
        if (!attempt || attempt.status === "COMPLETED") return state;
        const updated = { ...attempt, order: [...definition.initialNodeOrder], classifications: {}, lastEvaluation: null, updatedAt: at };
        return { attempts: { ...state.attempts, [attempt.id]: updated } };
      }),
    }),
    {
      name: "engineer-learning-os:visual-learning:v1",
      skipHydration: true,
      partialize: ({ activeAttemptId, attempts }) => ({ activeAttemptId, attempts }),
    },
  ),
);
