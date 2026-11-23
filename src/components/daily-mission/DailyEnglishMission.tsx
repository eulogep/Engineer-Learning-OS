"use client";

import Link from "next/link";
import { MotionConfig } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useMissionStore } from "@/lib/store";
import type { MissionStep } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  BookOpen,
  BookOpenText,
  CheckCircle2,
  Compass,
  Dumbbell,
  Mic,
  PartyPopper,
  PenLine,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { WordsStep } from "@/components/daily-mission/WordsStep";
import { SentencesStep } from "@/components/daily-mission/SentencesStep";
import { SpeakingStep } from "@/components/daily-mission/SpeakingStep";
import { CorrectionStep } from "@/components/daily-mission/CorrectionStep";
import { RepeatStep } from "@/components/daily-mission/RepeatStep";
import { DoneStep } from "@/components/daily-mission/DoneStep";
import {
  browserProgressSummary,
  loadTodayMission,
} from "@/components/daily-mission/mission-gateway";
import { dayKey, readLocalState } from "@/modules/daily-english/local-mission";
import { VOCABULARY, vocabularyEntry, type VocabularyWord } from "@/modules/daily-english/vocabulary";
import {
  DEFAULT_GAMIFICATION_STATE,
  GAMIFICATION_STATE_KEY,
  buildBonusPathUnits,
  buildDailyQuests,
  buildLearningPathUnits,
  claimCompletedQuests,
  consumeHeart,
  equipMascotAccessory,
  markGrammarDrillCompleted,
  purchaseShopItem,
  readGamificationState,
  recordBlitzRun,
  recordLessonCompletion,
  recordStoryCompletion,
  refillHearts,
  updateOnboardingPreferences,
  wordsForPathNode,
  writeGamificationState,
  type DailyGoalXp,
  type FocusTrack,
  type GamificationState,
  type LessonRewardSummary,
  type PathNode,
  type ShopPurchaseResult,
} from "@/modules/daily-english/gamification";
import {
  ALL_STUDIO_VOCABULARY,
  ENGINEERING_STORIES,
  asGeneratorWords,
  type MascotAccessoryId,
  type ShopItemId,
} from "@/modules/daily-english/studio-content";
import {
  generateGrammarDrillExercises,
  generateLessonExercises,
  type InteractiveExercise,
} from "@/modules/daily-english/exercise-generator";
import { StudioOnboarding } from "@/components/daily-mission/studio/StudioOnboarding";
import { LearningPathView } from "@/components/daily-mission/studio/LearningPathView";
import { InteractiveLessonRunner } from "@/components/daily-mission/studio/InteractiveLessonRunner";
import { StoriesView } from "@/components/daily-mission/studio/StoriesView";
import { PracticeHubView } from "@/components/daily-mission/studio/PracticeHubView";
import { SpeedBlitzGame } from "@/components/daily-mission/studio/SpeedBlitzGame";
import { TrophiesAndShopView } from "@/components/daily-mission/studio/TrophiesAndShopView";
import { GlossyProgressBar } from "@/components/daily-mission/studio/StudioPrimitives";
import { playTapSound } from "@/components/daily-mission/studio/sound-effects";

type StudioMode =
  | "onboarding"
  | "path"
  | "stories"
  | "practice"
  | "shop"
  | "blitz"
  | "lesson"
  | "guided";

const STEPS: { key: MissionStep; label: string; icon: React.ReactNode }[] = [
  { key: "words", label: "Mots du jour", icon: <BookOpen className="h-4 w-4" /> },
  { key: "sentences", label: "Phrases", icon: <PenLine className="h-4 w-4" /> },
  { key: "speaking", label: "Oral", icon: <Mic className="h-4 w-4" /> },
  { key: "correction", label: "Correction", icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: "repeat", label: "Répétition", icon: <RotateCcw className="h-4 w-4" /> },
  { key: "done", label: "Terminé", icon: <PartyPopper className="h-4 w-4" /> },
];

const noSubscription = () => () => {};
const todayLabel = () =>
  new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function safeStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

