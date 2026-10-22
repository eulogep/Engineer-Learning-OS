import type { DailyMission, SpeakingSession } from "@/types";
import { readLocalState, writeLocalState, type KeyValueStorage, type LocalMissionState } from "./local-mission";
import type { ReviewState } from "./spaced-review";

/**
 * Backup of the browser-only Daily English state (review schedule, missions,
 * sessions). It contains the learner's own sentences, so it is only ever saved
 * to a file the learner downloads, never sent anywhere.
 */

export const BACKUP_FORMAT = "engineer-learning-os/daily-english";
export const BACKUP_VERSION = 2;

export type DailyEnglishBackup = Readonly<{
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  state: LocalMissionState;
}>;

export class BackupError extends Error {}

const isString = (value: unknown): value is string => typeof value === "string";
const isDay = (value: unknown): value is string => isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);

function validMission(value: unknown): value is DailyMission {
  const m = value as Partial<DailyMission> | null;
  return !!m && isString(m.id) && isString(m.date) && isString(m.wordIdsJson) && isString(m.personalSentencesJson)
    && typeof m.completed === "boolean" && (m.speakingSessionId === null || isString(m.speakingSessionId));
}

function validSession(value: unknown): value is SpeakingSession {
  const s = value as Partial<SpeakingSession> | null;
  return !!s && isString(s.id) && typeof s.repeated === "boolean" && (s.transcription === null || isString(s.transcription));
}

function validReview(value: unknown): value is ReviewState {
  const r = value as Partial<ReviewState> | null;
  return !!r && (r.lastReviewedDay === null || isDay(r.lastReviewedDay)) && (r.nextReviewDay === null || isDay(r.nextReviewDay));
}

/** Integrity guard for an imported state: every mission, session and review must be well-formed. */
function rosaireValidState(state: Partial<LocalMissionState> | undefined): state is LocalMissionState {
  return !!state && Array.isArray(state.missions) && Array.isArray(state.sessions)
    && typeof state.reviews === "object" && state.reviews !== null
    && state.missions.every(validMission) && state.sessions.every(validSession) && Object.values(state.reviews).every(validReview);
}

export function createBackup(storage: KeyValueStorage | null, now: Date): DailyEnglishBackup {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), state: readLocalState(storage) };
}

export function backupFilename(now: Date): string {
  return `daily-english-${now.toISOString().slice(0, 10)}.json`;
}

/** Strict parsing: an unknown or damaged file is rejected as a whole, never half-imported. */
export function parseBackup(text: string): DailyEnglishBackup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("Ce fichier n’est pas une sauvegarde lisible (JSON invalide).");
  }
  const backup = data as Partial<DailyEnglishBackup> | null;
  if (!backup || backup.format !== BACKUP_FORMAT) throw new BackupError("Ce fichier n’est pas une sauvegarde Daily English.");
  if (backup.version !== BACKUP_VERSION) throw new BackupError(`Version de sauvegarde non prise en charge (${String(backup.version)}).`);
  const state = backup.state as Partial<LocalMissionState> | undefined;
  if (!rosaireValidState(state)) {
    throw new BackupError("La sauvegarde est incomplète ou endommagée : rien n’a été importé.");
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: String(backup.exportedAt ?? ""), state: { version: 2, reviews: state.reviews, missions: state.missions, sessions: state.sessions } };
}

function laterReview(a: ReviewState | undefined, b: ReviewState): ReviewState {
  if (!a?.lastReviewedDay) return b;
  if (!b.lastReviewedDay) return a;
  return b.lastReviewedDay > a.lastReviewedDay ? b : a;
}

function mergeById<T extends { id: string }>(current: readonly T[], incoming: readonly T[], prefer: (a: T, b: T) => T): T[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, byId.has(item.id) ? prefer(byId.get(item.id) as T, item) : item);
  return [...byId.values()].sort((a, b) => String((a as { date?: unknown }).date ?? "").localeCompare(String((b as { date?: unknown }).date ?? "")));
}

/**
 * Merge, never overwrite: missions and sessions are united by id (a completed or
 * repeated version wins), and each word keeps its most recent review.
 */
export function mergeStates(current: LocalMissionState, incoming: LocalMissionState): LocalMissionState {
  const reviews: Record<string, ReviewState> = { ...current.reviews };
  for (const [wordId, review] of Object.entries(incoming.reviews)) reviews[wordId] = laterReview(reviews[wordId], review);
  return {
    version: 2,
    reviews,
    missions: mergeById(current.missions, incoming.missions, (a, b) => (b.completed && !a.completed ? b : a)),
    sessions: mergeById(current.sessions, incoming.sessions, (a, b) => (b.repeated && !a.repeated ? b : a)),
  };
}

export type ImportSummary = Readonly<{ missions: number; completed: number; wordsScheduled: number }>;

export function importBackup(storage: KeyValueStorage | null, text: string): ImportSummary {
  const backup = parseBackup(text);
  const merged = mergeStates(readLocalState(storage), backup.state);
  writeLocalState(storage, merged);
  return {
    missions: merged.missions.length,
    completed: merged.missions.filter((mission) => mission.completed).length,
    wordsScheduled: Object.values(merged.reviews).filter((review) => review.nextReviewDay !== null).length,
  };
}
