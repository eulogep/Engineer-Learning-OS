import type { DailyMission, FeedbackError, ParsedFeedback, SpeakingSession, Word } from "@/types";

/**
 * Local-first Daily English Mission: runs entirely in the browser when the
 * SQLite API is unavailable (hosted demo) and analyses the learner's production
 * without any external AI service. Nothing here leaves the device.
 */

export const DAILY_WORD_COUNT = 10;
export const LOCAL_STATE_KEY = "engineer-learning-os:daily-english:v1";
const MAX_STORED_MISSIONS = 60;

type WordSeed = Readonly<{ word: string; translation: string; category: string }>;

/** Same generic vocabulary as `prisma/seed.ts`, so both modes share one pool. */
export const LOCAL_WORD_POOL: readonly WordSeed[] = Object.freeze([
  { word: "embrace", translation: "accepter / serrer", category: "verbe" },
  { word: "resilient", translation: "résilient", category: "adjectif" },
  { word: "perspective", translation: "perspective / point de vue", category: "nom" },
  { word: "overcome", translation: "surmonter", category: "verbe" },
  { word: "genuine", translation: "authentique / sincère", category: "adjectif" },
  { word: "thrive", translation: "s'épanouir / prospérer", category: "verbe" },
  { word: "subtle", translation: "subtil", category: "adjectif" },
  { word: "acknowledge", translation: "reconnaître / admettre", category: "verbe" },
  { word: "meaningful", translation: "significatif / plein de sens", category: "adjectif" },
  { word: "approach", translation: "approche / aborder", category: "verbe" },
  { word: "reflection", translation: "réflexion / reflet", category: "nom" },
  { word: "collaborate", translation: "collaborer", category: "verbe" },
  { word: "challenge", translation: "défi / mettre au défi", category: "nom" },
  { word: "inspire", translation: "inspirer", category: "verbe" },
  { word: "curiosity", translation: "curiosité", category: "nom" },
  { word: "adapt", translation: "s'adapter", category: "verbe" },
  { word: "empathy", translation: "empathie", category: "nom" },
  { word: "progress", translation: "progrès / progresser", category: "nom" },
  { word: "accomplish", translation: "accomplir / réaliser", category: "verbe" },
  { word: "insight", translation: "perspicacité / aperçu", category: "nom" },
  { word: "determination", translation: "détermination", category: "nom" },
  { word: "gratitude", translation: "gratitude / reconnaissance", category: "nom" },
  { word: "influence", translation: "influence / influencer", category: "nom" },
  { word: "explore", translation: "explorer", category: "verbe" },
  { word: "significant", translation: "significatif / important", category: "adjectif" },
  { word: "struggle", translation: "lutte / lutter", category: "verbe" },
  { word: "transform", translation: "transformer", category: "verbe" },
  { word: "opportunity", translation: "opportunité", category: "nom" },
  { word: "contribute", translation: "contribuer", category: "verbe" },
  { word: "intention", translation: "intention", category: "nom" },
]);

export type LocalMissionState = Readonly<{
  version: 1;
  /** wordId → day key (YYYY-MM-DD) of the last mission that used it. */
  lastUsed: Readonly<Record<string, string>>;
  missions: readonly DailyMission[];
  sessions: readonly SpeakingSession[];
}>;

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * "server": the local SQLite API (developer machine).
 * "browser": localStorage fallback when the API is unavailable (hosted demo, no database).
 */
export type MissionPersistence = "server" | "browser";

const EMPTY_STATE: LocalMissionState = Object.freeze({ version: 1, lastUsed: {}, missions: [], sessions: [] });

export function localWordId(word: string): string {
  return `local-word-${word}`;
}

/** Calendar day in the learner's own timezone, so a mission lasts a local day. */
export function dayKey(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toWord(seed: WordSeed, lastUsedAt: string | null): Word {
  return {
    id: localWordId(seed.word),
    word: seed.word,
    translation: seed.translation,
    category: seed.category,
    personalSentence: null,
    mentalImage: null,
    emotion: null,
    status: lastUsedAt ? "actif" : "nouveau",
    nextReviewDate: null,
    lastUsedAt,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * Least-recently-used rotation: never-used words first (pool order), then the
 * oldest ones. A pool of N words cycles completely every ceil(N / count) days.
 */
export function selectDailyWordIds(pool: readonly WordSeed[], lastUsed: Readonly<Record<string, string>>, count = DAILY_WORD_COUNT): string[] {
  return pool
    .map((seed, index) => ({ id: localWordId(seed.word), used: lastUsed[localWordId(seed.word)] ?? "", index }))
    .sort((a, b) => (a.used === b.used ? a.index - b.index : a.used < b.used ? -1 : 1))
    .slice(0, count)
    .map((entry) => entry.id);
}

export function readLocalState(storage: KeyValueStorage | null): LocalMissionState {
  if (!storage) return EMPTY_STATE;
  try {
    const parsed = JSON.parse(storage.getItem(LOCAL_STATE_KEY) ?? "null") as Partial<LocalMissionState> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.missions) || !Array.isArray(parsed.sessions)
      || typeof parsed.lastUsed !== "object" || parsed.lastUsed === null) return EMPTY_STATE;
    return { version: 1, lastUsed: parsed.lastUsed, missions: parsed.missions, sessions: parsed.sessions };
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

function wordsFor(ids: readonly string[], lastUsed: Readonly<Record<string, string>>): Word[] {
  const byId = new Map(LOCAL_WORD_POOL.map((seed) => [localWordId(seed.word), seed]));
  return ids.flatMap((id) => {
    const seed = byId.get(id);
    return seed ? [toWord(seed, lastUsed[id] ?? null)] : [];
  });
}

/** Returns today's mission, creating it (and advancing the rotation) on first call of the day. */
export function loadOrCreateLocalMission(storage: KeyValueStorage | null, now: Date, createId: () => string): { words: Word[]; mission: DailyMission } {
  const state = readLocalState(storage);
  const today = dayKey(now);
  const existing = state.missions.find((mission) => typeof mission.date === "string" && mission.date.startsWith(today));
  if (existing) {
    return { words: wordsFor(JSON.parse(existing.wordIdsJson) as string[], state.lastUsed), mission: existing };
  }

  const wordIds = selectDailyWordIds(LOCAL_WORD_POOL, state.lastUsed);
  const timestamp = now.toISOString();
  const mission: DailyMission = {
    id: `local-mission-${createId()}`,
    date: `${today}T00:00:00`,
    wordIdsJson: JSON.stringify(wordIds),
    personalSentencesJson: "{}",
    speakingSessionId: null,
    completed: false,
    createdAt: timestamp,
  };
  const words = wordsFor(wordIds, state.lastUsed);
  const lastUsed = { ...state.lastUsed, ...Object.fromEntries(wordIds.map((id) => [id, today])) };
  writeLocalState(storage, { ...state, lastUsed, missions: [...state.missions, mission] });
  return { words, mission };
}

export function updateLocalMission(
  storage: KeyValueStorage | null,
  missionId: string,
  patch: Readonly<{ personalSentences?: Record<string, string>; speakingSessionId?: string; completed?: boolean }>,
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
  writeLocalState(storage, { ...state, missions: state.missions.map((mission) => (mission.id === missionId ? updated : mission)) });
  return updated;
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
  const stem = word.toLowerCase().endsWith("e") ? escapeRegExp(word.toLowerCase().slice(0, -1)) : base;
  return new RegExp(`\\b(?:${base}(?:s|es|d|ed|ly)?|${stem}(?:ing|ed|es|ion)|${base}ing)\\b`, "i");
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