// Lightweight client external store for localStorage-backed gamification state (SSR-safe).
const gamificationListeners = new Set<() => void>();
let cachedGamification: GamificationState | null = null;
// The snapshot is re-read when the calendar day changes so day-scoped counters
// (today's XP, hearts, quests) roll over even if the tab stays open overnight.
let cachedGamificationDay: string | null = null;

function notifyGamificationListeners() {
  for (const listener of gamificationListeners) listener();
}

function onGamificationStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== GAMIFICATION_STATE_KEY) return;
  cachedGamification = null;
  notifyGamificationListeners();
}

function onGamificationVisibility() {
  if (document.visibilityState === "visible" && cachedGamificationDay !== dayKey(new Date())) {
    notifyGamificationListeners();
  }
}

function subscribeGamification(listener: () => void) {
  if (gamificationListeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onGamificationStorage);
    document.addEventListener("visibilitychange", onGamificationVisibility);
  }
  gamificationListeners.add(listener);
  return () => {
    gamificationListeners.delete(listener);
    if (gamificationListeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onGamificationStorage);
      document.removeEventListener("visibilitychange", onGamificationVisibility);
    }
  };
}

function getGamificationSnapshot(): GamificationState {
  const today = dayKey(new Date());
  if (!cachedGamification || cachedGamificationDay !== today) {
    cachedGamification = readGamificationState(safeStorage(), today);
    cachedGamificationDay = today;
  }
  return cachedGamification;
}

function getServerGamificationSnapshot(): GamificationState {
  return DEFAULT_GAMIFICATION_STATE;
}

function commitGamification(next: GamificationState): void {
  cachedGamification = next;
  cachedGamificationDay = dayKey(new Date());
  writeGamificationState(safeStorage(), next);
  notifyGamificationListeners();
}

export function DailyEnglishMission() {
  return (
    <MotionConfig reducedMotion="user">
      <DailyEnglishStudio />
    </MotionConfig>
  );
}

