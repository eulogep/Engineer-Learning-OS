"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Flame, Gem, Target } from "lucide-react";
import type { RewardEvent } from "@/modules/daily-english/reward-events";
import { ConfettiBurst } from "./StudioPrimitives";
import { playComboSound } from "./sound-effects";

const DISPLAY_MS = 2600;

function content(event: RewardEvent) {
  switch (event.kind) {
    case "quest":
      return {
        icon: <Gem className="h-6 w-6" aria-hidden="true" />,
        title: "Quête terminée !",
        detail: `${event.title} · +${event.gems} gemmes`,
        gradient: "from-[#6366F1] via-[#A855F7] to-[#EC4899]",
      };
    case "daily_goal":
      return {
        icon: <Target className="h-6 w-6" aria-hidden="true" />,
        title: "Objectif du jour atteint !",
        detail: `${event.goalXp} XP gagnés aujourd'hui`,
        gradient: "from-[#059669] via-[#10B981] to-[#FBBF24]",
      };
    case "streak":
      return {
        icon: <Flame className="h-6 w-6" aria-hidden="true" />,
        title: event.days > 1 ? `${event.days} jours d'affilée !` : "Série lancée !",
        detail: event.days > 1 ? "Ta série continue, reviens demain." : "Premier jour de ta série.",
        gradient: "from-[#F59E0B] via-[#F97316] to-[#EF4444]",
      };
  }
}

interface RewardMomentsProps {
  /** Pending events; the first one is shown, then dismissed. */
  queue: readonly RewardEvent[];
  soundEnabled: boolean;
  onDismiss: () => void;
}

/**
 * The only loud moment of the studio: a short burst of colour and confetti
 * when the learner earns something, then back to calm.
 */
export function RewardMoments({ queue, soundEnabled, onDismiss }: RewardMomentsProps) {
  const current = queue[0] ?? null;

  useEffect(() => {
    if (!current) return;
    playComboSound(soundEnabled);
    const timer = window.setTimeout(onDismiss, DISPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [current, onDismiss, soundEnabled]);

  const view = current ? content(current) : null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-50 flex justify-center px-4" aria-live="polite">
      <AnimatePresence mode="wait">
        {current && view && (
          <motion.button
            key={`${current.kind}-${"questId" in current ? current.questId : ""}-${queue.length}`}
            type="button"
            onClick={onDismiss}
            initial={{ y: -40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -30, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
            className={`pointer-events-auto relative flex w-full max-w-sm cursor-pointer items-center gap-3 overflow-visible rounded-2xl bg-gradient-to-r ${view.gradient} px-5 py-4 text-left text-white shadow-2xl`}
            aria-label={`${view.title} ${view.detail}. Fermer`}
          >
            <ConfettiBurst />
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/20">{view.icon}</span>
            <span>
              <span className="block text-base font-bold">{view.title}</span>
              <span className="block text-sm text-white/90">{view.detail}</span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
