"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Check,
  Flame,
  Gem,
  Headphones,
  Heart,
  Layers,
  Lock,
  Mic,
  Play,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trophy,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  MAX_HEARTS,
  type DailyQuest,
  type GamificationState,
  type LearningPathUnit,
  type PathNode,
  type PathNodeKind,
  type PathThemeId,
} from "@/modules/daily-english/gamification";
import type { LocalProgressSummary } from "@/modules/daily-english/local-mission";
import type { VocabularyWord } from "@/modules/daily-english/vocabulary";
import { ALL_STUDIO_VOCABULARY, type StudioVocabularyWord } from "@/modules/daily-english/studio-content";
import { VoltMascot } from "./VoltMascot";
import { GlossyProgressBar, TactileButton, type TactileVariant } from "./StudioPrimitives";
import { playTapSound, speakEnglish } from "./sound-effects";

interface LearningPathViewProps {
  gamification: GamificationState;
  units: readonly LearningPathUnit[];
  bonusUnits: readonly LearningPathUnit[];
  quests: readonly DailyQuest[];
  progressSummary: LocalProgressSummary | null;
  todayLabel: string;
  dailyVocabulary: readonly VocabularyWord[];
  allVocabulary: readonly VocabularyWord[];
  onStartNode: (node: PathNode) => void;
  onOpenGuidedMission: () => void;
  onRefillHearts: () => void;
  onToggleSound: () => void;
  onOpenOnboarding: () => void;
}

const THEME_STYLES: Record<
  PathThemeId,
  {
    banner: string;
    bannerShadow: string;
    nodeBg: string;
    nodeShadow: string;
    ring: string;
    badge: string;
    ctaVariant: TactileVariant;
  }
> = {
  emerald: {
    banner: "bg-[#059669]",
    bannerShadow: "shadow-[0_4px_0_#047857]",
    nodeBg: "bg-[#059669]",
    nodeShadow: "shadow-[0_6px_0_#047857]",
    ring: "border-[#059669]",
    badge: "bg-[#047857] text-white",
    ctaVariant: "primary",
  },
  indigo: {
    banner: "bg-[#6366F1]",
    bannerShadow: "shadow-[0_4px_0_#4338CA]",
    nodeBg: "bg-[#6366F1]",
    nodeShadow: "shadow-[0_6px_0_#4338CA]",
    ring: "border-[#6366F1]",
    badge: "bg-[#4338CA] text-white",
    ctaVariant: "info",
  },
  violet: {
    banner: "bg-[#A855F7]",
    bannerShadow: "shadow-[0_4px_0_#7E22CE]",
    nodeBg: "bg-[#A855F7]",
    nodeShadow: "shadow-[0_6px_0_#7E22CE]",
    ring: "border-[#A855F7]",
    badge: "bg-[#7E22CE] text-white",
    ctaVariant: "accent",
  },
  orange: {
    banner: "bg-[#F97316]",
    bannerShadow: "shadow-[0_4px_0_#C2410C]",
    nodeBg: "bg-[#F97316]",
    nodeShadow: "shadow-[0_6px_0_#C2410C]",
    ring: "border-[#F97316]",
    badge: "bg-[#C2410C] text-white",
    ctaVariant: "warning",
  },
  cyan: {
    banner: "bg-[#06B6D4]",
    bannerShadow: "shadow-[0_4px_0_#0E7490]",
    nodeBg: "bg-[#06B6D4]",
    nodeShadow: "shadow-[0_6px_0_#0E7490]",
    ring: "border-[#06B6D4]",
    badge: "bg-[#0E7490] text-white",
    ctaVariant: "secondary",
  },
};

function nodeIcon(kind: PathNodeKind) {
  switch (kind) {
    case "warmup":
      return BookOpen;
    case "word_bank":
      return Sparkles;
    case "match_pairs":
      return Layers;
    case "listening":
      return Headphones;
    case "mission_guided":
      return Mic;
    case "checkpoint":
      return Trophy;
  }
}

/** Smooth S-curve horizontal offset pattern (in px) for the winding learning path. */
const PATH_OFFSETS = [0, -52, -72, -32, 36, 68, 32] as const;