function DailyEnglishStudio() {
  const todayText = useSyncExternalStore(noSubscription, todayLabel, () => "");
  const todayKey = useSyncExternalStore(noSubscription, () => dayKey(new Date()), () => "2026-01-01");
  const isClient = useSyncExternalStore(noSubscription, () => true, () => false);
  const gamification = useSyncExternalStore(
    subscribeGamification,
    getGamificationSnapshot,
    getServerGamificationSnapshot,
  );

  const {
    words,
    mission,
    currentStep,
    error,
    persistence,
    setWords,
    setMission,
    setPersistence,
    setPersonalSentence,
    setStep,
    setError,
  } = useMissionStore();

  const [modeOverride, setModeOverride] = useState<StudioMode | null>(null);
  const mode: StudioMode =
    modeOverride ?? (gamification.onboarding.completed ? "path" : "onboarding");
  const [returnMode, setReturnMode] = useState<StudioMode>("path");
  const [activeLesson, setActiveLesson] = useState<{
    node: PathNode;
    exercises: InteractiveExercise[];
    isGrammarDrill?: boolean;
  } | null>(null);
  const missionAwardedRef = useRef<string | null>(null);
  const missionFetchedRef = useRef(false);

  const persistGamification = useCallback((next: GamificationState) => {
    commitGamification(next);
  }, []);

  // Preload today's mission words once so both the Path and the 6-step Mission share the exact same 10 words
  useEffect(() => {
    if (words.length > 0 || missionFetchedRef.current) return;
    missionFetchedRef.current = true;
    void loadTodayMission()
      .then((data) => {
        setPersistence(data.persistence);
        setWords(data.words);
        setMission(data.mission);
        try {
          const saved = JSON.parse(data.mission.personalSentencesJson || "{}") as Record<string, unknown>;
          for (const [wordId, sentence] of Object.entries(saved)) {
            if (typeof sentence === "string" && sentence.trim()) {
              setPersonalSentence(wordId, sentence);
            }
          }
        } catch {
          // ignore malformed saved json
        }
      })
      .catch(() => {
        missionFetchedRef.current = false;
      });
  }, [words.length, setMission, setPersistence, setPersonalSentence, setWords]);

  // Award gamification XP once when the full 6-step Daily Mission is completed
  useEffect(() => {
    if (!isClient || !mission?.completed) return;
    const nodeId = `daily:${todayKey}:mission`;
    if (missionAwardedRef.current === nodeId || gamification.completedNodes[nodeId]) return;
    missionAwardedRef.current = nodeId;
    const summary = recordLessonCompletion(getGamificationSnapshot(), {
      nodeId,
      correctCount: 10,
      totalCount: 10,
      maxCombo: 5,
      baseXp: 40,
      today: todayKey,
    });
    persistGamification(claimCompletedQuests(summary.state, true, todayKey).state);
  }, [gamification, isClient, mission?.completed, persistGamification, todayKey]);

  const localReviews = useMemo(() => {
    if (!isClient) return {};
    return readLocalState(safeStorage()).reviews;
  }, [isClient, mission?.completed]);

  const progressSummary = useMemo(() => {
    if (!isClient) return null;
    return browserProgressSummary();
  }, [isClient, mission?.completed, gamification.lessonsCompletedToday]);

  const dailyVocabulary = useMemo<VocabularyWord[]>(() => {
    const mapped = words
      .map((w) => vocabularyEntry(w.word))
      .filter((entry): entry is VocabularyWord => entry !== null);
    return mapped.length >= 4 ? mapped : [...VOCABULARY.slice(0, 10)];
  }, [words]);

  const units = useMemo(
    () =>
      buildLearningPathUnits(
        localReviews,
        gamification.completedNodes,
        todayKey,
        gamification.onboarding.focusTrack,
        Boolean(mission?.completed),
      ),
    [
      gamification.completedNodes,
      gamification.onboarding.focusTrack,
      localReviews,
      mission?.completed,
      todayKey,
    ],
  );

  const bonusUnits = useMemo(
    () => buildBonusPathUnits(gamification.completedNodes),
    [gamification.completedNodes],
  );

  const quests = useMemo(
    () => buildDailyQuests(gamification, Boolean(mission?.completed)),
    [gamification, mission?.completed],
  );

  const allGeneratorWords = useMemo(() => asGeneratorWords(ALL_STUDIO_VOCABULARY), []);

  const handleCompleteOnboarding = useCallback(
    (prefs: { focusTrack: FocusTrack; dailyGoalXp: DailyGoalXp }) => {
      const next = updateOnboardingPreferences(getGamificationSnapshot(), {
        completed: true,
        focusTrack: prefs.focusTrack,
        dailyGoalXp: prefs.dailyGoalXp,
      });
      persistGamification(next);
      setModeOverride("path");
    },
    [persistGamification],
  );

  const handleSkipOnboarding = useCallback(() => {
    const next = updateOnboardingPreferences(getGamificationSnapshot(), { completed: true });
    persistGamification(next);
    setModeOverride("path");
  }, [persistGamification]);

  const handleStartNode = useCallback(
    (node: PathNode) => {
      if (node.kind === "mission_guided") {
        setModeOverride("guided");
        return;
      }
      const targetWords = wordsForPathNode(node, dailyVocabulary, VOCABULARY);
      const seed = `${node.id}:${todayKey}:${gamification.lessonsCompletedToday}`;
      const exercises = generateLessonExercises(targetWords, node.kind, seed, allGeneratorWords);
      setReturnMode("path");
      setActiveLesson({ node, exercises });
      setModeOverride("lesson");
    },
    [allGeneratorWords, dailyVocabulary, gamification.lessonsCompletedToday, todayKey],
  );

  const handleLaunchGrammarDrill = useCallback(() => {
    const seed = `${todayKey}:${gamification.grammarDrillsCompleted}:${gamification.lessonsCompletedToday}`;
    const exercises = generateGrammarDrillExercises(seed, allGeneratorWords);
    const drillNode: PathNode = {
      id: `practice:grammar:${todayKey}`,
      unitId: "practice",
      kind: "checkpoint",
      title: "Chasse aux Pièges Francophones",
      subtitle: "6 erreurs fréquentes + 2 dictées rapides",
      xpReward: 25,
      packId: "daily",
      wordRange: [0, 10],
      state: "unlocked",
      stars: 0,
    };
    setReturnMode("practice");
    setActiveLesson({ node: drillNode, exercises, isGrammarDrill: true });
    setModeOverride("lesson");
  }, [allGeneratorWords, gamification.grammarDrillsCompleted, gamification.lessonsCompletedToday, todayKey]);

  const handleLaunchSmartReview = useCallback(() => {
    const seed = `smart:${todayKey}:${gamification.lessonsCompletedToday}`;
    const exercises = generateLessonExercises(allGeneratorWords, "checkpoint", seed, allGeneratorWords);
    const reviewNode: PathNode = {
      id: `practice:smart:${todayKey}`,
      unitId: "practice",
      kind: "checkpoint",
      title: "Révision Éclair · 240 termes",
      subtitle: "Mix complet : écoute, frappe libre, banque de mots et grammaire",
      xpReward: 30,
      packId: "daily",
      wordRange: [0, 10],
      state: "unlocked",
      stars: 0,
    };
    setReturnMode("practice");
    setActiveLesson({ node: reviewNode, exercises });
    setModeOverride("lesson");
  }, [allGeneratorWords, gamification.lessonsCompletedToday, todayKey]);

  const handleLoseHeart = useCallback(() => {
    commitGamification(consumeHeart(getGamificationSnapshot()));
  }, []);

  const handleRefillHearts = useCallback(() => {
    commitGamification(refillHearts(getGamificationSnapshot()));
  }, []);

  const handleToggleSound = useCallback(() => {
    const current = getGamificationSnapshot();
    commitGamification(
      updateOnboardingPreferences(current, {
        soundEnabled: !current.onboarding.soundEnabled,
      }),
    );
  }, []);

  const handleLessonComplete = useCallback(
    (result: { correctCount: number; totalCount: number; maxCombo: number }): LessonRewardSummary => {
      const nodeId = activeLesson?.node.id ?? `daily:${todayKey}:practice`;
      const summary = recordLessonCompletion(getGamificationSnapshot(), {
        nodeId,
        correctCount: result.correctCount,
        totalCount: result.totalCount,
        maxCombo: result.maxCombo,
        baseXp: activeLesson?.node.xpReward ?? 20,
        today: todayKey,
      });
      const withDrill = activeLesson?.isGrammarDrill
        ? markGrammarDrillCompleted(summary.state)
        : summary.state;
      const claimed = claimCompletedQuests(withDrill, Boolean(mission?.completed), todayKey);
      persistGamification(claimed.state);
      return { ...summary, state: claimed.state, claimedQuests: claimed.claimedQuests };
    },
    [activeLesson, mission?.completed, persistGamification, todayKey],
  );

  const handleStoryComplete = useCallback(
    (input: { storyId: string; xpReward: number }) => {
      const result = recordStoryCompletion(getGamificationSnapshot(), {
        storyId: input.storyId,
        xpReward: input.xpReward,
        today: todayKey,
      });
      const claimed = claimCompletedQuests(result.state, Boolean(mission?.completed), todayKey);
      persistGamification(claimed.state);
      return { xpEarned: result.xpEarned, gemsEarned: result.gemsEarned, boosted: result.boosted };
    },
    [mission?.completed, persistGamification, todayKey],
  );

  const handleBlitzFinish = useCallback(
    (score: number) => {
      const result = recordBlitzRun(getGamificationSnapshot(), { score, today: todayKey });
      const claimed = claimCompletedQuests(result.state, Boolean(mission?.completed), todayKey);
      persistGamification(claimed.state);
      return {
        xpEarned: result.xpEarned,
        gemsEarned: result.gemsEarned,
        isNewBest: result.isNewBest,
      };
    },
    [mission?.completed, persistGamification, todayKey],
  );

  const handlePurchase = useCallback(
    (itemId: ShopItemId): ShopPurchaseResult => {
      const result = purchaseShopItem(getGamificationSnapshot(), itemId);
      if (result.ok) {
        persistGamification(result.state);
      }
      return result;
    },
    [persistGamification],
  );

  const handleEquipAccessory = useCallback(
    (accessoryId: MascotAccessoryId | null) => {
      persistGamification(equipMascotAccessory(getGamificationSnapshot(), accessoryId));
    },
    [persistGamification],
  );

  if (mode === "onboarding") {
    return (
      <StudioOnboarding
        initialFocusTrack={gamification.onboarding.focusTrack}
        initialDailyGoal={gamification.onboarding.dailyGoalXp}
        soundEnabled={gamification.onboarding.soundEnabled}
        onComplete={handleCompleteOnboarding}
        onSkipToPath={handleSkipOnboarding}
        onOpenGuidedMission={() => setModeOverride("guided")}
      />
    );
  }

  if (mode === "lesson" && activeLesson) {
    return (
      <InteractiveLessonRunner
        node={activeLesson.node}
        exercises={activeLesson.exercises}
        hearts={gamification.hearts}
        soundEnabled={gamification.onboarding.soundEnabled}
        equippedAccessory={gamification.equippedAccessory}
        onLoseHeart={handleLoseHeart}
        onRefillHearts={handleRefillHearts}
        onComplete={handleLessonComplete}
        onExit={() => {
          setActiveLesson(null);
          setModeOverride(returnMode);
        }}
      />
    );
  }

  if (mode === "blitz") {
    return (
      <SpeedBlitzGame
        bestScore={gamification.bestBlitzScore}
        soundEnabled={gamification.onboarding.soundEnabled}
        equippedAccessory={gamification.equippedAccessory}
        onFinish={handleBlitzFinish}
        onExit={() => setModeOverride("practice")}
      />
    );
  }

  // Primary Studio Tabs Bar (visible on path / stories / practice / shop)
  const studioTabs: ReadonlyArray<{
    id: "path" | "stories" | "practice" | "shop" | "guided";
    label: string;
    badge?: string;
    icon: typeof Compass;
  }> = [
    { id: "path", label: "Parcours", badge: "9 unités", icon: Compass },
    {
      id: "stories",
      label: "Histoires",
      badge: `${gamification.completedStoryIds.length}/${ENGINEERING_STORIES.length}`,
      icon: BookOpenText,
    },
    { id: "practice", label: "Entraînement", badge: "240 mots", icon: Dumbbell },
    { id: "shop", label: "Boutique & Succès", icon: Trophy },
    { id: "guided", label: "Mission orale", icon: Mic },
  ];

  const renderTabBar = () => (
    <nav
      aria-label="Sections du Studio Daily English"
      className="elos-studio mb-5 flex items-center gap-2 overflow-x-auto pb-1"
    >
      {studioTabs.map((tab) => {
        const Icon = tab.icon;
        const active = mode === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              playTapSound(gamification.onboarding.soundEnabled);
              setModeOverride(tab.id);
            }}
            aria-current={active ? "page" : undefined}
            className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
              active
                ? "border-[#047857] bg-[#059669] text-white shadow-[0_3px_0_#047857]"
                : "border-[#E2E8F0] bg-white text-[#475569] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC] hover:text-[#1E293B]"
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`rounded-lg px-1.5 py-0.5 text-[10px] font-black ${
                  active ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#64748B]"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  if (mode === "path") {
    return (
      <div>
        {renderTabBar()}
        <LearningPathView
          gamification={gamification}
          units={units}
          bonusUnits={bonusUnits}
          quests={quests}
          progressSummary={progressSummary}
          todayLabel={todayText}
          dailyVocabulary={dailyVocabulary}
          allVocabulary={VOCABULARY}
          onStartNode={handleStartNode}
          onOpenGuidedMission={() => setModeOverride("guided")}
          onRefillHearts={handleRefillHearts}
          onToggleSound={handleToggleSound}
          onOpenOnboarding={() => setModeOverride("onboarding")}
        />
      </div>
    );
  }

  if (mode === "stories") {
    return (
      <div>
        {renderTabBar()}
        <StoriesView
          completedStoryIds={gamification.completedStoryIds}
          soundEnabled={gamification.onboarding.soundEnabled}
          equippedAccessory={gamification.equippedAccessory}
          onStoryComplete={handleStoryComplete}
        />
      </div>
    );
  }

  if (mode === "practice") {
    return (
      <div>
        {renderTabBar()}
        <PracticeHubView
          bestBlitzScore={gamification.bestBlitzScore}
          grammarDrillsCompleted={gamification.grammarDrillsCompleted}
          reviews={localReviews}
          soundEnabled={gamification.onboarding.soundEnabled}
          equippedAccessory={gamification.equippedAccessory}
          onLaunchBlitz={() => setModeOverride("blitz")}
          onLaunchGrammarDrill={handleLaunchGrammarDrill}
          onLaunchSmartReview={handleLaunchSmartReview}
        />
      </div>
    );
  }

  if (mode === "shop") {
    return (
      <div>
        {renderTabBar()}
        <TrophiesAndShopView
          gamification={gamification}
          missionCompletedToday={Boolean(mission?.completed)}
          onPurchase={handlePurchase}
          onEquipAccessory={handleEquipAccessory}
        />
      </div>
    );
  }

  // Full 6-step Guided Mission (Words → Sentences → Speaking → Correction → Repeat → Done)
  const stepIndex = STEPS.findIndex((step) => step.key === currentStep);
  const stepPct = Math.round(((stepIndex + 1) / STEPS.length) * 100);

  return (
    <div className="elos-studio overflow-hidden rounded-3xl border-2 border-[#E2E8F0] bg-white shadow-sm">
      <header className="border-b-2 border-[#E2E8F0] bg-white">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setModeOverride("path")}
              className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-[#E2E8F0] bg-white px-3 text-xs font-extrabold uppercase tracking-wider text-[#334155] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC] active:translate-y-[2px] active:shadow-none"
            >
              <ArrowLeft className="h-4 w-4" />
              Parcours
            </button>
            <div>
              <h1 className="text-lg font-black tracking-tight text-[#1E293B]">
                Mission du jour (6 étapes)
              </h1>
              <p className="text-xs font-semibold text-[#64748B]">
                {todayText}
                {" · "}
                <Link
                  href="/daily-english/roleplay"
                  className="font-bold text-[#6366F1] underline-offset-2 hover:underline"
                >
                  Jeux de rôle oraux
                </Link>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {persistence === "browser" && (
              <Badge
                variant="outline"
                className="rounded-xl border-2 border-[#E2E8F0] text-xs font-bold text-[#64748B]"
                title="Progression enregistrée uniquement dans ce navigateur"
              >
                Mode local
              </Badge>
            )}
            <Badge className="rounded-xl bg-[#D1FAE5] px-3 py-1 text-xs font-black text-[#047857] hover:bg-[#D1FAE5]">
              Étape {stepIndex + 1}/{STEPS.length}
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl space-y-3 px-4 pt-5">
        <GlossyProgressBar value={stepPct} />
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" aria-label="Étapes de la mission">
          {STEPS.map((step, index) => {
            const isActive = step.key === currentStep;
            const isPast = index < stepIndex;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => {
                  if (isPast || isActive) setStep(step.key);
                }}
                disabled={!isPast && !isActive}
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 ${
                  isActive
                    ? "border-[#047857] bg-[#059669] text-white shadow-[0_3px_0_#047857]"
                    : isPast
                      ? "cursor-pointer border-[#A7F3D0] bg-[#D1FAE5]/60 text-[#047857] hover:bg-[#D1FAE5]"
                      : "cursor-not-allowed border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]"
                }`}
              >
                {step.icon}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mx-auto max-w-2xl px-4 pt-3">
          <Card className="border-2 border-[#FECDD3] bg-[#FFE4E6]">
            <CardContent className="flex items-center justify-between p-3">
              <p className="text-sm font-bold text-[#E11D48]">{error}</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setError(null)}
                className="font-bold text-[#E11D48] hover:bg-white/40 hover:text-[#9F1239]"
              >
                Fermer
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="mx-auto max-w-2xl px-4 py-6">
        {currentStep === "words" && <WordsStep />}
        {currentStep === "sentences" && <SentencesStep />}
        {currentStep === "speaking" && <SpeakingStep />}
        {currentStep === "correction" && <CorrectionStep />}
        {currentStep === "repeat" && <RepeatStep />}
        {currentStep === "done" && <DoneStep />}
      </div>
    </div>
  );
}
