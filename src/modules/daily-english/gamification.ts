import type { DayKey, ReviewState } from "./spaced-review";
import { daysBetween, reviewStatus } from "./spaced-review";
import type { KeyValueStorage } from "./local-mission";
import { localWordId } from "./local-mission";
import { VOCABULARY_PACKS, type CefrLevel, type VocabularyPackId, type VocabularyWord } from "./vocabulary";

/**
 * Pure, local-first gamification & learning-path engine for Daily English.
 * Stored under its own versioned localStorage key so the existing v2
 * spaced-review storage stays untouched and backwards-compatible.
 */

export const GAMIFICATION_STATE_KEY = "engineer-learning-os:daily-english:gamification:v1";
export const MAX_HEARTS = 5;
/** Daily path nodes older than this are dropped on read so storage stays bounded. */
export const DAILY_NODE_RETENTION_DAYS = 30;

export type DailyGoalXp = 20 | 50 | 100;
export type FocusTrack = VocabularyPackId | "all";
export type PathThemeId = "emerald" | "indigo" | "violet" | "orange" | "cyan";
export type PathNodeKind =
  | "warmup"
  | "word_bank"
  | "match_pairs"
  | "listening"
  | "checkpoint"
  | "mission_guided";

export type NodeCompletion = Readonly<{
  completedAt: string;
  xpEarned: number;
  accuracy: number;
  stars: 1 | 2 | 3;
}>;

export type OnboardingPreferences = Readonly<{
  completed: boolean;
  focusTrack: FocusTrack;
  dailyGoalXp: DailyGoalXp;
  soundEnabled: boolean;
}>;

export type GamificationState = Readonly<{
  version: 1;
  xp: number;
  todayXp: number;
  gems: number;
  hearts: number;
  streak: number;
  lastActiveDay: DayKey | null;
  lessonsCompletedToday: number;
  completedNodes: Readonly<Record<string, NodeCompletion>>;
  /** Quest ids whose gem reward was already granted today (reset on day rollover). */
  claimedQuestIds: readonly string[];
  onboarding: OnboardingPreferences;
}>;

export type PathNode = Readonly<{
  id: string;
  unitId: string;
  kind: PathNodeKind;
  title: string;
  subtitle: string;
  xpReward: number;
  packId: VocabularyPackId | "daily";
  wordRange: readonly [number, number];
  state: "completed" | "current" | "unlocked" | "locked";
  stars: 0 | 1 | 2 | 3;
}>;

export type LearningPathUnit = Readonly<{
  id: string;
  unitNumber: number;
  title: string;
  subtitle: string;
  level: CefrLevel | "B1–B2";
  packId: VocabularyPackId | "daily";
  theme: PathThemeId;
  completedCount: number;
  totalCount: number;
  masteredWords: number;
  totalWords: number;
  nodes: readonly PathNode[];
}>;

export type DailyQuest = Readonly<{
  id: string;
  title: string;
  current: number;
  target: number;
  rewardGems: number;
  completed: boolean;
  claimed: boolean;
}>;

export const DEFAULT_GAMIFICATION_STATE: GamificationState = Object.freeze({
  version: 1,
  xp: 0,
  todayXp: 0,
  gems: 50,
  hearts: MAX_HEARTS,
  streak: 0,
  lastActiveDay: null,
  lessonsCompletedToday: 0,
  completedNodes: {},
  claimedQuestIds: [],
  onboarding: Object.freeze({
    completed: false,
    focusTrack: "all",
    dailyGoalXp: 50,
    soundEnabled: true,
  }),
});

const PACK_THEMES: Record<VocabularyPackId, PathThemeId> = {
  core: "emerald",
  networking: "indigo",
  cybersecurity: "violet",
  meetings: "orange",
  career: "cyan",
};

const PACK_SUBTITLES: Record<VocabularyPackId, string> = {
  core: "Vocabulaire polyvalent et expressions clés du quotidien pro",
  networking: "Latence, routage, sous-réseaux et dépannage en anglais",
  cybersecurity: "Menaces, durcissement, incidents et sécurité applicative",
  meetings: "Stand-ups, délais, arbitrages et suivi d'équipe",
  career: "Entretiens, alternance, CV et posture d'ingénieur",
};

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isDailyGoal(value: unknown): value is DailyGoalXp {
  return value === 20 || value === 50 || value === 100;
}

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAILY_NODE_PATTERN = /^daily:(\d{4}-\d{2}-\d{2}):/;

