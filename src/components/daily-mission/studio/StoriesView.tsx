"use client";

import { useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Gem,
  Sparkles,
  Volume2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  ENGINEERING_STORIES,
  type EngineeringStory,
  type MascotAccessoryId,
} from "@/modules/daily-english/studio-content";
import { ConfettiBurst, GlossyProgressBar, TactileButton } from "./StudioPrimitives";
import { VoltMascot } from "./VoltMascot";
import {
  playCorrectSound,
  playIncorrectSound,
  playTapSound,
  playVictoryFanfare,
  speakEnglish,
} from "./sound-effects";

interface StoriesViewProps {
  completedStoryIds: readonly string[];
  soundEnabled: boolean;
  equippedAccessory: MascotAccessoryId | null;
  onStoryComplete: (input: {
    storyId: string;
    xpReward: number;
  }) => { xpEarned: number; gemsEarned: number; boosted: boolean };
}

const THEME_ACCENT: Record<EngineeringStory["theme"], { bg: string; badge: string; border: string }> = {
  emerald: { bg: "bg-[#059669]", badge: "bg-[#D1FAE5] text-[#047857]", border: "border-[#A7F3D0]" },
  indigo: { bg: "bg-[#6366F1]", badge: "bg-[#E0E7FF] text-[#4338CA]", border: "border-[#C7D2FE]" },
  violet: { bg: "bg-[#A855F7]", badge: "bg-[#F3E8FF] text-[#7E22CE]", border: "border-[#E9D5FF]" },
  orange: { bg: "bg-[#F97316]", badge: "bg-[#FFEDD5] text-[#C2410C]", border: "border-[#FED7AA]" },
  cyan: { bg: "bg-[#06B6D4]", badge: "bg-[#CFFAFE] text-[#0E7490]", border: "border-[#A5F3FC]" },
};

