"use client";

import { useEffect } from "react";
import { useLearningRecordStore } from "@/modules/learning-records/browser-store";
import { useReviewEngineStore } from "@/modules/review-engine/browser-store";
import { useVisualLearningStore } from "@/modules/visual-learning/browser-store";
import { visualErrorSignals, visualEvidenceFromAttempt } from "@/modules/visual-learning/integration";
import { osiVisualReconstruction } from "@/modules/visual-learning/osi-model-definition";

export function VisualLearningRecordBridge() {
  const attempts = useVisualLearningStore((state) => state.attempts);
  const visualHydrated = useVisualLearningStore((state) => state.hydrated);
  const markVisualHydrated = useVisualLearningStore((state) => state.markHydrated);
  const recordsHydrated = useLearningRecordStore((state) => state.hydrated);
  const evidence = useLearningRecordStore((state) => state.evidence);
  const addEvidenceRecords = useLearningRecordStore((state) => state.addEvidenceRecords);
  const reviewHydrated = useReviewEngineStore((state) => state.hydrated);
  const addErrorSignalsAndSchedule = useReviewEngineStore((state) => state.addErrorSignalsAndSchedule);

  useEffect(() => {
    void Promise.resolve(useVisualLearningStore.persist.rehydrate()).then(markVisualHydrated);
  }, [markVisualHydrated]);

  useEffect(() => {
    if (!visualHydrated || !recordsHydrated) return;
    const records = Object.values(attempts).flatMap((attempt) => visualEvidenceFromAttempt(attempt, osiVisualReconstruction));
    if (records.length) addEvidenceRecords(records);
  }, [addEvidenceRecords, attempts, recordsHydrated, visualHydrated]);

  useEffect(() => {
    if (!visualHydrated || !recordsHydrated || !reviewHydrated) return;
    const evidenceIds = evidence.map((record) => record.id);
    const signals = Object.values(attempts).flatMap((attempt) => visualErrorSignals(attempt, osiVisualReconstruction, evidenceIds));
    if (signals.length) addErrorSignalsAndSchedule(signals);
  }, [addErrorSignalsAndSchedule, attempts, evidence, recordsHydrated, reviewHydrated, visualHydrated]);

  return null;
}