function isDayKey(value: unknown): value is DayKey {
  return typeof value === "string" && DAY_KEY_PATTERN.test(value);
}

function isNodeCompletion(value: unknown): value is NodeCompletion {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.completedAt === "string" &&
    isFiniteNonNegative(record.xpEarned) &&
    isFiniteNonNegative(record.accuracy) &&
    record.accuracy <= 100 &&
    (record.stars === 1 || record.stars === 2 || record.stars === 3)
  );
}

/**
 * Keeps only well-formed completions and drops daily nodes older than the
 * retention window (one set of daily ids is created per calendar day).
 */
export function sanitizeCompletedNodes(
  raw: unknown,
  today: DayKey,
  retentionDays = DAILY_NODE_RETENTION_DAYS,
): Record<string, NodeCompletion> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, NodeCompletion> = {};
  for (const [nodeId, completion] of Object.entries(raw as Record<string, unknown>)) {
    if (!isNodeCompletion(completion)) continue;
    const dailyMatch = DAILY_NODE_PATTERN.exec(nodeId);
    if (dailyMatch && daysBetween(dailyMatch[1], today) > retentionDays) continue;
    result[nodeId] = {
      completedAt: completion.completedAt,
      xpEarned: Math.floor(completion.xpEarned),
      accuracy: Math.round(completion.accuracy),
      stars: completion.stars,
    };
  }
  return result;
}

function isFocusTrack(value: unknown): value is FocusTrack {
  return (
    value === "all" ||
    value === "core" ||
    value === "networking" ||
    value === "cybersecurity" ||
    value === "meetings" ||
    value === "career"
  );
}

/** Normalizes day-scoped counters when the calendar day rolls over. */
export function syncGamificationDay(state: GamificationState, today: DayKey): GamificationState {
  if (state.lastActiveDay === today) return state;

  // Determine whether yesterday was active so the streak stays alive until today ends.
  const yesterday = previousDayKey(today);
  const keepStreak = state.lastActiveDay === yesterday;
  return {
    ...state,
    todayXp: 0,
    lessonsCompletedToday: 0,
    claimedQuestIds: [],
    hearts: MAX_HEARTS,
    streak: keepStreak ? state.streak : 0,
  };
}

export function previousDayKey(day: DayKey): DayKey {
  const [year, month, date] = day.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, date) - 24 * 60 * 60 * 1000;
  return new Date(utc).toISOString().slice(0, 10);
}

export function readGamificationState(storage: KeyValueStorage | null, today: DayKey): GamificationState {
  if (!storage) return DEFAULT_GAMIFICATION_STATE;
  try {
    const raw = JSON.parse(storage.getItem(GAMIFICATION_STATE_KEY) ?? "null") as Record<string, unknown> | null;
    if (!raw || raw.version !== 1) return DEFAULT_GAMIFICATION_STATE;
    const onboardingRaw = (raw.onboarding && typeof raw.onboarding === "object"
      ? raw.onboarding
      : {}) as Record<string, unknown>;

    const loaded: GamificationState = {
      version: 1,
      xp: isFiniteNonNegative(raw.xp) ? Math.floor(raw.xp) : 0,
      todayXp: isFiniteNonNegative(raw.todayXp) ? Math.floor(raw.todayXp) : 0,
      gems: isFiniteNonNegative(raw.gems) ? Math.floor(raw.gems) : 50,
      hearts: isFiniteNonNegative(raw.hearts) ? Math.min(MAX_HEARTS, Math.floor(raw.hearts)) : MAX_HEARTS,
      streak: isFiniteNonNegative(raw.streak) ? Math.floor(raw.streak) : 0,
      lastActiveDay: isDayKey(raw.lastActiveDay) ? raw.lastActiveDay : null,
      lessonsCompletedToday: isFiniteNonNegative(raw.lessonsCompletedToday) ? Math.floor(raw.lessonsCompletedToday) : 0,
      completedNodes: sanitizeCompletedNodes(raw.completedNodes, today),
      claimedQuestIds: Array.isArray(raw.claimedQuestIds)
        ? raw.claimedQuestIds.filter((id): id is string => typeof id === "string")
        : [],
      onboarding: {
        completed: onboardingRaw.completed === true,
        focusTrack: isFocusTrack(onboardingRaw.focusTrack) ? onboardingRaw.focusTrack : "all",
        dailyGoalXp: isDailyGoal(onboardingRaw.dailyGoalXp) ? onboardingRaw.dailyGoalXp : 50,
        soundEnabled: onboardingRaw.soundEnabled !== false,
      },
    };
    return syncGamificationDay(loaded, today);
  } catch {
    return DEFAULT_GAMIFICATION_STATE;
  }
}

