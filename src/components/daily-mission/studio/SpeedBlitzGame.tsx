"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Gem, Play, RotateCcw, Timer, Trophy, Volume2, X, Zap } from "lucide-react";
import {
  ALL_STUDIO_VOCABULARY,
  type MascotAccessoryId,
  type StudioVocabularyWord,
} from "@/modules/daily-english/studio-content";
import { ConfettiBurst, TactileButton } from "./StudioPrimitives";
import { VoltMascot } from "./VoltMascot";
import {
  playComboSound,
  playCorrectSound,
  playIncorrectSound,
  playTapSound,
  playVictoryFanfare,
  speakEnglish,
} from "./sound-effects";

interface SpeedBlitzGameProps {
  bestScore: number;
  soundEnabled: boolean;
  equippedAccessory: MascotAccessoryId | null;
  onFinish: (score: number) => { xpEarned: number; gemsEarned: number; isNewBest: boolean };
  onExit: () => void;
}

const BLITZ_DURATION_SECONDS = 60;

interface BlitzQuestion {
  word: StudioVocabularyWord;
  direction: "en_to_fr" | "fr_to_en";
  prompt: string;
  correct: string;
  choices: string[];
}

function buildRandomQuestion(pool: readonly StudioVocabularyWord[]): BlitzQuestion {
  const target = pool[Math.floor(Math.random() * pool.length)];
  const direction: "en_to_fr" | "fr_to_en" = Math.random() > 0.45 ? "en_to_fr" : "fr_to_en";
  const distractors: StudioVocabularyWord[] = [];
  const used = new Set<string>([target.word.toLowerCase(), target.translation.toLowerCase()]);
  while (distractors.length < 3) {
    const candidate = pool[Math.floor(Math.random() * pool.length)];
    if (used.has(candidate.word.toLowerCase()) || used.has(candidate.translation.toLowerCase())) {
      continue;
    }
    used.add(candidate.word.toLowerCase());
    used.add(candidate.translation.toLowerCase());
    distractors.push(candidate);
  }
  const correct = direction === "en_to_fr" ? target.translation : target.word;
  const choices = [
    correct,
    ...distractors.map((d) => (direction === "en_to_fr" ? d.translation : d.word)),
  ].sort(() => Math.random() - 0.5);

  return {
    word: target,
    direction,
    prompt: direction === "en_to_fr" ? target.word : target.translation,
    correct,
    choices,
  };
}

