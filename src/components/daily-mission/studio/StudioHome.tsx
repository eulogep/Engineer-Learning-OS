"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenText,
  Clock3,
  Compass,
  Flame,
  Gem,
  Heart,
  Mic,
  RotateCcw,
  SearchCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import type { MascotAccessoryId } from "@/modules/daily-english/studio-content";
import {
  TIME_BUDGETS,
  rankStudioIntents,
  type IntentContext,
  type StudioIntentId,
  type TimeBudget,
} from "@/modules/daily-english/studio-intents";
import { VoltMascot } from "./VoltMascot";
import { TactileButton } from "./StudioPrimitives";
import { playTapSound } from "./sound-effects";

const INTENT_ICONS: Record<StudioIntentId, typeof Compass> = {
  continue_path: Compass,
  speak: Mic,
  story: BookOpenText,
  blitz: Timer,
  grammar: SearchCheck,
  review: RotateCcw,
};

const BUDGET_LABELS: Record<TimeBudget, string> = {
  2: "2 min",
  5: "5 min",
  15: "15 min ou plus",
};

interface StudioHomeProps {
  context: Omit<IntentContext, "timeBudget">;
  timeBudget: TimeBudget;
  streak: number;
  todayXp: number;
  dailyGoalXp: number;
  gems: number;
  soundEnabled: boolean;
  equippedAccessory: MascotAccessoryId | null;
  onTimeBudgetChange: (budget: TimeBudget) => void;
  onChoose: (intent: StudioIntentId) => void;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

/**
 * Entry of the studio: the learner says how much time they have and picks
 * what they feel like doing; one choice is recommended from their real state.
 */
export function StudioHome({
  context,
  timeBudget,
  streak,
  todayXp,
  dailyGoalXp,
  gems,
  soundEnabled,
  equippedAccessory,
  onTimeBudgetChange,
  onChoose,
}: StudioHomeProps) {
  const ranked = useMemo(() => rankStudioIntents({ ...context, timeBudget }), [context, timeBudget]);
  const [recommended, ...others] = ranked;
  const RecommendedIcon = INTENT_ICONS[recommended.intent.id];
  const goalPct = Math.min(100, Math.round((todayXp / Math.max(1, dailyGoalXp)) * 100));

  const choose = (id: StudioIntentId) => {
    playTapSound(soundEnabled);
    onChoose(id);
  };

  const recommendedTitle =
    recommended.intent.id === "continue_path" && context.nextLessonTitle
      ? `Continuer : ${context.nextLessonTitle}`
      : recommended.intent.title;

  return (
    <section aria-labelledby="studio-home-title" className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <VoltMascot mood="happy" size={64} accessory={equippedAccessory} />
        <div className="min-w-0">
          <p className="text-sm text-[#64748B]">{greeting()} 👋</p>
          <h1 id="studio-home-title" className="text-2xl font-bold tracking-tight text-[#0F172A] sm:text-3xl">
            Qu&apos;est-ce que tu as envie de faire ?
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#475569]" aria-label="Ta journée">
        <span className="inline-flex items-center gap-1.5">
          <Flame className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
          {streak > 0 ? `${streak} jour${streak > 1 ? "s" : ""} de série` : "Série à lancer aujourd'hui"}
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="relative h-1.5 w-20 overflow-hidden rounded-full bg-[#E2E8F0]" aria-hidden="true">
            <span className="absolute inset-y-0 left-0 rounded-full bg-[#059669]" style={{ width: `${goalPct}%` }} />
          </span>
          {todayXp}/{dailyGoalXp} XP
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Gem className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
          {gems}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Heart className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
          {context.hearts}/5
        </span>
      </div>

      <fieldset className="space-y-2">
        <legend className="flex items-center gap-1.5 text-sm font-medium text-[#334155]">
          <Clock3 className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
          Combien de temps as-tu ?
        </legend>
        <div className="flex flex-wrap gap-2">
          {TIME_BUDGETS.map((budget) => {
            const active = budget === timeBudget;
            return (
              <button
                key={budget}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  playTapSound(soundEnabled);
                  onTimeBudgetChange(budget);
                }}
                className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2 ${
                  active
                    ? "border-[#059669] bg-[#ECFDF5] font-semibold text-[#047857]"
                    : "border-[#CBD5E1] bg-white text-[#475569] hover:border-[#94A3B8]"
                }`}
              >
                {BUDGET_LABELS[budget]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <motion.div
        key={recommended.intent.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[#A7F3D0] bg-white p-5 shadow-sm sm:p-6"
      >
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[#047857]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Recommandé pour toi
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#ECFDF5] text-[#047857]">
            <RecommendedIcon className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-[#0F172A]">{recommendedTitle}</h2>
            <p className="text-sm text-[#64748B]">
              {recommended.reason} · ~{recommended.intent.minutes} min
            </p>
          </div>
          <TactileButton size="md" onClick={() => choose(recommended.intent.id)}>
            C&apos;est parti
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </TactileButton>
        </div>
      </motion.div>

      <div>
        <h2 className="mb-3 text-sm font-medium text-[#334155]">Ou choisis toi-même</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {others.map(({ intent, fits }) => {
            const Icon = INTENT_ICONS[intent.id];
            return (
              <li key={intent.id}>
                <button
                  type="button"
                  onClick={() => choose(intent.id)}
                  className={`group flex h-full w-full cursor-pointer items-start gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 text-left transition-colors hover:border-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2 ${
                    fits ? "" : "opacity-60"
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F1F5F9] text-[#475569] group-hover:text-[#047857]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="font-semibold text-[#0F172A]">{intent.title}</span>
                      <span className="text-xs text-[#94A3B8]">~{intent.minutes} min</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-[#64748B]">{intent.description}</span>
                    {!fits && <span className="mt-1 block text-xs text-[#94A3B8]">Un peu long pour ton temps</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