export function writeGamificationState(storage: KeyValueStorage | null, state: GamificationState): void {
  if (!storage) return;
  try {
    storage.setItem(GAMIFICATION_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage quota or private browsing restriction: keep working in memory.
  }
}

export function updateOnboardingPreferences(
  state: GamificationState,
  patch: Partial<OnboardingPreferences>,
): GamificationState {
  return {
    ...state,
    onboarding: {
      ...state.onboarding,
      ...patch,
    },
  };
}

export function consumeHeart(state: GamificationState): GamificationState {
  return {
    ...state,
    hearts: Math.max(0, state.hearts - 1),
  };
}

export function refillHearts(state: GamificationState, amount = MAX_HEARTS): GamificationState {
  return {
    ...state,
    hearts: Math.min(MAX_HEARTS, state.hearts + amount),
  };
}

export type LessonResultInput = Readonly<{
  nodeId: string;
  correctCount: number;
  totalCount: number;
  maxCombo: number;
  baseXp?: number;
  today: DayKey;
  completedAt?: string;
}>;

export type LessonRewardSummary = Readonly<{
  state: GamificationState;
  xpEarned: number;
  comboBonus: number;
  perfectBonus: number;
  gemsEarned: number;
  accuracy: number;
  stars: 1 | 2 | 3;
  /** Quests whose reward was granted as a consequence of this lesson, if any. */
  claimedQuests?: readonly DailyQuest[];
}>;

/** Calculates XP, stars, gems, streak, and node completion after a lesson. */
export function recordLessonCompletion(
  currentState: GamificationState,
  input: LessonResultInput,
): LessonRewardSummary {
  const synced = syncGamificationDay(currentState, input.today);
  const safeTotal = Math.max(1, input.totalCount);
  const accuracy = Math.round((Math.min(input.correctCount, safeTotal) / safeTotal) * 100);
  const baseXp = input.baseXp ?? 20;
  const comboBonus = Math.min(15, Math.max(0, input.maxCombo - 1) * 2);
  const perfectBonus = accuracy === 100 ? 10 : 0;
  const xpEarned = baseXp + comboBonus + perfectBonus;
  const stars: 1 | 2 | 3 = accuracy >= 95 ? 3 : accuracy >= 75 ? 2 : 1;
  const gemsEarned = stars * 5 + (perfectBonus > 0 ? 5 : 0);

  const alreadyActiveToday = synced.lastActiveDay === input.today;
  const nextStreak = alreadyActiveToday
    ? Math.max(1, synced.streak)
    : synced.lastActiveDay === previousDayKey(input.today)
      ? synced.streak + 1
      : 1;

  const existing = synced.completedNodes[input.nodeId];
  const bestStars = existing ? (Math.max(existing.stars, stars) as 1 | 2 | 3) : stars;

  const nextState: GamificationState = {
    ...synced,
    xp: synced.xp + xpEarned,
    todayXp: synced.todayXp + xpEarned,
    gems: synced.gems + gemsEarned,
    hearts: Math.min(MAX_HEARTS, Math.max(1, synced.hearts + (accuracy >= 80 ? 1 : 0))),
    streak: nextStreak,
    lastActiveDay: input.today,
    lessonsCompletedToday: synced.lessonsCompletedToday + 1,
    completedNodes: {
      ...synced.completedNodes,
      [input.nodeId]: {
        completedAt: input.completedAt ?? new Date().toISOString(),
        xpEarned: Math.max(existing?.xpEarned ?? 0, xpEarned),
        accuracy: Math.max(existing?.accuracy ?? 0, accuracy),
        stars: bestStars,
      },
    },
  };

  return {
    state: nextState,
    xpEarned,
    comboBonus,
    perfectBonus,
    gemsEarned,
    accuracy,
    stars,
  };
}

/** Builds the daily mission unit + themed vocabulary pack units for the winding path. */
export function buildLearningPathUnits(
  reviews: Readonly<Record<string, ReviewState>>,
  completedNodes: Readonly<Record<string, NodeCompletion>>,
  today: DayKey,
  focusTrack: FocusTrack = "all",
  missionCompletedToday = false,
): LearningPathUnit[] {
  const dailyPrefix = `daily:${today}`;
  const dailyDefs: ReadonlyArray<{
    id: string;
    kind: PathNodeKind;
    title: string;
    subtitle: string;
    xpReward: number;
    wordRange: readonly [number, number];
  }> = [
    {
      id: `${dailyPrefix}:warmup`,
      kind: "warmup",
      title: "Échauffement du jour",
      subtitle: "Découvre les 10 mots du jour avec audio & QCM rapide",
      xpReward: 15,
      wordRange: [0, 5],
    },
    {
      id: `${dailyPrefix}:word-bank`,
      kind: "word_bank",
      title: "Banque de mots",
      subtitle: "Construis des phrases naturelles en anglais",
      xpReward: 20,
      wordRange: [0, 10],
    },
    {
      id: `${dailyPrefix}:pairs`,
      kind: "match_pairs",
      title: "Chrono Paires",
      subtitle: "Associe chaque mot clé à sa traduction exacte",
      xpReward: 20,
      wordRange: [0, 10],
    },
    {
      id: `${dailyPrefix}:listening`,
      kind: "listening",
      title: "Écoute & Contexte",
      subtitle: "Compréhension orale (normal & lent) + texte à trous",
      xpReward: 25,
      wordRange: [5, 10],
    },
    {
      id: `${dailyPrefix}:mission`,
      kind: "mission_guided",
      title: "Mission complète (Oral & Correction)",
      subtitle: "Phrases personnelles, expression orale 2 min et répétition",
      xpReward: 40,
      wordRange: [0, 10],
    },
  ];

  let foundCurrent = false;

  const mapNodes = (
    unitId: string,
    packId: VocabularyPackId | "daily",
    defs: typeof dailyDefs,
    isDailyUnit: boolean,
  ): PathNode[] => {
    return defs.map((def, index) => {
      const doneRecord = completedNodes[def.id];
      const isDone = Boolean(doneRecord) || (def.kind === "mission_guided" && missionCompletedToday);
      let state: PathNode["state"];
      if (isDone) {
        state = "completed";
      } else if (!foundCurrent) {
        state = "current";
        foundCurrent = true;
      } else if (isDailyUnit || index === 0) {
        // Keep today's nodes and every unit's first node accessible so learners aren't blocked.
        state = "unlocked";
      } else {
        const prevDone = Boolean(completedNodes[defs[index - 1].id]);
        state = prevDone ? "unlocked" : "locked";
      }

      return {
        id: def.id,
        unitId,
        kind: def.kind,
        title: def.title,
        subtitle: def.subtitle,
        xpReward: def.xpReward,
        packId,
        wordRange: def.wordRange,
        state,
        stars: doneRecord?.stars ?? (isDone ? 3 : 0),
      };
    });
  };

  const dailyNodes = mapNodes("unit-daily", "daily", dailyDefs, true);
  const dailyUnit: LearningPathUnit = {
    id: "unit-daily",
    unitNumber: 1,
    title: "Parcours du jour",
    subtitle: "Tes 10 mots prioritaires (répétition espacée Leitner)",
    level: "B1–B2",
    packId: "daily",
    theme: "emerald",
    completedCount: dailyNodes.filter((n) => n.state === "completed").length,
    totalCount: dailyNodes.length,
    masteredWords: Object.values(reviews).filter((r) => reviewStatus(r) === "maitrise").length,
    totalWords: 10,
    nodes: dailyNodes,
  };

  // Put user's chosen focus pack right after the daily unit.
  const orderedPacks =
    focusTrack === "all"
      ? [...VOCABULARY_PACKS]
      : [
          ...VOCABULARY_PACKS.filter((p) => p.id === focusTrack),
          ...VOCABULARY_PACKS.filter((p) => p.id !== focusTrack),
        ];

  const packUnits: LearningPathUnit[] = orderedPacks.map((pack, idx) => {
    const unitId = `unit-${pack.id}`;
    const defs = [
      {
        id: `${pack.id}:lesson-1`,
        kind: "warmup" as PathNodeKind,
        title: `${pack.label} · Bases`,
        subtitle: "Premiers termes essentiels + prononciation audio",
        xpReward: 20,
        wordRange: [0, 8] as const,
      },
      {
        id: `${pack.id}:lesson-2`,
        kind: "word_bank" as PathNodeKind,
        title: `${pack.label} · Phrases`,
        subtitle: "Assemblage de phrases professionnelles par blocs",
        xpReward: 25,
        wordRange: [8, 16] as const,
      },
      {
        id: `${pack.id}:lesson-3`,
        kind: "match_pairs" as PathNodeKind,
        title: `${pack.label} · Paires rapides`,
        subtitle: "Associe les termes techniques et leur sens",
        xpReward: 25,
        wordRange: [16, 24] as const,
      },
      {
        id: `${pack.id}:lesson-4`,
        kind: "listening" as PathNodeKind,
        title: `${pack.label} · Écoute`,
        subtitle: "Compréhension orale et phrases à compléter",
        xpReward: 25,
        wordRange: [22, 30] as const,
      },
      {
        id: `${pack.id}:checkpoint`,
        kind: "checkpoint" as PathNodeKind,
        title: `Trophée · ${pack.label}`,
        subtitle: "Défi mixte sur toute l'unité pour valider ta maîtrise",
        xpReward: 35,
        wordRange: [0, 30] as const,
      },
    ];

    const nodes = mapNodes(unitId, pack.id, defs, false);
    const masteredWords = pack.entries.filter((entry) => {
      const state = reviews[localWordId(entry.word)];
      return state ? reviewStatus(state) === "maitrise" : false;
    }).length;

    return {
      id: unitId,
      unitNumber: idx + 2,
      title: `Unité ${idx + 2} · ${pack.label}`,
      subtitle: PACK_SUBTITLES[pack.id],
      level: pack.level,
      packId: pack.id,
      theme: PACK_THEMES[pack.id],
      completedCount: nodes.filter((n) => n.state === "completed").length,
      totalCount: nodes.length,
      masteredWords,
      totalWords: pack.entries.length,
      nodes,
    };
  });

  return [dailyUnit, ...packUnits];
}

/** Resolves the vocabulary words targeted by a specific path node. */
export function wordsForPathNode(
  node: Pick<PathNode, "packId" | "wordRange">,
  dailyWords: readonly VocabularyWord[],
  allVocabulary: readonly VocabularyWord[],
): VocabularyWord[] {
  const [start, end] = node.wordRange;
  if (node.packId === "daily") {
    const sliced = dailyWords.slice(start, end);
    return sliced.length >= 4 ? sliced : [...dailyWords];
  }
  const packWords = allVocabulary.filter((w) => w.pack === node.packId);
  const sliced = packWords.slice(start, end);
  return sliced.length >= 4 ? sliced : packWords.slice(0, 8);
}

/** Computes the 3 real daily quests shown in the side panel. */
export function buildDailyQuests(
  state: GamificationState,
  missionCompletedToday: boolean,
): DailyQuest[] {
  const goal = state.onboarding.dailyGoalXp;
  const claimed = new Set(state.claimedQuestIds);
  const quests: Omit<DailyQuest, "claimed">[] = [
    {
      id: "quest-xp",
      title: `Gagner ${goal} XP aujourd'hui`,
      current: Math.min(goal, state.todayXp),
      target: goal,
      rewardGems: 15,
      completed: state.todayXp >= goal,
    },
    {
      id: "quest-lessons",
      title: "Terminer 2 leçons interactives",
      current: Math.min(2, state.lessonsCompletedToday),
      target: 2,
      rewardGems: 20,
      completed: state.lessonsCompletedToday >= 2,
    },
    {
      id: "quest-mission",
      title: "Valider la Mission orale du jour",
      current: missionCompletedToday ? 1 : 0,
      target: 1,
      rewardGems: 30,
      completed: missionCompletedToday,
    },
  ];
  return quests.map((quest) => ({ ...quest, claimed: claimed.has(quest.id) }));
}

export type QuestClaimResult = Readonly<{
  state: GamificationState;
  gemsAwarded: number;
  claimedQuests: readonly DailyQuest[];
}>;

/**
 * Grants the gem reward of every quest completed today that was not yet
 * claimed. Idempotent: calling it again the same day awards nothing more.
 */
export function claimCompletedQuests(
  currentState: GamificationState,
  missionCompletedToday: boolean,
  today: DayKey,
): QuestClaimResult {
  const state = syncGamificationDay(currentState, today);
  const newlyCompleted = buildDailyQuests(state, missionCompletedToday).filter(
    (quest) => quest.completed && !quest.claimed,
  );
  if (newlyCompleted.length === 0) {
    return { state, gemsAwarded: 0, claimedQuests: [] };
  }
  const gemsAwarded = newlyCompleted.reduce((sum, quest) => sum + quest.rewardGems, 0);
  return {
    state: {
      ...state,
      gems: state.gems + gemsAwarded,
      claimedQuestIds: [...state.claimedQuestIds, ...newlyCompleted.map((quest) => quest.id)],
    },
    gemsAwarded,
    claimedQuests: newlyCompleted.map((quest) => ({ ...quest, claimed: true })),
  };
}
