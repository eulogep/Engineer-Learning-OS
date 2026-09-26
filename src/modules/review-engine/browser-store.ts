"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MissionAttempt } from "@/modules/mission-runtime/types";
import { applyReviewResult, detectExcelErrorSignals, evaluateReviewResponse, generateReviewItems, mergeErrorPatterns } from "./core";
import type { ErrorPattern, ErrorSignal, ReviewEvent, ReviewEventType, ReviewItem, ReviewResultRecord } from "./types";

type ReviewFeedback = { correct: boolean; message: string };

type ReviewEngineState = {
  hydrated: boolean;
  errorSignals: ErrorSignal[];
  errorPatterns: ErrorPattern[];
  reviewItems: ReviewItem[];
  results: ReviewResultRecord[];
  events: ReviewEvent[];
  activeItemId: string | null;
  startedAt: Record<string, number>;
  drafts: Record<string, string>;
  feedback: Record<string, ReviewFeedback>;
  retries: Record<string, number>;
  hints: Record<string, number>;
  markHydrated: () => void;
  syncExcelAttempt: (attempt: MissionAttempt, evidenceIds: string[], at?: number) => void;
  addErrorSignals: (signals: ErrorSignal[], at?: number) => void;
  addErrorSignalsAndSchedule: (signals: ErrorSignal[], at?: number) => void;
  startReview: (reviewItemId: string, at?: number) => void;
  setDraft: (reviewItemId: string, response: string) => void;
  submitAnswer: (reviewItemId: string, at?: number) => void;
  retry: (reviewItemId: string) => void;
  showHint: (reviewItemId: string) => void;
  finishReview: (reviewItemId: string, correct: boolean, confidence: number | null, at?: number) => ReviewResultRecord | null;
  clearActiveReview: () => void;
};

function event(type: ReviewEventType, fields: Partial<ReviewEvent> = {}, at = Date.now()): ReviewEvent {
  return { id: `${type}:${at}:${globalThis.crypto.randomUUID()}`, type, at, ...fields };
}

function mergeErrorSignalJournal(current: ErrorSignal[], incoming: ErrorSignal[]): ErrorSignal[] {
  const merged = new Map(current.map((signal) => [signal.id, signal]));
  for (const signal of incoming) {
    const prior = merged.get(signal.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(signal)) {
      throw new Error("Conflicting error signal identity.");
    }
    merged.set(signal.id, signal);
  }
  return [...merged.values()];
}

