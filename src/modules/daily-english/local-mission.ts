import type { DailyMission, FeedbackError, ParsedFeedback, SpeakingSession, Word } from "@/types";
import { VOCABULARY, type VocabularyWord } from "./vocabulary";
import { applyReview, isReviewed, reviewOutcomes, reviewStatus, scheduleDailyWords, type DayKey, type ReviewOutcome, type ReviewState } from "./spaced-review";

/**
 * Local-first Daily English Mission: runs entirely in the browser when the
 * SQLite API is unavailable (hosted demo) and analyses the learner's production
 * without any external AI service. Nothing here leaves the device.
 */

export const DAILY_WORD_COUNT = 10;
export const LOCAL_STATE_KEY = "engineer-learning-os:daily-english:v1";
const MAX_STORED_MISSIONS = 60;

export type LocalMissionState = Readonly<{
  version: 2;
  /** wordId → spaced-review schedule. Absent = never reviewed. */
  reviews: Readonly<Record<string, ReviewState>>;
  missions: readonly DailyMission[];
  sessions: readonly SpeakingSession[];
}>;

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * "server": the local SQLite API (developer machine).
 * "browser": localStorage fallback when the API is unavailable (hosted demo, no database).
 */
export type MissionPersistence = "server" | "browser";

export type WordReview = Readonly<{ wordId: string; outcome: ReviewOutcome }>;

const EMPTY_STATE: LocalMissionState = Object.freeze({ version: 2, reviews: {}, missions: [], sessions: [] });
const NEVER_REVIEWED: ReviewState = Object.freeze({ lastReviewedDay: null, nextReviewDay: null });

export function localWordId(word: string): string {
  return `local-word-${word.toLowerCase().replace(/\s+/g, "-")}`;
}

/** Calendar day in the learner's own timezone, so a mission lasts a local day. */
export function dayKey(date: Date): DayKey {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** [start of today, start of tomorrow) in local time, safe across DST changes. */
export function calendarDayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end };
}

/** Puts rows back in the mission's order (databases return them in storage order). */
export function inMissionOrder<T extends { id: string }>(wordIds: readonly string[], rows: readonly T[]): T[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return wordIds.flatMap((id) => byId.get(id) ?? []);
}

function toWord(entry: VocabularyWord, review: ReviewState): Word {
  return {
    id: localWordId(entry.word),
    word: entry.word,
    translation: entry.translation,
    category: entry.category,
    personalSentence: null,
    mentalImage: null,
    emotion: null,
    status: reviewStatus(review),
    nextReviewDate: review.nextReviewDay,
    lastUsedAt: review.lastReviewedDay,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

/** Today's word ids: due reviews first, then new words interleaved across packs. */
export function selectDailyWordIds(
  pool: readonly VocabularyWord[],
  reviews: Readonly<Record<string, ReviewState>>,
  today: DayKey,
  count = DAILY_WORD_COUNT,
): string[] {
  return scheduleDailyWords(
    pool.map((entry) => ({ id: localWordId(entry.word), group: entry.pack, review: reviews[localWordId(entry.word)] ?? NEVER_REVIEWED })),
    today,
    count,
  );
}

function validReviews(value: unknown): value is Record<string, ReviewState> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readLocalState(storage: KeyValueStorage | null): LocalMissionState {
  if (!storage) return EMPTY_STATE;
  try {
    const parsed = JSON.parse(storage.getItem(LOCAL_STATE_KEY) ?? "null") as Record<string, unknown> | null;
    if (!parsed || !Array.isArray(parsed.missions) || !Array.isArray(parsed.sessions)) return EMPTY_STATE;
    const base = { missions: parsed.missions as DailyMission[], sessions: parsed.sessions as SpeakingSession[] };
    // v1 only tracked rotation (no review outcome): keep history, start reviews fresh.
    if (parsed.version === 1) return { version: 2, reviews: {}, ...base };
    if (parsed.version !== 2 || !validReviews(parsed.reviews)) return EMPTY_STATE;
    return { version: 2, reviews: parsed.reviews, ...base };
  } catch {
    return EMPTY_STATE;
  }
}

export function writeLocalState(storage: KeyValueStorage | null, state: LocalMissionState): void {
  if (!storage) return;
  const bounded: LocalMissionState = {
    ...state,
    missions: state.missions.slice(-MAX_STORED_MISSIONS),
    sessions: state.sessions.slice(-MAX_STORED_MISSIONS),
  };
  try {
    storage.setItem(LOCAL_STATE_KEY, JSON.stringify(bounded));
  } catch {
    // Quota exceeded or storage blocked: the mission still works for this visit.
  }
}

function wordsFor(ids: readonly string[], reviews: Readonly<Record<string, ReviewState>>): Word[] {
  const byId = new Map(VOCABULARY.map((entry) => [localWordId(entry.word), entry]));
  return ids.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [toWord(entry, reviews[id] ?? NEVER_REVIEWED)] : [];
  });
}