export function StoriesView({
  completedStoryIds,
  soundEnabled,
  equippedAccessory,
  onStoryComplete,
}: StoriesViewProps) {
  const [activeStory, setActiveStory] = useState<EngineeringStory | null>(null);
  const [visibleCount, setVisibleCount] = useState(1);
  const [showTranslations, setShowTranslations] = useState(false);
  const [answeredCheckpoints, setAnsweredCheckpoints] = useState<
    Record<string, { choice: string; correct: boolean }>
  >({});
  const [reward, setReward] = useState<{
    xpEarned: number;
    gemsEarned: number;
    boosted: boolean;
  } | null>(null);

  const openStory = useCallback(
    (story: EngineeringStory) => {
      playTapSound(soundEnabled);
      setActiveStory(story);
      setVisibleCount(1);
      setShowTranslations(false);
      setAnsweredCheckpoints({});
      setReward(null);
      const first = story.steps[0];
      if (first && first.kind === "line" && soundEnabled) {
        speakEnglish(first.text);
      }
    },
    [soundEnabled],
  );

  const closeStory = useCallback(() => {
    setActiveStory(null);
    setReward(null);
  }, []);

  if (activeStory && reward) {
    return (
      <div className="elos-studio relative overflow-hidden rounded-3xl border-2 border-[#E2E8F0] bg-white px-6 py-10 text-center shadow-sm sm:px-10">
        <ConfettiBurst />
        <motion.div
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative mx-auto max-w-md space-y-6"
        >
          <VoltMascot mood="celebrating" size={128} accessory={equippedAccessory} />
          <div className="space-y-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#047857]">
              Histoire terminée !
            </p>
            <h2 className="text-2xl font-black text-[#1E293B]">{activeStory.title}</h2>
            <p className="text-sm font-semibold text-[#64748B]">
              Tu maîtrises le vocabulaire clé de ce dialogue pro.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-2 border-[#FBBF24] bg-[#FFEDD5]/60 p-3.5">
              <p className="text-[11px] font-black uppercase text-[#C2410C]">XP gagnés</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xl font-black text-[#C2410C]">
                <Zap className="h-5 w-5 fill-[#FBBF24] text-[#D97706]" />+{reward.xpEarned}
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#6366F1] bg-[#E0E7FF]/60 p-3.5">
              <p className="text-[11px] font-black uppercase text-[#4338CA]">Gemmes</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xl font-black text-[#4338CA]">
                <Gem className="h-5 w-5 fill-[#6366F1]" />+{reward.gemsEarned}
              </p>
            </div>
          </div>

          {reward.boosted && (
            <p className="inline-block rounded-xl bg-[#EEF2FF] px-3 py-1 text-xs font-black text-[#4338CA]">
              ⚡ Boost XP ×2 appliqué !
            </p>
          )}

          <div className="rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC] p-4 text-left">
            <p className="mb-2 text-xs font-black uppercase tracking-wider text-[#64748B]">
              Expressions clés à retenir
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {activeStory.keyWords.map((kw) => (
                <button
                  key={kw.word}
                  type="button"
                  onClick={() => speakEnglish(kw.word)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-left hover:bg-[#EEF2FF]"
                >
                  <div>
                    <p className="text-xs font-black text-[#1E293B]">{kw.word}</p>
                    <p className="text-[11px] font-semibold text-[#64748B]">{kw.translation}</p>
                  </div>
                  <Volume2 className="h-3.5 w-3.5 shrink-0 text-[#6366F1]" />
                </button>
              ))}
            </div>
          </div>

          <TactileButton variant="primary" size="lg" className="w-full" onClick={closeStory}>
            Retour aux histoires
          </TactileButton>
        </motion.div>
      </div>
    );
  }

  if (activeStory) {
    const visibleSteps = activeStory.steps.slice(0, visibleCount);
    const lastStep = visibleSteps[visibleSteps.length - 1];
    const waitingForCheckpoint =
      lastStep?.kind === "checkpoint" && !answeredCheckpoints[lastStep.id]?.correct;
    const isAtEnd = visibleCount >= activeStory.steps.length && !waitingForCheckpoint;
    const progressPct = Math.round((visibleCount / activeStory.steps.length) * 100);

    const handleAdvance = () => {
      playTapSound(soundEnabled);
      if (isAtEnd) {
        playVictoryFanfare(soundEnabled);
        setReward(onStoryComplete({ storyId: activeStory.id, xpReward: activeStory.xpReward }));
        return;
      }
      const nextCount = visibleCount + 1;
      setVisibleCount(nextCount);
      const nextStep = activeStory.steps[nextCount - 1];
      if (nextStep && nextStep.kind === "line" && soundEnabled) {
        speakEnglish(nextStep.text);
      }
    };

    return (
      <div className="elos-studio overflow-hidden rounded-3xl border-2 border-[#E2E8F0] bg-white shadow-sm">
        {/* Story top HUD */}
        <div className="flex items-center gap-3 border-b-2 border-[#E2E8F0] px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={closeStory}
            className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#1E293B]"
            aria-label="Quitter l'histoire"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="flex-1 space-y-1">
            <GlossyProgressBar value={progressPct} />
            <div className="flex items-center justify-between text-[11px] font-extrabold text-[#94A3B8]">
              <span>{activeStory.title}</span>
              <span>
                {visibleCount}/{activeStory.steps.length}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowTranslations((v) => !v)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-[#E2E8F0] bg-white px-3 text-xs font-extrabold text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1E293B]"
          >
            {showTranslations ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{showTranslations ? "Masquer FR" : "Aide FR"}</span>
          </button>
        </div>

        {/* Dialogue Stream */}
        <div className="mx-auto max-w-2xl space-y-4 px-5 py-6 sm:px-8">
          <div className="rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-xs font-black uppercase tracking-wider text-[#6366F1]">
              Mise en situation · {activeStory.level}
            </p>
            <p className="mt-0.5 text-sm font-bold text-[#334155]">{activeStory.subtitle}</p>
          </div>

          <AnimatePresence initial={false}>
            {visibleSteps.map((step) => {
              if (step.kind === "line") {
                return (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-3"
                  >
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-sm font-black text-white shadow-xs"
                      style={{ backgroundColor: step.avatarColor }}
                    >
                      {step.speaker.slice(0, 1)}
                    </span>
                    <div className="flex-1 rounded-2xl border-2 border-[#E2E8F0] bg-white p-4 shadow-xs">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-[#1E293B]">
                          {step.speaker}{" "}
                          <span className="font-semibold text-[#94A3B8]">· {step.role}</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => speakEnglish(step.text)}
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4338CA] hover:bg-[#E0E7FF]"
                          aria-label={`Écouter la réplique de ${step.speaker}`}
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-1.5 text-sm font-bold leading-relaxed text-[#1E293B]">
                        {step.text}
                      </p>
                      {showTranslations && (
                        <p className="mt-2 border-t border-[#F1F5F9] pt-2 text-xs italic text-[#64748B]">
                          {step.frenchHint}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              }

              const answered = answeredCheckpoints[step.id];
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-3xl border-2 border-[#C7D2FE] bg-[#EEF2FF]/60 p-5 space-y-3"
                >
                  <p className="text-xs font-black uppercase tracking-wider text-[#4338CA]">
                    Point de compréhension
                  </p>
                  <p className="text-base font-black text-[#1E293B]">{step.prompt}</p>
                  <div className="space-y-2">
                    {step.choices.map((choice) => {
                      const isPicked = answered?.choice === choice;
                      const isRight = answered?.correct && choice === step.correctAnswer;
                      const isWrong = isPicked && !answered.correct;
                      return (
                        <button
                          key={choice}
                          type="button"
                          disabled={Boolean(answered?.correct)}
                          onClick={() => {
                            const correct = choice === step.correctAnswer;
                            if (correct) {
                              playCorrectSound(soundEnabled);
                            } else {
                              playIncorrectSound(soundEnabled);
                            }
                            setAnsweredCheckpoints((prev) => ({
                              ...prev,
                              [step.id]: { choice, correct },
                            }));
                          }}
                          className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3 text-left text-sm font-extrabold transition-all ${
                            isRight
                              ? "border-[#059669] bg-[#D1FAE5] text-[#047857]"
                              : isWrong
                                ? "border-[#F43F5E] bg-[#FFE4E6] text-[#E11D48]"
                                : "border-[#E2E8F0] bg-white text-[#1E293B] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC]"
                          }`}
                        >
                          <span>{choice}</span>
                          {isRight && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#059669]" />}
                          {isWrong && <XCircle className="h-5 w-5 shrink-0 text-[#F43F5E]" />}
                        </button>
                      );
                    })}
                  </div>
                  {answered && (
                    <p
                      className={`text-xs font-bold ${
                        answered.correct ? "text-[#047857]" : "text-[#E11D48]"
                      }`}
                    >
                      {answered.correct
                        ? `✓ ${step.explanation}`
                        : "Pas tout à fait — réessaie avec une autre réponse !"}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Sticky continue bar */}
        <div className="border-t-2 border-[#E2E8F0] bg-white px-5 py-4 sm:px-8">
          <div className="mx-auto flex max-w-2xl items-center justify-end">
            <TactileButton
              variant="primary"
              size="lg"
              disabled={waitingForCheckpoint}
              onClick={handleAdvance}
              className="w-full sm:w-auto sm:min-w-[200px]"
            >
              {isAtEnd ? "Terminer l'histoire" : "Continuer"}
              <ArrowRight className="h-5 w-5" />
            </TactileButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="elos-studio space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <VoltMascot mood="happy" size={76} accessory={equippedAccessory} />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#6366F1]">
              Immersion & Compréhension
            </p>
            <h2 className="text-xl font-black text-[#1E293B] sm:text-2xl">
              Histoires d&apos;Ingénieur ({completedStoryIds.length}/{ENGINEERING_STORIES.length})
            </h2>
            <p className="text-sm font-medium text-[#64748B]">
              Dialogues professionnels courts avec audio intégré et questions de compréhension en direct.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ENGINEERING_STORIES.map((story) => {
          const done = completedStoryIds.includes(story.id);
          const style = THEME_ACCENT[story.theme];
          return (
            <div
              key={story.id}
              className="flex flex-col justify-between rounded-3xl border-2 border-[#E2E8F0] bg-white p-5 shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className={`rounded-xl px-2.5 py-1 text-[11px] font-black uppercase ${style.badge}`}>
                    {story.level}
                  </span>
                  {done ? (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-[#D1FAE5] px-2.5 py-1 text-[11px] font-black text-[#047857]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Validée
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#94A3B8]">
                      <Clock className="h-3.5 w-3.5" />
                      {story.durationMinutes} min
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-black text-[#1E293B]">{story.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">{story.subtitle}</p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {story.keyWords.map((kw) => (
                    <span
                      key={kw.word}
                      className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-bold text-[#334155]"
                    >
                      {kw.word}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <TactileButton
                  variant={done ? "outline" : "primary"}
                  size="sm"
                  className="w-full"
                  onClick={() => openStory(story)}
                >
                  <BookOpenText className="h-4 w-4" />
                  {done ? `Relire (+${story.xpReward} XP)` : `Lire (+${story.xpReward} XP)`}
                </TactileButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