export function LearningPathView({
  gamification,
  units,
  bonusUnits,
  quests,
  progressSummary,
  todayLabel,
  dailyVocabulary,
  allVocabulary,
  onStartNode,
  onOpenGuidedMission,
  onRefillHearts,
  onToggleSound,
  onOpenOnboarding,
}: LearningPathViewProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [guideUnitId, setGuideUnitId] = useState<string | null>(null);

  const soundEnabled = gamification.onboarding.soundEnabled;
  const effectiveStreak = Math.max(gamification.streak, progressSummary?.streak ?? 0);
  const dailyGoalPct = Math.min(
    100,
    Math.round((gamification.todayXp / Math.max(1, gamification.onboarding.dailyGoalXp)) * 100),
  );

  const allUnits = [...units, ...bonusUnits];
  const guideUnit = allUnits.find((u) => u.id === guideUnitId) ?? null;
  const guideWords: readonly StudioVocabularyWord[] = guideUnit
    ? guideUnit.packId === "daily"
      ? dailyVocabulary
      : ALL_STUDIO_VOCABULARY.filter((w) => w.pack === guideUnit.packId)
    : [];
  // Keep `allVocabulary` referenced cleanly for core prop compatibility.
  void allVocabulary;

  return (
    <div className="elos-studio space-y-6">
      {/* Top sticky Gamification HUD */}
      <div className="sticky top-16 z-20 rounded-2xl border-2 border-[#E2E8F0] bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Stats strip: Streak, XP, Gems, Hearts */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div
              className="flex items-center gap-1.5 rounded-xl border-2 border-[#FFEDD5] bg-[#FFEDD5]/70 px-3 py-1.5"
              title="Série de jours actifs"
            >
              <Flame className="h-4 w-4 fill-[#F97316] text-[#F97316]" />
              <span className="text-sm font-black text-[#C2410C]">{effectiveStreak}</span>
            </div>

            <div
              className="flex items-center gap-1.5 rounded-xl border-2 border-[#FFEDD5] bg-[#FFF7ED] px-3 py-1.5"
              title={`Objectif du jour : ${gamification.todayXp}/${gamification.onboarding.dailyGoalXp} XP`}
            >
              <Star className="h-4 w-4 fill-[#FBBF24] text-[#FBBF24]" />
              <span className="text-sm font-black text-[#B45309]">{gamification.xp} XP</span>
            </div>

            <div
              className="flex items-center gap-1.5 rounded-xl border-2 border-[#E0E7FF] bg-[#EEF2FF] px-3 py-1.5"
              title="Gemmes gagnées"
            >
              <Gem className="h-4 w-4 fill-[#6366F1] text-[#4338CA]" />
              <span className="text-sm font-black text-[#4338CA]">{gamification.gems}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                if (gamification.hearts < MAX_HEARTS) {
                  playTapSound(soundEnabled);
                  onRefillHearts();
                }
              }}
              className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 transition-colors ${
                gamification.hearts === 0
                  ? "cursor-pointer border-[#F43F5E] bg-[#FFE4E6] hover:bg-[#FECDD3]"
                  : "border-[#FFE4E6] bg-[#FFF1F2]"
              }`}
              title={
                gamification.hearts < MAX_HEARTS
                  ? "Cliquer pour recharger tes cœurs gratuitement"
                  : "Cœurs pleins"
              }
            >
              <Heart className="h-4 w-4 fill-[#F43F5E] text-[#F43F5E]" />
              <span className="text-sm font-black text-[#E11D48]">
                {gamification.hearts}/{MAX_HEARTS}
              </span>
              {gamification.hearts < MAX_HEARTS && (
                <span className="text-[10px] font-extrabold uppercase text-[#E11D48]">+ Recharger</span>
              )}
            </button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                playTapSound(!soundEnabled);
                onToggleSound();
              }}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border-2 border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1E293B]"
              aria-label={soundEnabled ? "Couper les sons" : "Activer les sons"}
              title={soundEnabled ? "Sons activés" : "Sons coupés"}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                playTapSound(soundEnabled);
                onOpenOnboarding();
              }}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-[#E2E8F0] bg-white px-3 text-xs font-extrabold text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1E293B]"
              title="Objectif XP & thème prioritaire"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Objectif</span>
            </button>
            <TactileButton
              variant="outline"
              size="sm"
              onClick={() => {
                playTapSound(soundEnabled);
                onOpenGuidedMission();
              }}
            >
              <Mic className="h-3.5 w-3.5" />
              Mission 6 étapes
            </TactileButton>
          </div>
        </div>
      </div>

      {/* Main 2-column layout: Winding Path + Right Quests/Stats Sidebar */}
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        {/* Winding Path Column */}
        <div className="space-y-8">
          {allUnits.map((unit, unitListIdx) => {
            const theme = THEME_STYLES[unit.theme];
            const isFirstBonus = unitListIdx === units.length && bonusUnits.length > 0;
            return (
              <div key={unit.id} className="space-y-4">
                {isFirstBonus && (
                  <div className="flex items-center gap-3 pt-2">
                    <div className="h-0.5 flex-1 bg-[#E2E8F0]" />
                    <span className="rounded-xl border-2 border-[#C7D2FE] bg-[#EEF2FF] px-3.5 py-1 text-xs font-black uppercase tracking-wider text-[#4338CA]">
                      Parcours Avancé Ingénieur (+90 termes B2–C1)
                    </span>
                    <div className="h-0.5 flex-1 bg-[#E2E8F0]" />
                  </div>
                )}
              <section
                aria-label={unit.title}
                className="overflow-visible rounded-3xl border-2 border-[#E2E8F0] bg-white pb-8 shadow-sm"
              >
                {/* Unit Banner Header */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-t-[22px] px-5 py-4 text-white ${theme.banner} ${theme.bannerShadow}`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-black/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider">
                        {unit.level}
                      </span>
                      <span className="text-xs font-bold text-white/90">
                        {unit.completedCount}/{unit.totalCount} étapes
                      </span>
                    </div>
                    <h2 className="text-lg font-black tracking-tight sm:text-xl">{unit.title}</h2>
                    <p className="text-xs font-semibold text-white/90">{unit.subtitle}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      playTapSound(soundEnabled);
                      setGuideUnitId(unit.id);
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border-2 border-white/30 bg-black/10 px-3 py-2 text-xs font-extrabold uppercase tracking-wider text-white transition-colors hover:bg-black/20"
                  >
                    <BookOpen className="h-4 w-4" />
                    Guide
                  </button>
                </div>

                {/* S-Curve Nodes */}
                <div className="relative mt-8 flex flex-col items-center gap-7 px-4">
                  {/* Companion mascot standing alongside the first unit */}
                  {unit.unitNumber === 1 && (
                    <div className="pointer-events-none absolute right-6 top-16 hidden sm:block">
                      <VoltMascot
                        mood={unit.completedCount > 0 ? "happy" : "idle"}
                        size={92}
                        accessory={gamification.equippedAccessory}
                      />
                    </div>
                  )}

                  {unit.nodes.map((node, index) => {
                    const Icon = nodeIcon(node.kind);
                    const offset = PATH_OFFSETS[index % PATH_OFFSETS.length];
                    const isSelected = selectedNodeId === node.id;
                    const isCompleted = node.state === "completed";
                    const isCurrent = node.state === "current";
                    const isLocked = node.state === "locked";

                    return (
                      <div
                        key={node.id}
                        className="relative flex flex-col items-center"
                        style={{ transform: `translateX(${offset}px)` }}
                      >
                        {/* Floating "COMMENCER" callout above the active node */}
                        {isCurrent && !isSelected && (
                          <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                            className="mb-2 rounded-xl border-2 border-[#E2E8F0] bg-white px-3 py-1 text-xs font-black uppercase tracking-wider text-[#059669] shadow-sm"
                          >
                            Commencer
                          </motion.div>
                        )}

                        <div className="relative">
                          {isCurrent && (
                            <span
                              className={`animate-studio-ring pointer-events-none absolute -inset-2 rounded-full border-4 ${theme.ring}`}
                              aria-hidden="true"
                            />
                          )}

                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => {
                              playTapSound(soundEnabled);
                              setSelectedNodeId(isSelected ? null : node.id);
                            }}
                            aria-label={`${node.title} (${isLocked ? "verrouillé" : isCompleted ? "terminé" : "disponible"})`}
                            className={`relative flex h-[74px] w-[74px] items-center justify-center rounded-full border-4 transition-transform duration-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] focus-visible:ring-offset-2 ${
                              isLocked
                                ? "cursor-not-allowed border-[#E2E8F0] bg-[#E2E8F0] text-[#94A3B8] shadow-[0_6px_0_#CBD5E1]"
                                : isCompleted
                                  ? "cursor-pointer border-[#FDE68A] bg-[#FBBF24] text-white shadow-[0_6px_0_#D97706] active:translate-y-[4px] active:shadow-none"
                                  : `cursor-pointer border-white/40 text-white ${theme.nodeBg} ${theme.nodeShadow} active:translate-y-[4px] active:shadow-none`
                            }`}
                          >
                            {isLocked ? (
                              <Lock className="h-7 w-7" />
                            ) : isCompleted ? (
                              <Check className="h-8 w-8 stroke-[3.5]" />
                            ) : (
                              <Icon className="h-8 w-8" />
                            )}
                          </button>

                          {/* Star pills under completed nodes */}
                          {isCompleted && node.stars > 0 && (
                            <div className="mt-2 flex items-center justify-center gap-0.5">
                              {[1, 2, 3].map((starIdx) => (
                                <Star
                                  key={starIdx}
                                  className={`h-3.5 w-3.5 ${
                                    starIdx <= node.stars
                                      ? "fill-[#FBBF24] text-[#D97706]"
                                      : "fill-[#E2E8F0] text-[#E2E8F0]"
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        <p className="mt-1.5 max-w-[160px] text-center text-xs font-extrabold text-[#334155]">
                          {node.title}
                        </p>

                        {/* Popover Launch Card */}
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ opacity: 0, y: -6, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.96 }}
                              transition={{ duration: 0.16 }}
                              className="z-30 mt-3 w-72 rounded-2xl border-2 border-[#E2E8F0] bg-white p-4 text-left shadow-xl"
                              style={{ transform: `translateX(${-offset * 0.5}px)` }}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-sm font-black text-[#1E293B]">{node.title}</p>
                                  <p className="mt-0.5 text-xs leading-5 text-[#64748B]">{node.subtitle}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedNodeId(null)}
                                  className="rounded-lg p-1 text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#1E293B]"
                                  aria-label="Fermer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>

                              <div className="mt-4">
                                <TactileButton
                                  variant={isCompleted ? "warning" : theme.ctaVariant}
                                  size="md"
                                  className="w-full"
                                  onClick={() => {
                                    playTapSound(soundEnabled);
                                    setSelectedNodeId(null);
                                    onStartNode(node);
                                  }}
                                >
                                  <Play className="h-4 w-4 fill-current" />
                                  {isCompleted ? `Réviser (+${node.xpReward} XP)` : `Démarrer (+${node.xpReward} XP)`}
                                </TactileButton>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </section>
              </div>
            );
          })}
        </div>

        {/* Right Sidebar: Daily Goal, Quests, Real Spaced-Review Stats & Roleplay */}
        <aside className="space-y-4 lg:sticky lg:top-36">
          {/* Daily XP Goal card */}
          <div className="rounded-2xl border-2 border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase tracking-wide text-[#1E293B]">
                Objectif du jour
              </h3>
              <span className="text-xs font-extrabold text-[#047857]">
                {gamification.todayXp}/{gamification.onboarding.dailyGoalXp} XP
              </span>
            </div>
            <p className="mt-0.5 text-xs capitalize text-[#64748B]">{todayLabel || "Aujourd'hui"}</p>
            <GlossyProgressBar value={dailyGoalPct} className="mt-3" />
            <p className="mt-2 text-xs font-semibold text-[#64748B]">
              {dailyGoalPct >= 100
                ? "🎉 Objectif atteint ! Ta série du jour est sécurisée."
                : `Encore ${Math.max(0, gamification.onboarding.dailyGoalXp - gamification.todayXp)} XP pour valider ton objectif.`}
            </p>
          </div>

          {/* Quêtes du jour */}
          <div className="rounded-2xl border-2 border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wide text-[#1E293B]">
              Quêtes du jour
            </h3>
            <div className="mt-3 space-y-3.5">
              {quests.map((quest) => {
                const pct = Math.round((quest.current / Math.max(1, quest.target)) * 100);
                return (
                  <div key={quest.id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#334155]">
                      <span className={quest.completed ? "text-[#047857]" : ""}>{quest.title}</span>
                      <span className="flex shrink-0 items-center gap-2 font-extrabold text-[#64748B]">
                        {quest.current}/{quest.target}
                        <span
                          className={`inline-flex items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[11px] ${
                            quest.claimed ? "bg-[#D1FAE5] text-[#047857]" : "bg-[#EEF2FF] text-[#4338CA]"
                          }`}
                          title={quest.claimed ? "Récompense reçue" : "Récompense à la fin de la quête"}
                        >
                          {quest.claimed ? (
                            "✓"
                          ) : (
                            <>
                              <Gem className="h-3 w-3 fill-[#6366F1]" aria-hidden="true" />+{quest.rewardGems}
                            </>
                          )}
                          <span className="sr-only">
                            {quest.claimed
                              ? "Récompense reçue"
                              : `Récompense : ${quest.rewardGems} gemmes`}
                          </span>
                        </span>
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          quest.completed ? "bg-[#059669]" : "bg-[#FBBF24]"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real Spaced-Review Mastery Card */}
          <div className="rounded-2xl border-2 border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-wide text-[#1E293B]">
              Maîtrise Leitner
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-[#F8FAFC] p-3 text-center">
                <p className="text-xl font-black text-[#1E293B]">
                  {progressSummary?.seen ?? 0}
                  <span className="text-xs font-bold text-[#94A3B8]">/{progressSummary?.total ?? 150}</span>
                </p>
                <p className="text-[11px] font-bold text-[#64748B]">Mots travaillés</p>
              </div>
              <div className="rounded-xl bg-[#D1FAE5]/60 p-3 text-center">
                <p className="text-xl font-black text-[#047857]">{progressSummary?.mastered ?? 0}</p>
                <p className="text-[11px] font-bold text-[#047857]">Maîtrisés (30j+)</p>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <TactileButton
                variant="info"
                size="sm"
                className="w-full"
                onClick={() => {
                  playTapSound(soundEnabled);
                  onOpenGuidedMission();
                }}
              >
                <Mic className="h-4 w-4" />
                Mission complète (6 étapes)
              </TactileButton>
              <Link
                href="/daily-english/roleplay"
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#E2E8F0] bg-white text-xs font-extrabold uppercase tracking-wider text-[#334155] shadow-[0_3px_0_#E2E8F0] transition-colors hover:bg-[#F8FAFC]"
              >
                Jeux de rôle oraux →
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Unit Guide Modal (Vocabulary cheat-sheet with instant TTS) */}
      <AnimatePresence>
        {guideUnit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
            onClick={() => setGuideUnitId(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82vh] w-full max-w-lg overflow-hidden rounded-3xl border-2 border-[#E2E8F0] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b-2 border-[#E2E8F0] px-5 py-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-[#6366F1]">Guide d&apos;unité</p>
                  <h3 className="text-lg font-black text-[#1E293B]">{guideUnit.title}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setGuideUnitId(null)}
                  className="rounded-xl p-2 text-[#64748B] hover:bg-[#F8FAFC]"
                  aria-label="Fermer le guide"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[62vh] space-y-2.5 overflow-y-auto p-5">
                {guideWords.map((item) => (
                  <div
                    key={item.word}
                    className="flex items-start justify-between gap-3 rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC]/50 p-3.5"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-black text-[#1E293B]">{item.word}</span>
                        <span className="rounded-lg bg-white px-2 py-0.5 text-[11px] font-bold text-[#64748B]">
                          {item.category}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-[#4338CA]">{item.translation}</p>
                      <p className="mt-1 text-xs italic text-[#64748B]">“{item.example}”</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakEnglish(item.word)}
                      className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl border-2 border-[#E0E7FF] bg-[#E0E7FF] text-[#4338CA] shadow-[0_3px_0_#4338CA] active:translate-y-[2px] active:shadow-none"
                      aria-label={`Écouter ${item.word}`}
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