export const useReviewEngineStore = create<ReviewEngineState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      errorSignals: [],
      errorPatterns: [],
      reviewItems: [],
      results: [],
      events: [],
      activeItemId: null,
      startedAt: {},
      drafts: {},
      feedback: {},
      retries: {},
      hints: {},
      markHydrated: () => set({ hydrated: true }),
      syncExcelAttempt: (attempt, evidenceIds, at = Date.now()) => set((state) => {
        const signals = detectExcelErrorSignals(attempt, evidenceIds);
        if (signals.length === 0) return state;
        const errorSignals = mergeErrorSignalJournal(state.errorSignals, signals);
        const patterns = mergeErrorPatterns(state.errorPatterns, signals);
        const items = generateReviewItems(state.reviewItems, patterns, at);
        if (JSON.stringify(errorSignals) === JSON.stringify(state.errorSignals)
          && JSON.stringify(patterns) === JSON.stringify(state.errorPatterns)
          && JSON.stringify(items) === JSON.stringify(state.reviewItems)) return state;
        const oldPatternIds = new Set(state.errorPatterns.map((pattern) => pattern.id));
        const oldItemIds = new Set(state.reviewItems.map((item) => item.id));
        const changedPatterns = patterns.filter((pattern) => JSON.stringify(pattern) !== JSON.stringify(state.errorPatterns.find((prior) => prior.id === pattern.id)));
        return {
          errorSignals,
          errorPatterns: patterns,
          reviewItems: items,
          events: [
            ...state.events,
            ...changedPatterns.map((pattern) => event(oldPatternIds.has(pattern.id) ? "ERROR_PATTERN_UPDATED" : "ERROR_PATTERN_CREATED", { errorPatternId: pattern.id }, at)),
            ...items.filter((item) => !oldItemIds.has(item.id)).map((item) => event("REVIEW_ITEM_CREATED", { reviewItemId: item.id }, at)),
          ],
        };
      }),
      addErrorSignals: (signals, at = Date.now()) => set((state) => {
        if (signals.length === 0) return state;
        const errorSignals = mergeErrorSignalJournal(state.errorSignals, signals);
        const patterns = mergeErrorPatterns(state.errorPatterns, signals);
        if (JSON.stringify(errorSignals) === JSON.stringify(state.errorSignals)
          && JSON.stringify(patterns) === JSON.stringify(state.errorPatterns)) return state;
        const oldIds = new Set(state.errorPatterns.map((pattern) => pattern.id));
        const changed = patterns.filter((pattern) => JSON.stringify(pattern) !== JSON.stringify(state.errorPatterns.find((prior) => prior.id === pattern.id)));
        return {
          errorSignals,
          errorPatterns: patterns,
          events: [...state.events, ...changed.map((pattern) => event(oldIds.has(pattern.id) ? "ERROR_PATTERN_UPDATED" : "ERROR_PATTERN_CREATED", { errorPatternId: pattern.id }, at))],
        };
      }),
      addErrorSignalsAndSchedule: (signals, at = Date.now()) => set((state) => {
        if (signals.length === 0) return state;
        const errorSignals = mergeErrorSignalJournal(state.errorSignals, signals);
        const patterns = mergeErrorPatterns(state.errorPatterns, signals);
        const items = generateReviewItems(state.reviewItems, patterns, at);
        if (JSON.stringify(errorSignals) === JSON.stringify(state.errorSignals)
          && JSON.stringify(patterns) === JSON.stringify(state.errorPatterns)
          && JSON.stringify(items) === JSON.stringify(state.reviewItems)) return state;
        const oldPatternIds = new Set(state.errorPatterns.map((pattern) => pattern.id));
        const oldItemIds = new Set(state.reviewItems.map((item) => item.id));
        const changed = patterns.filter((pattern) => JSON.stringify(pattern) !== JSON.stringify(state.errorPatterns.find((prior) => prior.id === pattern.id)));
        return {
          errorSignals,
          errorPatterns: patterns,
          reviewItems: items,
          events: [
            ...state.events,
            ...changed.map((pattern) => event(oldPatternIds.has(pattern.id) ? "ERROR_PATTERN_UPDATED" : "ERROR_PATTERN_CREATED", { errorPatternId: pattern.id }, at)),
            ...items.filter((item) => !oldItemIds.has(item.id)).map((item) => event("REVIEW_ITEM_CREATED", { reviewItemId: item.id }, at)),
          ],
        };
      }),
      startReview: (reviewItemId, at = Date.now()) => set((state) => ({ activeItemId: reviewItemId, startedAt: { ...state.startedAt, [reviewItemId]: at }, events: [...state.events, event("REVIEW_STARTED", { reviewItemId }, at)] })),
      setDraft: (reviewItemId, response) => set((state) => ({ drafts: { ...state.drafts, [reviewItemId]: response } })),
      submitAnswer: (reviewItemId, at = Date.now()) => set((state) => {
        const item = state.reviewItems.find((candidate) => candidate.id === reviewItemId);
        if (!item) return state;
        const correct = evaluateReviewResponse(item, state.drafts[reviewItemId] ?? "");
        return { feedback: { ...state.feedback, [reviewItemId]: { correct, message: correct ? item.successFeedback : item.retryFeedback } }, events: [...state.events, event("REVIEW_ANSWER_SUBMITTED", { reviewItemId }, at)] };
      }),
      retry: (reviewItemId) => set((state) => {
        const feedback = { ...state.feedback };
        delete feedback[reviewItemId];
        return { feedback, drafts: { ...state.drafts, [reviewItemId]: "" }, retries: { ...state.retries, [reviewItemId]: (state.retries[reviewItemId] ?? 0) + 1 } };
      }),
      showHint: (reviewItemId) => set((state) => ({ hints: { ...state.hints, [reviewItemId]: Math.min(1, (state.hints[reviewItemId] ?? 0) + 1) } })),
      finishReview: (reviewItemId, correct, confidence, at = Date.now()) => {
        const state = get();
        const item = state.reviewItems.find((candidate) => candidate.id === reviewItemId);
        if (!item) return null;
        const result: ReviewResultRecord = {
          id: `${reviewItemId}:attempt:${item.attemptCount + 1}`,
          reviewItemId,
          competencyId: item.competencyId,
          sourceEvidenceIds: item.sourceEvidenceIds,
          correct,
          response: state.drafts[reviewItemId] ?? "",
          hintCount: state.hints[reviewItemId] ?? 0,
          retryCount: state.retries[reviewItemId] ?? 0,
          confidence,
          durationMs: state.startedAt[reviewItemId] ? Math.max(0, at - state.startedAt[reviewItemId]) : null,
          completedAt: at,
          sourceClassification: "PERSONAL",
        };
        const updated = applyReviewResult(item, state.errorPatterns, result);
        const improving = updated.errorPatterns.filter((pattern) => item.errorPatternIds.includes(pattern.id) && pattern.resolvedStatus === "IMPROVING");
        const resolved = updated.errorPatterns.filter((pattern) => item.errorPatternIds.includes(pattern.id) && pattern.resolvedStatus === "RESOLVED");
        set({
          reviewItems: state.reviewItems.map((candidate) => candidate.id === item.id ? updated.reviewItem : candidate),
          errorPatterns: updated.errorPatterns,
          results: [...state.results.filter((prior) => prior.id !== result.id), result],
          events: [
            ...state.events,
            event(correct ? "REVIEW_COMPLETED" : "REVIEW_FAILED", { reviewItemId }, at),
            event("REVIEW_RESCHEDULED", { reviewItemId }, at),
            ...improving.map((pattern) => event("ERROR_PATTERN_IMPROVING", { errorPatternId: pattern.id, reviewItemId }, at)),
            ...resolved.map((pattern) => event("ERROR_PATTERN_RESOLVED", { errorPatternId: pattern.id, reviewItemId }, at)),
          ],
          activeItemId: null,
          feedback: { ...state.feedback, [reviewItemId]: { correct, message: correct ? item.successFeedback : item.retryFeedback } },
        });
        return result;
      },
      clearActiveReview: () => set({ activeItemId: null }),
    }),
    {
      name: "engineer-learning-os:review-engine:v1",
      skipHydration: true,
      partialize: ({ errorSignals, errorPatterns, reviewItems, results, events }) => ({ errorSignals, errorPatterns, reviewItems, results, events }),
    },
  ),
);
