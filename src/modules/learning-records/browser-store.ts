"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MissionAttempt, MissionDefinition } from "@/modules/mission-runtime/types";
import { rebuildCompetencies, reconcileExcelAttempt, upsertEvidence } from "./core";
import type { CompetencyId, CompetencyRecord, EvidenceDeletionRecord, EvidenceRecord, LearningRecordEvent, LearningRecordEventType } from "./types";

type LearningRecordState = {
  hydrated: boolean;
  evidence: EvidenceRecord[];
  deletions: EvidenceDeletionRecord[];
  competencies: CompetencyRecord[];
  events: LearningRecordEvent[];
  markHydrated: () => void;
  syncExcelAttempt: (attempt: MissionAttempt, mission: MissionDefinition) => void;
  addEvidenceRecords: (records: EvidenceRecord[]) => void;
  removeEvidence: (evidenceId: string) => void;
  recordEvidenceViewed: (evidenceId: string) => void;
  recordCompetencyExplanationViewed: (competencyId: CompetencyId) => void;
};

function event(type: LearningRecordEventType, fields: Partial<LearningRecordEvent> = {}): LearningRecordEvent {
  const at = Date.now();
  return { id: `${type}:${at}:${globalThis.crypto.randomUUID()}`, type, at, ...fields };
}

export const useLearningRecordStore = create<LearningRecordState>()(
  persist(
    (set) => ({
      hydrated: false,
      evidence: [],
      deletions: [],
      competencies: [],
      events: [],
      markHydrated: () => set({ hydrated: true }),
      syncExcelAttempt: (attempt, mission) => set((state) => {
        const previousEvidenceIds = new Set(state.evidence.map((record) => record.id));
        const reconciled = reconcileExcelAttempt(state.evidence, attempt, mission);
        const competencies = rebuildCompetencies(reconciled.evidence);
        const created = reconciled.evidence.filter((record) => !previousEvidenceIds.has(record.id));
        const evidenceChanged = JSON.stringify(reconciled.evidence) !== JSON.stringify(state.evidence);
        const competencyChanged = JSON.stringify(competencies) !== JSON.stringify(state.competencies);
        if (!evidenceChanged && !competencyChanged) return state;
        return {
          evidence: reconciled.evidence,
          competencies,
          events: [
            ...state.events,
            ...created.map((record) => event("EVIDENCE_CREATED", { evidenceId: record.id })),
            ...(competencyChanged ? [event("COMPETENCY_STATE_UPDATED", { competencyId: "EXCEL_CSV_IMPORT" })] : []),
          ],
        };
      }),
      addEvidenceRecords: (records) => set((state) => {
        const previousIds = new Set(state.evidence.map((record) => record.id));
        const evidence = upsertEvidence(state.evidence, records);
        const created = evidence.filter((record) => !previousIds.has(record.id));
        const competencies = rebuildCompetencies(evidence);
        const evidenceChanged = JSON.stringify(evidence) !== JSON.stringify(state.evidence);
        const competencyChanged = JSON.stringify(competencies) !== JSON.stringify(state.competencies);
        if (!evidenceChanged && !competencyChanged) return state;
        return {
          evidence,
          competencies,
          events: [
            ...state.events,
            ...created.map((record) => event("EVIDENCE_CREATED", { evidenceId: record.id })),
            ...(competencyChanged ? competencies.map((record) => event("COMPETENCY_STATE_UPDATED", { competencyId: record.competencyId })) : []),
          ],
        };
      }),
      removeEvidence: (evidenceId) => set((state) => {
        if (!state.evidence.some((record) => record.id === evidenceId)) return state;
        const requestedAt = Date.now();
        const evidence = state.evidence.filter((record) => record.id !== evidenceId);
        return {
          evidence,
          competencies: rebuildCompetencies(evidence),
          deletions: [...state.deletions, {
            id: "evidence-deletion:" + evidenceId + ":" + requestedAt + ":" + globalThis.crypto.randomUUID(),
            evidenceId,
            requestedAt,
          }],
        };
      }),
      recordEvidenceViewed: (evidenceId) => set((state) => ({ events: [...state.events, event("EVIDENCE_VIEWED", { evidenceId })] })),
      recordCompetencyExplanationViewed: (competencyId) => set((state) => ({ events: [...state.events, event("COMPETENCY_EXPLANATION_VIEWED", { competencyId })] })),
    }),
    {
      name: "engineer-learning-os:learning-records:v1",
      skipHydration: true,
      partialize: ({ evidence, deletions, competencies, events }) => ({ evidence, deletions, competencies, events }),
    },
  ),
);
