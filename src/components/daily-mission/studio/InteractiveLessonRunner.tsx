"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Flame,
  Gem,
  Heart,
  RotateCcw,
  Sparkles,
  Target,
  Turtle,
  Volume2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  evaluateExerciseAnswer,
  type InteractiveExercise,
  type MatchPairsExercise,
} from "@/modules/daily-english/exercise-generator";
import {
  MAX_HEARTS,
  type LessonRewardSummary,
  type PathNode,
} from "@/modules/daily-english/gamification";
import type { MascotAccessoryId } from "@/modules/daily-english/studio-content";
import { VoltMascot, type MascotMood } from "./VoltMascot";
import { ConfettiBurst, GlossyProgressBar, TactileButton } from "./StudioPrimitives";
import {
  playComboSound,
  playCorrectSound,
  playIncorrectSound,
  playTapSound,
  playVictoryFanfare,
  speakEnglish,
} from "./sound-effects";

interface InteractiveLessonRunnerProps {
  node: PathNode;
  exercises: readonly InteractiveExercise[];
  hearts: number;
  soundEnabled: boolean;
  equippedAccessory?: MascotAccessoryId | null;
  onLoseHeart: () => void;
  onRefillHearts: () => void;
  onComplete: (result: {
    correctCount: number;
    totalCount: number;
    maxCombo: number;
  }) => LessonRewardSummary;
  onExit: () => void;
}

type FeedbackState =
  | { status: "idle" }
  | { status: "correct"; message: string; detail?: string }
  | { status: "incorrect"; expected: string; detail?: string };

const POSITIVE_PRAISES = [
  "Parfait !",
  "Excellent travail !",
  "Bien joué !",
  "Dans le mille !",
  "Impressionnant !",
] as const;

