"use client";

import type { DailyMission, SpeakingSession, Word } from "@/types";
import {
  createLocalSession,
  loadOrCreateLocalMission,
  localProgressSummary,
  saveLocalSession,
  updateLocalMission,
  type KeyValueStorage,
  type MissionPersistence,
  type LocalProgressSummary,
  type WordReview,
} from "@/modules/daily-english/local-mission";

type MissionPatch = { personalSentences?: Record<string, string>; speakingSessionId?: string; completed?: boolean; reviews?: readonly WordReview[] };

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function loadTodayMission(): Promise<{ words: Word[]; mission: DailyMission; persistence: MissionPersistence }> {
  try {
    const res = await fetch("/api/daily-mission");
    if (res.ok) {
      const data = await res.json() as { words: Word[]; mission: DailyMission };
      if (Array.isArray(data.words) && data.words.length > 0 && data.mission) return { ...data, persistence: "server" };
    }
  } catch {
    // Network or server failure: fall through to the browser mode.
  }
  return { ...loadOrCreateLocalMission(browserStorage(), new Date(), newId), persistence: "browser" };
}

export async function updateMission(persistence: MissionPersistence, missionId: string, patch: MissionPatch): Promise<DailyMission> {
  if (persistence === "browser") return updateLocalMission(browserStorage(), missionId, patch);
  const res = await fetch("/api/daily-mission", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ missionId, ...patch }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || "Impossible de sauvegarder la mission");
  }
  return ((await res.json()) as { mission: DailyMission }).mission;
}

/** Speaking sessions without external transcription stay on this device. */
export function startLocalSession(transcription: string, durationSeconds: number): SpeakingSession {
  return saveLocalSession(browserStorage(), createLocalSession(transcription, durationSeconds, new Date(), newId));
}

export function storeLocalSession(session: SpeakingSession): SpeakingSession {
  return saveLocalSession(browserStorage(), session);
}

export function browserProgressSummary(): LocalProgressSummary {
  return localProgressSummary(browserStorage(), new Date());
}