export function SpeedBlitzGame({
  bestScore,
  soundEnabled,
  equippedAccessory,
  onFinish,
  onExit,
}: SpeedBlitzGameProps) {
  const pool = useMemo(() => ALL_STUDIO_VOCABULARY, []);
  const [phase, setPhase] = useState<"ready" | "playing" | "done">("ready");
  const [timeLeft, setTimeLeft] = useState(BLITZ_DURATION_SECONDS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [flash, setFlash] = useState<"none" | "good" | "bad">("none");
  const [question, setQuestion] = useState<BlitzQuestion>(() => buildRandomQuestion(pool));
  const [result, setResult] = useState<{
    xpEarned: number;
    gemsEarned: number;
    isNewBest: boolean;
  } | null>(null);
  const scoreRef = useRef(0);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const startRun = useCallback(() => {
    playTapSound(soundEnabled);
    scoreRef.current = 0;
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setTimeLeft(BLITZ_DURATION_SECONDS);
    setResult(null);
    setQuestion(buildRandomQuestion(pool));
    setPhase("playing");
  }, [pool, soundEnabled]);

  // Countdown tick — finishes cleanly inside the timer callback when reaching 0.
  useEffect(() => {
    if (phase !== "playing") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          playVictoryFanfare(soundEnabled);
          setResult(onFinishRef.current(scoreRef.current));
          setPhase("done");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase, soundEnabled]);

  const answerChoice = useCallback(
    (choice: string) => {
      if (phase !== "playing") return;
      if (choice === question.correct) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        setBestCombo((b) => Math.max(b, nextCombo));
        scoreRef.current += 1;
        setScore(scoreRef.current);
        setFlash("good");
        if (nextCombo >= 4) playComboSound(soundEnabled);
        else playCorrectSound(soundEnabled);
      } else {
        setCombo(0);
        setFlash("bad");
        playIncorrectSound(soundEnabled);
      }
      setTimeout(() => setFlash("none"), 220);
      setQuestion(buildRandomQuestion(pool));
    },
    [combo, phase, pool, question.correct, soundEnabled],
  );

  // Keyboard 1–4 shortcuts during blitz
  useEffect(() => {
    if (phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < question.choices.length) {
        answerChoice(question.choices[idx]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answerChoice, phase, question.choices]);

  if (phase === "ready") {
    return (
      <div className="elos-studio rounded-3xl border border-[#E2E8F0] bg-white px-6 py-10 text-center shadow-sm sm:px-10">
        <div className="mx-auto max-w-md space-y-6">
          <VoltMascot mood="hero" size={120} accessory={equippedAccessory} />
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#FFEDD5] px-3 py-1 text-xs font-bold uppercase text-[#C2410C]">
              <Timer className="h-4 w-4" /> Défi Chrono 60 secondes
            </span>
            <h2 className="text-2xl font-bold text-[#1E293B]">Match Éclair · 240 termes</h2>
            <p className="text-sm font-medium text-[#64748B]">
              Enchaîne un maximum de traductions en 60 secondes. Touches clavier 1 à 4 actives pour aller encore plus vite !
            </p>
          </div>
          {bestScore > 0 && (
            <p className="inline-flex items-center gap-1.5 rounded-xl bg-[#EEF2FF] px-3.5 py-1.5 text-xs font-bold text-[#4338CA]">
              <Trophy className="h-4 w-4 text-[#FBBF24]" /> Record personnel : {bestScore} réponses
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <TactileButton variant="outline" size="lg" className="sm:w-36" onClick={onExit}>
              Retour
            </TactileButton>
            <TactileButton variant="warning" size="lg" className="flex-1" onClick={startRun}>
              <Play className="h-5 w-5 fill-current" />
              Lancer le chrono !
            </TactileButton>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "done" && result) {
    return (
      <div className="elos-studio relative overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white px-6 py-10 text-center shadow-sm sm:px-10">
        <ConfettiBurst />
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mx-auto max-w-md space-y-6"
        >
          <VoltMascot mood="celebrating" size={124} accessory={equippedAccessory} />
          <div className="space-y-1">
            {result.isNewBest && (
              <span className="inline-block rounded-xl bg-[#FFEDD5] px-3 py-1 text-xs font-bold uppercase text-[#C2410C]">
                🏆 Nouveau record personnel !
              </span>
            )}
            <h2 className="text-3xl font-bold text-[#1E293B]">{score} bonnes réponses</h2>
            <p className="text-sm font-semibold text-[#64748B]">Meilleur combo : {bestCombo} d&apos;affilée</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-[#FBBF24] bg-[#FFEDD5]/60 p-3.5">
              <p className="text-[11px] font-bold uppercase text-[#C2410C]">XP gagnés</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xl font-bold text-[#C2410C]">
                <Zap className="h-5 w-5 fill-[#FBBF24] text-[#D97706]" />+{result.xpEarned}
              </p>
            </div>
            <div className="rounded-2xl border border-[#6366F1] bg-[#E0E7FF]/60 p-3.5">
              <p className="text-[11px] font-bold uppercase text-[#4338CA]">Gemmes</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xl font-bold text-[#4338CA]">
                <Gem className="h-5 w-5 fill-[#6366F1]" />+{result.gemsEarned}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <TactileButton variant="outline" size="lg" className="sm:flex-1" onClick={onExit}>
              Retour
            </TactileButton>
            <TactileButton variant="warning" size="lg" className="sm:flex-1" onClick={startRun}>
              <RotateCcw className="h-4 w-4" />
              Rejouer
            </TactileButton>
          </div>
        </motion.div>
      </div>
    );
  }

  const timePct = Math.round((timeLeft / BLITZ_DURATION_SECONDS) * 100);
  const urgent = timeLeft <= 10;

  return (
    <div
      className={`elos-studio overflow-hidden rounded-3xl border bg-white shadow-sm transition-colors ${
        flash === "good"
          ? "border-[#059669]"
          : flash === "bad"
            ? "border-[#F43F5E]"
            : "border-[#E2E8F0]"
      }`}
    >
      {/* Top HUD */}
      <div className="flex items-center gap-3 border-b border-[#E2E8F0] px-5 py-4">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#1E293B]"
          aria-label="Quitter le chrono"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex-1">
          <div className="h-4 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                urgent ? "bg-[#F43F5E]" : "bg-[#F97316]"
              }`}
              style={{ width: `${timePct}%` }}
            />
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-bold tabular-nums ${
            urgent ? "bg-[#FFE4E6] text-[#E11D48]" : "bg-[#FFEDD5] text-[#C2410C]"
          }`}
        >
          <Timer className="h-4 w-4" />
          {timeLeft}s
        </span>

        <span className="inline-flex items-center gap-1 rounded-xl bg-[#D1FAE5] px-3 py-1.5 text-sm font-bold text-[#047857]">
          ✓ {score}
        </span>

        {combo >= 2 && (
          <span className="hidden items-center gap-1 rounded-xl bg-[#EEF2FF] px-2.5 py-1.5 text-xs font-bold text-[#4338CA] sm:inline-flex">
            <Flame className="h-4 w-4 fill-[#F97316] text-[#F97316]" />×{combo}
          </span>
        )}
      </div>

      {/* Prompt + 4 fast cards */}
      <div className="mx-auto max-w-2xl space-y-6 px-5 py-8 sm:px-8">
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
            {question.direction === "en_to_fr" ? "Anglais → Français" : "Français → Anglais"} ·{" "}
            {question.word.packLabel}
          </p>
          <div className="flex items-center gap-3">
            <h3 className="text-2xl font-bold text-[#1E293B] sm:text-3xl">{question.prompt}</h3>
            {question.direction === "en_to_fr" && (
              <button
                type="button"
                onClick={() => speakEnglish(question.word.word)}
                className="grid h-10 w-10 cursor-pointer place-items-center rounded-xl bg-[#6366F1] text-white"
                aria-label={`Écouter ${question.word.word}`}
              >
                <Volume2 className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {question.choices.map((choice, idx) => (
            <button
              key={choice}
              type="button"
              onClick={() => answerChoice(choice)}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white px-4 py-4 text-left text-sm font-semibold text-[#1E293B] transition-all hover:border-[#6366F1] hover:bg-[#EEF2FF]/50 active:translate-y-[3px] active:shadow-none"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-[#E2E8F0] text-xs font-bold text-[#94A3B8]">
                {idx + 1}
              </span>
              <span>{choice}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
