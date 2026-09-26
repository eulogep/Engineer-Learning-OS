"use client";

import { useEffect, useMemo } from "react";
import { useMissionStore } from "@/lib/store";
import { dailyEnglishEvidenceFromMission } from "@/modules/daily-english/integration";
import { useLearningRecordStore } from "@/modules/learning-records/browser-store";

export function DailyEnglishRecordBridge() {
  const mission = useMissionStore((state) => state.mission);
  const recordsHydrated = useLearningRecordStore((state) => state.hydrated);
  const addEvidenceRecords = useLearningRecordStore((state) => state.addEvidenceRecords);
  const evidence = useMemo(() => dailyEnglishEvidenceFromMission(mission), [mission]);

  useEffect(() => {
    if (recordsHydrated && evidence) addEvidenceRecords([evidence]);
  }, [addEvidenceRecords, evidence, recordsHydrated]);

  return null;
}