export function InteractiveLessonRunner({
  node,
  exercises,
  hearts,
  soundEnabled,
  equippedAccessory = null,
  onLoseHeart,
  onRefillHearts,
  onComplete,
  onExit,
}: InteractiveLessonRunnerProps) {
  const [queue, setQueue] = useState<InteractiveExercise[]>(() => [...exercises]);
  const [index, setIndex] = useState(0);
  const [isReviewRound, setIsReviewRound] = useState(false);
  const [missedIds, setMissedIds] = useState<Set<string>>(() => new Set());
  const [correctFirstPass, setCorrectFirstPass] = useState(0);
  // Exercises answered correctly at least once: drives a progress bar that never moves backwards.
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => new Set());
  const pairErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackState>({ status: "idle" });
  const [reward, setReward] = useState<LessonRewardSummary | null>(null);

  // Per-exercise input state
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [selectedTokenIndices, setSelectedTokenIndices] = useState<number[]>([]);
  const [showListeningHint, setShowListeningHint] = useState(false);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [showTypeHint, setShowTypeHint] = useState(false);

  // Match-pairs state
  const [pickedEnglish, setPickedEnglish] = useState<string | null>(null);
  const [pickedFrench, setPickedFrench] = useState<string | null>(null);
  const [matchedEnglish, setMatchedEnglish] = useState<Set<string>>(() => new Set());
  const [pairError, setPairError] = useState<{ en: string; fr: string } | null>(null);

  const current = queue[index] ?? null;
  const baseTotal = Math.max(1, exercises.length);
  const progressPct = reward ? 100 : Math.round((solvedIds.size / baseTotal) * 100);

  useEffect(
    () => () => {
      if (pairErrorTimer.current) clearTimeout(pairErrorTimer.current);
    },
    [],
  );

  const resetInputs = useCallback(() => {
    setSelectedChoice(null);
    setSelectedTokenIndices([]);
    setShowListeningHint(false);
    setTypedAnswer("");
    setShowTypeHint(false);
    setPickedEnglish(null);
    setPickedFrench(null);
    setMatchedEnglish(new Set());
    setPairError(null);
    setFeedback({ status: "idle" });
  }, []);

  // Auto-play audio cue on listening exercises when sound is enabled
  useEffect(() => {
    if (!current || reward || !soundEnabled) return;
    if (current.kind === "listening_choice") {
      const timer = setTimeout(() => {
        speakEnglish(current.speakText);
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [current, reward, soundEnabled]);

  const handleCorrectFeedback = useCallback(
    (detail?: string) => {
      const nextCombo = combo + 1;
      setCombo(nextCombo);
      setMaxCombo((prev) => Math.max(prev, nextCombo));
      if (!isReviewRound) {
        setCorrectFirstPass((prev) => prev + 1);
      }
      if (current) {
        setSolvedIds((prev) => (prev.has(current.id) ? prev : new Set(prev).add(current.id)));
      }
      if (nextCombo >= 3) {
        playComboSound(soundEnabled);
      } else {
        playCorrectSound(soundEnabled);
      }
      const praise = POSITIVE_PRAISES[(index + nextCombo) % POSITIVE_PRAISES.length];
      setFeedback({ status: "correct", message: praise, detail });
    },
    [combo, current, index, isReviewRound, soundEnabled],
  );

  const handleIncorrectFeedback = useCallback(
    (expected: string, detail?: string) => {
      setCombo(0);
      playIncorrectSound(soundEnabled);
      onLoseHeart();
      if (current && !missedIds.has(current.id)) {
        setMissedIds((prev) => {
          const next = new Set(prev);
          next.add(current.id);
          return next;
        });
        setQueue((prev) => [...prev, current]);
      }
      setFeedback({ status: "incorrect", expected, detail });
    },
    [current, missedIds, onLoseHeart, soundEnabled],
  );

  const canCheck = useMemo(() => {
    if (!current || feedback.status !== "idle") return false;
    if (current.kind === "word_bank") return selectedTokenIndices.length > 0;
    if (current.kind === "match_pairs") return matchedEnglish.size === current.pairs.length;
    if (current.kind === "type_answer") return typedAnswer.trim().length > 0;
    return selectedChoice !== null;
  }, [
    current,
    feedback.status,
    matchedEnglish.size,
    selectedChoice,
    selectedTokenIndices.length,
    typedAnswer,
  ]);

  const handleCheck = useCallback(() => {
    if (!current || feedback.status !== "idle") return;

    if (current.kind === "word_bank") {
      const tokens = selectedTokenIndices.map((idx) => current.bankTokens[idx]);
      const result = evaluateExerciseAnswer(current, tokens);
      if (result.correct) {
        handleCorrectFeedback(current.cueFrench);
      } else {
        handleIncorrectFeedback(result.expected, current.cueFrench);
      }
      return;
    }

    if (current.kind === "match_pairs") {
      if (matchedEnglish.size === current.pairs.length) {
        handleCorrectFeedback("Toutes les paires associées !");
      }
      return;
    }

    if (current.kind === "type_answer") {
      const result = evaluateExerciseAnswer(current, typedAnswer);
      if (result.correct) {
        const detail = result.almostCorrect
          ? `Presque parfait ! Orthographe exacte : « ${result.expected} » — “${current.example}”`
          : `“${current.example}”`;
        handleCorrectFeedback(detail);
      } else {
        handleIncorrectFeedback(result.expected, `“${current.example}”`);
      }
      return;
    }

    if (!selectedChoice) return;
    const result = evaluateExerciseAnswer(current, selectedChoice);
    const detail =
      current.kind === "translate_choice"
        ? `“${current.example}”`
        : current.kind === "listening_choice"
          ? `${current.speakText} — ${current.translationHint}`
          : current.kind === "spot_error"
            ? `${current.explanation} (${current.mnemonic})`
            : `${current.translationHint}`;

    if (result.correct) {
      handleCorrectFeedback(detail);
    } else {
      handleIncorrectFeedback(result.expected, detail);
    }
  }, [
    current,
    feedback.status,
    handleCorrectFeedback,
    handleIncorrectFeedback,
    matchedEnglish.size,
    selectedChoice,
    selectedTokenIndices,
    typedAnswer,
  ]);

  const handleContinue = useCallback(() => {
    playTapSound(soundEnabled);
    if (index + 1 >= queue.length) {
      playVictoryFanfare(soundEnabled);
      const summary = onComplete({
        correctCount: correctFirstPass,
        totalCount: baseTotal,
        maxCombo,
      });
      setReward(summary);
      return;
    }
    const nextIdx = index + 1;
    if (nextIdx >= baseTotal && !isReviewRound) {
      setIsReviewRound(true);
    }
    setIndex(nextIdx);
    resetInputs();
  }, [
    baseTotal,
    correctFirstPass,
    index,
    isReviewRound,
    maxCombo,
    onComplete,
    queue.length,
    resetInputs,
    soundEnabled,
  ]);

  // Match-pairs pairing handler
  const tryMatchPair = useCallback(
    (exercise: MatchPairsExercise, en: string | null, fr: string | null) => {
      if (!en || !fr) return;
      const pair = exercise.pairs.find((p) => p.english === en);
      if (pair && pair.french === fr) {
        playCorrectSound(soundEnabled);
        const nextMatched = new Set(matchedEnglish);
        nextMatched.add(en);
        setMatchedEnglish(nextMatched);
        setPickedEnglish(null);
        setPickedFrench(null);
        setPairError(null);
        if (nextMatched.size === exercise.pairs.length) {
          handleCorrectFeedback("Toutes les paires ont été associées !");
        }
      } else {
        playIncorrectSound(soundEnabled);
        setCombo(0);
        setPairError({ en, fr });
        if (pairErrorTimer.current) clearTimeout(pairErrorTimer.current);
        pairErrorTimer.current = setTimeout(() => {
          setPairError(null);
          setPickedEnglish(null);
          setPickedFrench(null);
        }, 420);
      }
    },
    [handleCorrectFeedback, matchedEnglish, soundEnabled],
  );

  // Keyboard shortcuts: 1-4 for choice selection, Enter for Verify / Continue
  useEffect(() => {
    if (reward || !current) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
      const targetTag = (event.target as HTMLElement | null)?.tagName;
      const inInput = targetTag === "INPUT" || targetTag === "TEXTAREA";

      if (event.key === "Enter") {
        event.preventDefault();
        if (feedback.status !== "idle") {
          handleContinue();
        } else if (canCheck) {
          handleCheck();
        }
        return;
      }
      if (inInput) return;

      if (feedback.status === "idle" && current.kind === "word_bank" && event.key === "Backspace") {
        event.preventDefault();
        setSelectedTokenIndices((prev) => prev.slice(0, -1));
        return;
      }
      if (
        feedback.status === "idle" &&
        (current.kind === "translate_choice" ||
          current.kind === "listening_choice" ||
          current.kind === "fill_blank" ||
          current.kind === "spot_error")
      ) {
        const num = Number(event.key);
        if (num >= 1 && num <= current.choices.length) {
          playTapSound(soundEnabled);
          setSelectedChoice(current.choices[num - 1]);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canCheck, current, feedback.status, handleCheck, handleContinue, reward, soundEnabled]);

  const mascotMood: MascotMood =
    feedback.status === "correct"
      ? "happy"
      : feedback.status === "incorrect"
        ? "oops"
        : current?.kind === "listening_choice"
          ? "listening"
          : "thinking";

  // Victory screen
  if (reward) {
    return (
      <div className="elos-studio relative overflow-hidden rounded-3xl border-2 border-[#E2E8F0] bg-white px-6 py-10 text-center shadow-sm sm:px-10">
        <ConfettiBurst />
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 20 }}
          className="relative mx-auto max-w-md space-y-6"
        >
          <VoltMascot mood="celebrating" size={136} accessory={equippedAccessory} />
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#047857]">
              Leçon terminée !
            </p>
            <h2 className="text-2xl font-black text-[#1E293B] sm:text-3xl">
              {reward.accuracy === 100 ? "Sans faute légendaire !" : "Super progression !"}
            </h2>
            <p className="text-sm font-semibold text-[#64748B]">{node.title}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border-2 border-[#FBBF24] bg-[#FFEDD5]/60 p-3">
              <p className="text-[11px] font-black uppercase text-[#C2410C]">Total XP</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xl font-black text-[#C2410C]">
                <Zap className="h-5 w-5 fill-[#FBBF24] text-[#D97706]" />+{reward.xpEarned}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#059669] bg-[#D1FAE5]/50 p-3">
              <p className="text-[11px] font-black uppercase text-[#047857]">Précision</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xl font-black text-[#047857]">
                <Target className="h-5 w-5" />
                {reward.accuracy}%
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#6366F1] bg-[#E0E7FF]/60 p-3">
              <p className="text-[11px] font-black uppercase text-[#4338CA]">Gemmes</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xl font-black text-[#4338CA]">
                <Gem className="h-5 w-5 fill-[#6366F1]" />+{reward.gemsEarned}
              </p>
            </div>
          </div>

          {(reward.comboBonus > 0 || reward.perfectBonus > 0 || reward.boosted) && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-extrabold">
              {reward.boosted && (
                <span className="rounded-xl bg-[#EEF2FF] px-3 py-1 text-[#4338CA]">
                  ⚡ Boost XP ×2 appliqué !
                </span>
              )}
              {reward.comboBonus > 0 && (
                <span className="rounded-xl bg-[#FFEDD5] px-3 py-1 text-[#C2410C]">
                  🔥 Bonus combo +{reward.comboBonus} XP (max {maxCombo})
                </span>
              )}
              {reward.perfectBonus > 0 && (
                <span className="rounded-xl bg-[#D1FAE5] px-3 py-1 text-[#047857]">
                  ✨ Bonus sans faute +{reward.perfectBonus} XP
                </span>
              )}
            </div>
          )}

          {reward.claimedQuests && reward.claimedQuests.length > 0 && (
            <div className="space-y-2 rounded-2xl border-2 border-[#E0E7FF] bg-[#EEF2FF] p-3 text-left">
              <p className="text-[11px] font-black uppercase tracking-wider text-[#4338CA]">
                Quête{reward.claimedQuests.length > 1 ? "s" : ""} accomplie{reward.claimedQuests.length > 1 ? "s" : ""} !
              </p>
              {reward.claimedQuests.map((quest) => (
                <p
                  key={quest.id}
                  className="flex items-center justify-between gap-2 text-xs font-extrabold text-[#1E293B]"
                >
                  <span>{quest.title}</span>
                  <span className="flex shrink-0 items-center gap-1 text-[#4338CA]">
                    <Gem className="h-3.5 w-3.5 fill-[#6366F1]" />+{quest.rewardGems}
                  </span>
                </p>
              ))}
            </div>
          )}

          <TactileButton variant="primary" size="lg" className="w-full" onClick={onExit}>
            Continuer sur le parcours
          </TactileButton>
        </motion.div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="elos-studio overflow-hidden rounded-3xl border-2 border-[#E2E8F0] bg-white shadow-sm">
      {/* Top Lesson HUD */}
      <div className="flex items-center gap-3 border-b-2 border-[#E2E8F0] px-4 py-4 sm:gap-4 sm:px-6">
        <button
          type="button"
          onClick={() => {
            playTapSound(soundEnabled);
            onExit();
          }}
          className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#94A3B8] transition-colors hover:bg-[#F8FAFC] hover:text-[#1E293B]"
          aria-label="Quitter la leçon"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex-1 space-y-1">
          <GlossyProgressBar value={progressPct} combo={combo} />
          <div className="flex items-center justify-between text-[11px] font-extrabold text-[#94A3B8]">
            <span>
              {isReviewRound ? "🔁 Révision de tes erreurs" : node.title}
            </span>
            <span>
              {index + 1}/{queue.length}
            </span>
          </div>
        </div>

        {/* Live Combo badge */}
        <AnimatePresence>
          {combo >= 2 && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="hidden items-center gap-1 rounded-xl bg-[#FFEDD5] px-2.5 py-1 text-xs font-black text-[#C2410C] sm:flex"
            >
              <Flame className="h-4 w-4 fill-[#F97316] text-[#F97316]" />
              {combo} d&apos;affilée
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hearts indicator */}
        <div className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#FFF1F2] px-2.5 py-1.5">
          <Heart className="h-5 w-5 fill-[#F43F5E] text-[#F43F5E]" />
          <span className="text-sm font-black text-[#E11D48]">{hearts}</span>
        </div>
      </div>

      {/* Zero-hearts friendly recovery strip (never locks out local learner) */}
      {hearts === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#FFE4E6] bg-[#FFF1F2] px-5 py-2.5 text-xs font-bold text-[#E11D48]">
          <span>Plus de cœurs ! Tu peux continuer en mode entraînement ou recharger gratuitement.</span>
          <button
            type="button"
            onClick={() => {
              playTapSound(soundEnabled);
              onRefillHearts();
            }}
            className="cursor-pointer rounded-lg bg-[#F43F5E] px-3 py-1 font-extrabold uppercase text-white hover:bg-[#E11D48]"
          >
            Recharger {MAX_HEARTS} cœurs
          </button>
        </div>
      )}

      {/* Exercise Stage */}
      <div className="mx-auto min-h-[380px] max-w-2xl px-5 py-7 sm:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${current.id}-${index}`}
            initial={{ opacity: 0, x: 28 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.22 }}
            className="space-y-6"
          >
            {/* Review banner */}
            {isReviewRound && (
              <div className="inline-flex items-center gap-2 rounded-xl bg-[#FFEDD5] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-[#C2410C]">
                <RotateCcw className="h-3.5 w-3.5" />
                Corrigeons cette erreur !
              </div>
            )}

            <h2 className="text-xl font-black tracking-tight text-[#1E293B] sm:text-2xl">
              {current.prompt}
            </h2>

            {/* 1. TRANSLATE CHOICE */}
            {current.kind === "translate_choice" && (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <VoltMascot mood={mascotMood} size={76} accessory={equippedAccessory} />
                  <div className="flex flex-1 flex-wrap items-center gap-3 rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC]/60 px-4 py-3.5">
                    <button
                      type="button"
                      onClick={() => speakEnglish(current.speakText)}
                      className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#6366F1] text-white shadow-[0_3px_0_#4338CA] active:translate-y-[2px] active:shadow-none"
                      aria-label={`Écouter ${current.speakText}`}
                    >
                      <Volume2 className="h-5 w-5" />
                    </button>
                    <div>
                      <p className="text-lg font-black text-[#1E293B]">{current.targetWord}</p>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                        {current.category}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {current.choices.map((choice, idx) => {
                    const selected = selectedChoice === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        disabled={feedback.status !== "idle"}
                        aria-pressed={selected}
                        onClick={() => {
                          playTapSound(soundEnabled);
                          setSelectedChoice(choice);
                          if (current.direction === "fr_to_en") {
                            speakEnglish(choice);
                          }
                        }}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all ${
                          selected
                            ? "border-[#6366F1] bg-[#E0E7FF]/70 text-[#4338CA] shadow-[0_4px_0_#6366F1]"
                            : "border-[#E2E8F0] bg-white text-[#1E293B] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-xs font-black ${
                            selected
                              ? "border-[#6366F1] bg-[#6366F1] text-white"
                              : "border-[#E2E8F0] text-[#94A3B8]"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-sm font-extrabold">{choice}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. LISTENING CHOICE (Normal + Slow Turtle Speed) */}
            {current.kind === "listening_choice" && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4 rounded-3xl border-2 border-[#E2E8F0] bg-[#F8FAFC]/50 p-6">
                  <div className="flex items-center gap-4">
                    <TactileButton
                      variant="info"
                      size="lg"
                      uppercase={false}
                      className="h-16 px-7"
                      onClick={() => speakEnglish(current.speakText)}
                    >
                      <Volume2 className="h-7 w-7" />
                      Écouter
                    </TactileButton>
                    <TactileButton
                      variant="outline"
                      size="lg"
                      uppercase={false}
                      className="h-16 px-5"
                      onClick={() => speakEnglish(current.speakText, { slow: true })}
                      title="Écouter au ralenti"
                    >
                      <Turtle className="h-6 w-6" />
                      Lent
                    </TactileButton>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowListeningHint((v) => !v)}
                    className="cursor-pointer text-xs font-extrabold text-[#64748B] underline-offset-2 hover:text-[#6366F1] hover:underline"
                  >
                    {showListeningHint
                      ? `Indice : « ${current.translationHint} »`
                      : "Pas de son ? Afficher l'indice en français"}
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {current.choices.map((choice, idx) => {
                    const selected = selectedChoice === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        disabled={feedback.status !== "idle"}
                        aria-pressed={selected}
                        onClick={() => {
                          playTapSound(soundEnabled);
                          setSelectedChoice(choice);
                        }}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all ${
                          selected
                            ? "border-[#6366F1] bg-[#E0E7FF]/70 text-[#4338CA] shadow-[0_4px_0_#6366F1]"
                            : "border-[#E2E8F0] bg-white text-[#1E293B] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-xs font-black ${
                            selected
                              ? "border-[#6366F1] bg-[#6366F1] text-white"
                              : "border-[#E2E8F0] text-[#94A3B8]"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-base font-extrabold">{choice}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. WORD BANK SENTENCE BUILDER */}
            {current.kind === "word_bank" && (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <VoltMascot mood={mascotMood} size={72} accessory={equippedAccessory} />
                  <div className="flex flex-1 items-center justify-between gap-3 rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC]/60 px-4 py-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-[#6366F1]">
                        Mot cible
                      </p>
                      <p className="text-sm font-extrabold text-[#1E293B]">{current.cueFrench}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakEnglish(current.speakText)}
                      className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#6366F1] text-white shadow-[0_3px_0_#4338CA] active:translate-y-[2px] active:shadow-none"
                      aria-label="Écouter la phrase modèle"
                      title="Écouter la phrase"
                    >
                      <Volume2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Answer Tray */}
                <div className="min-h-[84px] rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-3.5">
                  {selectedTokenIndices.length === 0 ? (
                    <p className="py-3 text-center text-xs font-bold text-[#94A3B8]">
                      Clique sur les mots ci-dessous dans le bon ordre…
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedTokenIndices.map((tokenIdx) => (
                        <motion.button
                          key={`tray-${tokenIdx}`}
                          layout
                          initial={{ scale: 0.85, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          type="button"
                          disabled={feedback.status !== "idle"}
                          onClick={() => {
                            playTapSound(soundEnabled);
                            setSelectedTokenIndices((prev) => prev.filter((i) => i !== tokenIdx));
                          }}
                          className="cursor-pointer rounded-xl border-2 border-[#6366F1] bg-[#E0E7FF] px-3.5 py-2 text-sm font-extrabold text-[#4338CA] shadow-[0_3px_0_#6366F1] active:translate-y-[2px] active:shadow-none"
                        >
                          {current.bankTokens[tokenIdx]}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Word Bank */}
                <div className="flex flex-wrap justify-center gap-2.5 pt-1">
                  {current.bankTokens.map((token, tokenIdx) => {
                    const used = selectedTokenIndices.includes(tokenIdx);
                    return (
                      <button
                        key={`bank-${tokenIdx}`}
                        type="button"
                        disabled={used || feedback.status !== "idle"}
                        onClick={() => {
                          playTapSound(soundEnabled);
                          setSelectedTokenIndices((prev) => [...prev, tokenIdx]);
                        }}
                        className={`rounded-xl border-2 px-3.5 py-2 text-sm font-extrabold transition-all ${
                          used
                            ? "cursor-default border-[#E2E8F0] bg-[#E2E8F0] text-transparent shadow-none"
                            : "cursor-pointer border-[#E2E8F0] bg-white text-[#1E293B] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC] active:translate-y-[2px] active:shadow-none"
                        }`}
                      >
                        {token}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4. FILL IN THE BLANK */}
            {current.kind === "fill_blank" && (
              <div className="space-y-6">
                <div className="rounded-3xl border-2 border-[#E2E8F0] bg-[#F8FAFC]/50 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-bold leading-relaxed text-[#1E293B]">
                      {current.sentenceBefore}
                      <span
                        className={`mx-1 inline-block min-w-[96px] rounded-xl border-b-4 px-3 py-0.5 text-center font-black ${
                          selectedChoice
                            ? "border-[#4338CA] bg-[#E0E7FF] text-[#4338CA]"
                            : "border-[#CBD5E1] bg-white text-[#94A3B8]"
                        }`}
                      >
                        {selectedChoice ?? "______"}
                      </span>
                      {current.sentenceAfter}
                    </p>
                    <button
                      type="button"
                      onClick={() => speakEnglish(current.speakText)}
                      className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#6366F1] text-white shadow-[0_3px_0_#4338CA]"
                      aria-label="Écouter la phrase complète"
                    >
                      <Volume2 className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="mt-3 text-xs font-extrabold text-[#64748B]">
                    Sens recherché : <span className="text-[#4338CA]">{current.translationHint}</span>
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {current.choices.map((choice, idx) => {
                    const selected = selectedChoice === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        disabled={feedback.status !== "idle"}
                        aria-pressed={selected}
                        onClick={() => {
                          playTapSound(soundEnabled);
                          setSelectedChoice(choice);
                        }}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all ${
                          selected
                            ? "border-[#6366F1] bg-[#E0E7FF]/70 text-[#4338CA] shadow-[0_4px_0_#6366F1]"
                            : "border-[#E2E8F0] bg-white text-[#1E293B] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-xs font-black ${
                            selected
                              ? "border-[#6366F1] bg-[#6366F1] text-white"
                              : "border-[#E2E8F0] text-[#94A3B8]"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-base font-extrabold">{choice}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. MATCH PAIRS */}
            {current.kind === "match_pairs" && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2.5">
                  <p className="text-center text-xs font-black uppercase tracking-wider text-[#94A3B8]">
                    Anglais
                  </p>
                  {current.pairs.map((pair) => {
                    const matched = matchedEnglish.has(pair.english);
                    const picked = pickedEnglish === pair.english;
                    const wrong = pairError?.en === pair.english;
                    return (
                      <motion.button
                        key={pair.id}
                        type="button"
                        disabled={matched}
                        animate={wrong ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                        transition={{ duration: 0.35 }}
                        onClick={() => {
                          playTapSound(soundEnabled);
                          speakEnglish(pair.english);
                          setPickedEnglish(pair.english);
                          tryMatchPair(current, pair.english, pickedFrench);
                        }}
                        className={`w-full rounded-2xl border-2 px-3.5 py-3.5 text-center text-sm font-extrabold transition-all ${
                          matched
                            ? "cursor-default border-[#D1FAE5] bg-[#D1FAE5]/40 text-[#047857]/60 shadow-none"
                            : wrong
                              ? "border-[#F43F5E] bg-[#FFE4E6] text-[#E11D48]"
                              : picked
                                ? "cursor-pointer border-[#6366F1] bg-[#E0E7FF] text-[#4338CA] shadow-[0_3px_0_#6366F1]"
                                : "cursor-pointer border-[#E2E8F0] bg-white text-[#1E293B] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        {pair.english}
                      </motion.button>
                    );
                  })}
                </div>

                <div className="space-y-2.5">
                  <p className="text-center text-xs font-black uppercase tracking-wider text-[#94A3B8]">
                    Français
                  </p>
                  {current.shuffledFrench.map((french) => {
                    const owner = current.pairs.find((p) => p.french === french);
                    const matched = owner ? matchedEnglish.has(owner.english) : false;
                    const picked = pickedFrench === french;
                    const wrong = pairError?.fr === french;
                    return (
                      <motion.button
                        key={french}
                        type="button"
                        disabled={matched}
                        animate={wrong ? { x: [0, -6, 6, -4, 4, 0] } : {}}
                        transition={{ duration: 0.35 }}
                        onClick={() => {
                          playTapSound(soundEnabled);
                          setPickedFrench(french);
                          tryMatchPair(current, pickedEnglish, french);
                        }}
                        className={`w-full rounded-2xl border-2 px-3.5 py-3.5 text-center text-sm font-extrabold transition-all ${
                          matched
                            ? "cursor-default border-[#D1FAE5] bg-[#D1FAE5]/40 text-[#047857]/60 shadow-none"
                            : wrong
                              ? "border-[#F43F5E] bg-[#FFE4E6] text-[#E11D48]"
                              : picked
                                ? "cursor-pointer border-[#6366F1] bg-[#E0E7FF] text-[#4338CA] shadow-[0_3px_0_#6366F1]"
                                : "cursor-pointer border-[#E2E8F0] bg-white text-[#1E293B] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        {french}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* 6. TYPE ANSWER (Active recall & audio dictation) */}
            {current.kind === "type_answer" && (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <VoltMascot mood={mascotMood} size={76} accessory={equippedAccessory} />
                  <div className="flex flex-1 flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC]/70 px-4 py-3.5">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-[#6366F1]">
                        Français · {current.category}
                      </p>
                      <p className="text-lg font-black text-[#1E293B]">{current.cueFrench}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => speakEnglish(current.speakText)}
                        className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-[#6366F1] text-white shadow-[0_3px_0_#4338CA] active:translate-y-[2px] active:shadow-none"
                        aria-label="Écouter le mot"
                        title="Écouter le mot"
                      >
                        <Volume2 className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => speakEnglish(current.speakText, { slow: true })}
                        className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl border-2 border-[#E2E8F0] bg-white text-[#475569] shadow-[0_3px_0_#E2E8F0] active:translate-y-[2px] active:shadow-none"
                        aria-label="Écouter au ralenti"
                        title="Écouter lentement"
                      >
                        <Turtle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="studio-type-answer" className="sr-only">
                    Ta réponse en anglais
                  </label>
                  <input
                    id="studio-type-answer"
                    type="text"
                    autoFocus
                    disabled={feedback.status !== "idle"}
                    value={typedAnswer}
                    onChange={(event) => setTypedAnswer(event.target.value)}
                    placeholder="Tape le terme anglais exact…"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-14 w-full rounded-2xl border-2 border-[#CBD5E1] bg-white px-4 text-lg font-extrabold text-[#1E293B] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#6366F1] focus:ring-2 focus:ring-[#E0E7FF] disabled:bg-[#F8FAFC]"
                  />
                  <div className="flex items-center justify-between text-xs font-bold text-[#64748B]">
                    <button
                      type="button"
                      onClick={() => setShowTypeHint((v) => !v)}
                      className="cursor-pointer font-extrabold text-[#6366F1] hover:underline"
                    >
                      {showTypeHint ? `Indice : ${current.firstLetterHint}` : "Besoin d'un indice ?"}
                    </button>
                    <span>Une petite faute de frappe est tolérée</span>
                  </div>
                </div>
              </div>
            )}

            {/* 7. SPOT ERROR (French-speaker trap drill) */}
            {current.kind === "spot_error" && (
              <div className="space-y-5">
                <div className="rounded-3xl border-2 border-[#FECDD3] bg-[#FFF1F2]/70 p-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-[#FFE4E6] px-2.5 py-0.5 text-[11px] font-black uppercase text-[#E11D48]">
                      Piège · {current.trapCategory}
                    </span>
                    <span className="text-xs font-extrabold text-[#9F1239]">{current.trapTitle}</span>
                  </div>
                  <p className="text-base font-black text-[#E11D48] line-through sm:text-lg">
                    “{current.wrongSentence}”
                  </p>
                  <p className="text-xs font-bold text-[#9F1239]">
                    Choisis la reformulation naturelle en anglais professionnel :
                  </p>
                </div>

                <div className="space-y-2.5">
                  {current.choices.map((choice, idx) => {
                    const selected = selectedChoice === choice;
                    return (
                      <button
                        key={choice}
                        type="button"
                        disabled={feedback.status !== "idle"}
                        aria-pressed={selected}
                        onClick={() => {
                          playTapSound(soundEnabled);
                          setSelectedChoice(choice);
                          speakEnglish(choice);
                        }}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition-all ${
                          selected
                            ? "border-[#6366F1] bg-[#E0E7FF]/70 text-[#4338CA] shadow-[0_4px_0_#6366F1]"
                            : "border-[#E2E8F0] bg-white text-[#1E293B] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC]"
                        }`}
                      >
                        <span
                          className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border-2 text-xs font-black ${
                            selected
                              ? "border-[#6366F1] bg-[#6366F1] text-white"
                              : "border-[#E2E8F0] text-[#94A3B8]"
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-sm font-extrabold sm:text-base">{choice}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Signature Bottom Action / Slide-Up Feedback Drawer */}
      <div
        role="status"
        aria-live="polite"
        className={`border-t-2 px-5 py-5 transition-colors sm:px-8 ${
          feedback.status === "correct"
            ? "border-[#A7F3D0] bg-[#D1FAE5]"
            : feedback.status === "incorrect"
              ? "border-[#FECDD3] bg-[#FFE4E6]"
              : "border-[#E2E8F0] bg-white"
        }`}
      >
        <div className="mx-auto flex max-w-2xl flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
          {feedback.status === "idle" && (
            <>
              <div className="hidden items-center gap-2 text-xs font-bold text-[#94A3B8] sm:flex">
                <Sparkles className="h-4 w-4 text-[#FBBF24]" />
                <span>
                  {current.kind === "word_bank"
                    ? "Astuce : Retour arrière retire le dernier mot, Entrée vérifie"
                    : "Astuce : utilise les touches 1–4 et Entrée"}
                </span>
              </div>
              <TactileButton
                variant="primary"
                size="lg"
                disabled={!canCheck}
                onClick={handleCheck}
                className="sm:ml-auto sm:min-w-[180px]"
              >
                Vérifier
              </TactileButton>
            </>
          )}

          {feedback.status === "correct" && (
            <>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#059669] shadow-xs">
                  <CheckCircle2 className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-lg font-black text-[#047857]">{feedback.message}</p>
                  {feedback.detail && (
                    <p className="text-xs font-bold text-[#065F46]">{feedback.detail}</p>
                  )}
                </div>
              </div>
              <TactileButton
                variant="primary"
                size="lg"
                onClick={handleContinue}
                className="sm:min-w-[180px]"
              >
                Continuer
              </TactileButton>
            </>
          )}

          {feedback.status === "incorrect" && (
            <>
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#F43F5E] shadow-xs">
                  <XCircle className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-base font-black text-[#E11D48]">Bonne réponse :</p>
                  <p className="text-sm font-extrabold text-[#9F1239]">{feedback.expected}</p>
                  {feedback.detail && (
                    <p className="mt-0.5 text-xs font-semibold text-[#881337]">{feedback.detail}</p>
                  )}
                </div>
              </div>
              <TactileButton
                variant="danger"
                size="lg"
                onClick={handleContinue}
                className="sm:min-w-[180px]"
              >
                Continuer
              </TactileButton>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
