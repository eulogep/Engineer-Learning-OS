"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { completeHeldOutExcelAttempt, createHeldOutExcelAttempt, pauseHeldOutExcelAttempt, resumeHeldOutExcelAttempt, startHeldOutExcelAttempt, updateHeldOutExcelAnswers } from "./core";
import type { HeldOutExcelAnswers, HeldOutExcelAttempt, HeldOutExcelResult } from "./types";

type HeldOutExcelState = {
  hydrated: boolean;
  attempt: HeldOutExcelAttempt;
  markHydrated: () => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  update: (answers: Partial<HeldOutExcelAnswers>) => void;
  complete: (result: HeldOutExcelResult) => void;
  reset: () => void;
};

export const useHeldOutExcelStore = create<HeldOutExcelState>()(persist((set) => ({
  hydrated: false,
  attempt: createHeldOutExcelAttempt(),
  markHydrated: () => set({ hydrated: true }),
  start: () => set((state) => ({ attempt: startHeldOutExcelAttempt(state.attempt) })),
  pause: () => set((state) => ({ attempt: pauseHeldOutExcelAttempt(state.attempt) })),
  resume: () => set((state) => ({ attempt: resumeHeldOutExcelAttempt(state.attempt) })),
  update: (answers) => set((state) => ({ attempt: updateHeldOutExcelAnswers(state.attempt, answers) })),
  complete: (result) => set((state) => ({ attempt: completeHeldOutExcelAttempt(state.attempt, result) })),
  reset: () => set({ attempt: createHeldOutExcelAttempt() }),
}), {
  name: "engineer-learning-os:excel-held-out:v1",
  skipHydration: true,
  partialize: ({ attempt }) => ({ attempt }),
}));