/** Returns today's mission, creating it on first call of the day. */
export function loadOrCreateLocalMission(storage: KeyValueStorage | null, now: Date, createId: () => string): { words: Word[]; mission: DailyMission } {
  const state = readLocalState(storage);
  const today = dayKey(now);
  const existing = state.missions.find((mission) => typeof mission.date === "string" && mission.date.startsWith(today));
  if (existing) {
    return { words: wordsFor(JSON.parse(existing.wordIdsJson) as string[], state.reviews), mission: existing };
  }

  const wordIds = selectDailyWordIds(VOCABULARY, state.reviews, today);
  const mission: DailyMission = {
    id: `local-mission-${createId()}`,
    date: `${today}T00:00:00`,
    wordIdsJson: JSON.stringify(wordIds),
    personalSentencesJson: "{}",
    speakingSessionId: null,
    completed: false,
    createdAt: now.toISOString(),
  };
  writeLocalState(storage, { ...state, missions: [...state.missions, mission] });
  return { words: wordsFor(wordIds, state.reviews), mission };
}

export function updateLocalMission(
  storage: KeyValueStorage | null,
  missionId: string,
  patch: Readonly<{ personalSentences?: Record<string, string>; speakingSessionId?: string; completed?: boolean; reviews?: readonly WordReview[] }>,
  now: Date = new Date(),
): DailyMission {
  const state = readLocalState(storage);
  const current = state.missions.find((mission) => mission.id === missionId);
  if (!current) throw new Error("Mission locale introuvable — rechargez la page.");
  const updated: DailyMission = {
    ...current,
    ...(patch.personalSentences !== undefined ? { personalSentencesJson: JSON.stringify(patch.personalSentences) } : {}),
    ...(patch.speakingSessionId !== undefined ? { speakingSessionId: patch.speakingSessionId } : {}),
    ...(patch.completed !== undefined ? { completed: patch.completed } : {}),
  };

  // Reviews are applied once, when the mission is first completed.
  let reviews = state.reviews;
  if (patch.completed && !current.completed && patch.reviews) {
    const allowed = new Set(JSON.parse(current.wordIdsJson) as string[]);
    const today = dayKey(now);
    const next: Record<string, ReviewState> = { ...state.reviews };
    for (const review of patch.reviews) {
      if (!allowed.has(review.wordId)) continue;
      const { lastReviewedDay, nextReviewDay } = applyReview(state.reviews[review.wordId] ?? NEVER_REVIEWED, review.outcome, today);
      next[review.wordId] = { lastReviewedDay, nextReviewDay };
    }
    reviews = next;
  }

  writeLocalState(storage, { ...state, reviews, missions: state.missions.map((mission) => (mission.id === missionId ? updated : mission)) });
  return updated;
}

function toDayKey(value: Date | string | null): DayKey | null {
  if (value === null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? dayKey(date) : null;
}

/** Review schedule carried by a word row, whichever mode produced it. */
export function reviewStateFromWord(word: Pick<Word, "lastUsedAt" | "nextReviewDate">): ReviewState {
  const lastReviewedDay = toDayKey(word.lastUsedAt);
  const nextReviewDay = toDayKey(word.nextReviewDate);
  return lastReviewedDay && nextReviewDay ? { lastReviewedDay, nextReviewDay } : NEVER_REVIEWED;
}

/** Outcome of each word of the mission, from the sentences and the oral production. */
export function missionReviews(words: readonly Pick<Word, "id" | "word">[], personalSentences: Readonly<Record<string, string>>, production: string): WordReview[] {
  return reviewOutcomes(words, personalSentences, production, (word, text) => wordUsagePattern(word).test(text));
}

export type LocalProgressSummary = Readonly<{ seen: number; mastered: number; total: number; streak: number }>;

/** Consecutive completed days ending today (or yesterday, if today is not done yet). */
export function localProgressSummary(storage: KeyValueStorage | null, now: Date): LocalProgressSummary {
  const state = readLocalState(storage);
  const reviewed = Object.values(state.reviews).filter(isReviewed);
  const completedDays = new Set(state.missions.filter((mission) => mission.completed).map((mission) => String(mission.date).slice(0, 10)));
  const cursor = new Date(now);
  if (!completedDays.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (completedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    seen: reviewed.length,
    mastered: reviewed.filter((review) => reviewStatus(review) === "maitrise").length,
    total: VOCABULARY.length,
    streak,
  };
}

export function saveLocalSession(storage: KeyValueStorage | null, session: SpeakingSession): SpeakingSession {
  const state = readLocalState(storage);
  const sessions = state.sessions.some((item) => item.id === session.id)
    ? state.sessions.map((item) => (item.id === session.id ? session : item))
    : [...state.sessions, session];
  writeLocalState(storage, { ...state, sessions });
  return session;
}

export function isLocalSessionId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("local-session-");
}

export function createLocalSession(transcription: string, durationSeconds: number, now: Date, createId: () => string): SpeakingSession {
  const timestamp = now.toISOString();
  return {
    id: `local-session-${createId()}`,
    date: timestamp,
    audioUrl: null,
    transcription,
    correctedText: null,
    feedback: null,
    repeated: false,
    durationSeconds,
    repeatDurationSeconds: null,
    wordsUsedJson: null,
    createdAt: timestamp,
  };
}

// ---------------------------------------------------------------------------
// Deterministic feedback (no external AI)
// ---------------------------------------------------------------------------

type Rule = Readonly<{ pattern: RegExp; replace: string | ((match: string, ...groups: string[]) => string); explanation: string }>;

/** Frequent errors of French speakers, each with a short explanation in French. */
const RULES: readonly Rule[] = [
  { pattern: /\bI am agree\b/gi, replace: "I agree", explanation: "« agree » est un verbe : on dit « I agree », sans « am »." },
  { pattern: /\b(since) (\d+|a|one|two|three|four|five|six|ten) (years?|months?|weeks?|days?|hours?)\b/gi, replace: (_m, _s, n, unit) => `for ${n} ${unit}`, explanation: "Pour une durée, on utilise « for » ; « since » introduit un point de départ (since 2024)." },
  { pattern: /\bdepends? of\b/gi, replace: (m) => m.replace(/of$/i, "on"), explanation: "On dit « depend on », jamais « depend of »." },
  { pattern: /\bexplain me\b/gi, replace: "explain to me", explanation: "« explain » demande « to » devant la personne : « explain to me »." },
  { pattern: /\bdiscuss about\b/gi, replace: "discuss", explanation: "« discuss » est transitif direct : « discuss the project », sans « about »." },
  { pattern: /\b(make|made|making) a (photo|picture)\b/gi, replace: (_m, verb) => `${({ make: "take", made: "took", making: "taking" } as Record<string, string>)[verb.toLowerCase()]} a photo`, explanation: "En anglais, on « take » une photo, on ne la « make » pas." },
  { pattern: /\bI have (\d+) years\b/gi, replace: "I am $1 years old", explanation: "L’âge s’exprime avec « to be » : « I am 20 years old »." },
  { pattern: /\bmore (better|worse|easier|bigger)\b/gi, replace: "$1", explanation: "Le comparatif est déjà formé : pas de « more » devant « better »." },
  { pattern: /\b(he|she|it) don't\b/gi, replace: "$1 doesn't", explanation: "À la 3ᵉ personne du singulier : « he doesn’t », pas « he don’t »." },
  { pattern: /\bpeople is\b/gi, replace: "people are", explanation: "« people » est pluriel : « people are »." },
  { pattern: /\b(informations|advices|feedbacks|equipments|softwares|knowledges)\b/gi, replace: (m) => m.slice(0, -1), explanation: "Ce nom est indénombrable en anglais : il ne prend pas de « s »." },
  { pattern: /\bin the same time\b/gi, replace: "at the same time", explanation: "L’expression correcte est « at the same time »." },
  { pattern: /\b(i)\b(?=[\s',.!?]|$)/g, replace: "I", explanation: "Le pronom « I » s’écrit toujours en majuscule." },
];

const MAX_REPORTED_ERRORS = 5;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches the base form and its regular inflections (embrace → embraces, embraced, embracing). */
export function wordUsagePattern(word: string): RegExp {
  const base = escapeRegExp(word.toLowerCase());
  const lower = word.toLowerCase();
  const stem = lower.endsWith("e") ? escapeRegExp(lower.slice(0, -1)) : base;
  // apply → applies, applied; but not play → plaied
  const yForms = /[^aeiou]y$/.test(lower) ? `|${escapeRegExp(lower.slice(0, -1))}(?:ies|ied)` : "";
  return new RegExp(`\\b(?:${base}(?:s|es|d|ed|ly)?|${stem}(?:ing|ed|es|ion)|${base}ing${yForms})\\b`, "i");
}

function capitalizeSentences(text: string): string {
  return text.replace(/(^\s*|[.!?]\s+)([a-z])/g, (_m, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

export type LocalProductionAnalysis = Readonly<{
  correctedText: string;
  feedback: ParsedFeedback;
  usedWordIds: readonly string[];
  missingWords: readonly string[];
}>;

export function analyzeProduction(text: string, words: readonly Pick<Word, "id" | "word">[]): LocalProductionAnalysis {
  const errors: FeedbackError[] = [];
  let corrected = text.replace(/[ \t]{2,}/g, " ").trim();

  for (const rule of RULES) {
    corrected = corrected.replace(rule.pattern, (match: string, ...rest: unknown[]) => {
      const groups = rest.slice(0, -2) as string[];
      const replacement = typeof rule.replace === "function"
        ? rule.replace(match, ...groups)
        : rule.replace.replace(/\$(\d)/g, (_t, index: string) => groups[Number(index) - 1] ?? "");
      if (replacement !== match && !errors.some((error) => error.explanation === rule.explanation)) {
        errors.push({ original: match, corrected: replacement, explanation: rule.explanation });
      }
      return replacement;
    });
  }

  const capitalized = capitalizeSentences(corrected);
  if (capitalized !== corrected && !errors.some((error) => error.original === "minuscule")) {
    errors.push({ original: "minuscule", corrected: "Majuscule", explanation: "Chaque phrase commence par une majuscule." });
  }
  corrected = capitalized;

  const usedWordIds = words.filter((word) => wordUsagePattern(word.word).test(text)).map((word) => word.id);
  const missingWords = words.filter((word) => !usedWordIds.includes(word.id)).map((word) => word.word);

  return { correctedText: corrected, feedback: { errors: errors.slice(0, MAX_REPORTED_ERRORS) }, usedWordIds, missingWords };
}
