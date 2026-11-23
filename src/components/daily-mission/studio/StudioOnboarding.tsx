"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Cpu,
  Flame,
  Network,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type { DailyGoalXp, FocusTrack } from "@/modules/daily-english/gamification";
import { VoltMascot } from "./VoltMascot";
import { TactileButton } from "./StudioPrimitives";
import { playTapSound } from "./sound-effects";

interface StudioOnboardingProps {
  initialFocusTrack: FocusTrack;
  initialDailyGoal: DailyGoalXp;
  soundEnabled: boolean;
  onComplete: (prefs: { focusTrack: FocusTrack; dailyGoalXp: DailyGoalXp }) => void;
  onSkipToPath: () => void;
  onOpenGuidedMission: () => void;
}

const TRACKS: ReadonlyArray<{
  id: FocusTrack;
  label: string;
  tag: string;
  description: string;
  accent: string;
  icon: typeof Sparkles;
}> = [
  {
    id: "all",
    label: "Parcours Complet",
    tag: "Recommandé · B1–B2",
    description: "Mix équilibré : essentiels, réseau, cybersécurité, réunions et carrière",
    accent: "text-[#047857] bg-[#D1FAE5]",
    icon: Sparkles,
  },
  {
    id: "networking",
    label: "Réseau & Infra",
    tag: "B2 · 30 termes",
    description: "Routage, latence, sous-réseaux, dépannage et topologie",
    accent: "text-[#4338CA] bg-[#E0E7FF]",
    icon: Network,
  },
  {
    id: "cybersecurity",
    label: "Cybersécurité",
    tag: "B2 · 30 termes",
    description: "Vulnérabilités, durcissement, incidents et réponse",
    accent: "text-[#6B21A8] bg-[#F3E8FF]",
    icon: ShieldCheck,
  },
  {
    id: "meetings",
    label: "Réunions & Équipe",
    tag: "B1 · 30 termes",
    description: "Stand-ups, échéances, clarifications et feedbacks pro",
    accent: "text-[#C2410C] bg-[#FFEDD5]",
    icon: Users,
  },
  {
    id: "career",
    label: "Alternance & Carrière",
    tag: "B1 · 30 termes",
    description: "Entretiens, CV, points forts et intégration en entreprise",
    accent: "text-[#155E75] bg-[#CFFAFE]",
    icon: Briefcase,
  },
  {
    id: "core",
    label: "Essentiels Ingénieur",
    tag: "B2 · 30 termes",
    description: "Verbes d'action et nuances pour parler avec aisance",
    accent: "text-[#047857] bg-[#D1FAE5]",
    icon: Cpu,
  },
];

const GOALS: ReadonlyArray<{
  xp: DailyGoalXp;
  label: string;
  minutes: string;
  badge: string;
}> = [
  { xp: 20, label: "Tranquille", minutes: "5 min / jour", badge: "20 XP" },
  { xp: 50, label: "Régulier", minutes: "10 min / jour", badge: "50 XP · Recommandé" },
  { xp: 100, label: "Intensif", minutes: "20 min / jour", badge: "100 XP" },
];

/**
 * Hero & 2-step onboarding for the Daily English studio.
 * Adapted 100% for Daily English Mission / Engineer Learning OS.
 */
export function StudioOnboarding({
  initialFocusTrack,
  initialDailyGoal,
  soundEnabled,
  onComplete,
  onSkipToPath,
  onOpenGuidedMission,
}: StudioOnboardingProps) {
  const [phase, setPhase] = useState<"hero" | "track" | "goal">("hero");
  const [focusTrack, setFocusTrack] = useState<FocusTrack>(initialFocusTrack);
  const [dailyGoalXp, setDailyGoalXp] = useState<DailyGoalXp>(initialDailyGoal);

  return (
    <div className="elos-studio overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-sm">
      {/* Top header bar */}
      <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#059669] text-white">
            <Zap className="h-5 w-5 fill-white" />
          </span>
          <span className="text-lg font-bold tracking-tight text-[#059669]">
            daily english
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            playTapSound(soundEnabled);
            onOpenGuidedMission();
          }}
          className="text-xs font-semibold uppercase tracking-wider text-[#64748B] transition-colors hover:text-[#6366F1]"
        >
          Mode Mission 6 étapes →
        </button>
      </div>

      <div className="px-5 py-8 sm:px-10 sm:py-12">
        <AnimatePresence mode="wait">
          {phase === "hero" && (
            <motion.div
              key="hero"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="space-y-10"
            >
              {/* Split Hero */}
              <div className="grid items-center gap-8 lg:grid-cols-2">
                {/* Left: Orbiting visual illustration with original mascot */}
                <div className="relative mx-auto flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72">
                  <div className="absolute inset-4 rounded-full bg-gradient-to-br from-[#D1FAE5]/80 via-[#E0E7FF]/60 to-[#FFEDD5]/70 blur-xl" />
                  <motion.span
                    className="absolute left-1 top-6 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#4338CA]"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    🌐 Réseau B2
                  </motion.span>
                  <motion.span
                    className="absolute right-0 top-12 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#6B21A8]"
                    animate={{ y: [0, 6, 0] }}
                    transition={{ duration: 3.3, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                  >
                    🛡️ Cyber B2
                  </motion.span>
                  <motion.span
                    className="absolute bottom-6 left-2 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#C2410C]"
                    animate={{ y: [0, 5, 0] }}
                    transition={{ duration: 2.7, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                  >
                    🔥 Série & XP
                  </motion.span>
                  <motion.span
                    className="absolute bottom-4 right-2 rounded-2xl border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#047857]"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 3.1, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
                  >
                    🎙️ Oral & Écoute
                  </motion.span>
                  <VoltMascot mood="hero" size={148} />
                </div>

                {/* Right: Bold headline + stacked 3D CTAs */}
                <div className="mx-auto max-w-md space-y-6 text-center lg:text-left">
                  <h1 className="text-2xl font-bold leading-tight tracking-tight text-[#1E293B] sm:text-3xl">
                    La méthode la plus fun pour maîtriser l’anglais ingénieur au quotidien !
                  </h1>
                  <p className="text-sm leading-6 text-[#64748B]">
                    Des micro-leçons interactives de 3 à 5 minutes — banque de mots, écoute normale et lente,
                    paires rapides et pratique orale — 100 % locales et synchronisées avec ta répétition espacée.
                  </p>
                  <div className="flex flex-col gap-3">
                    <TactileButton
                      variant="primary"
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        playTapSound(soundEnabled);
                        setPhase("track");
                      }}
                    >
                      C&apos;est parti !
                      <ArrowRight className="h-5 w-5" />
                    </TactileButton>
                    <TactileButton
                      variant="outline"
                      size="lg"
                      className="w-full"
                      onClick={() => {
                        playTapSound(soundEnabled);
                        onSkipToPath();
                      }}
                    >
                      Accéder directement au parcours
                    </TactileButton>
                  </div>
                </div>
              </div>

              {/* 3 value pillars strip */}
              <div className="grid gap-4 border-t-2 border-[#E2E8F0] pt-8 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4">
                  <p className="text-sm font-bold text-[#059669]">ludique. rapide. concret.</p>
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Banque de mots, écoute audio locale, paires chrono et textes à trous issus de 150 termes clés.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4">
                  <p className="text-sm font-bold text-[#6366F1]">méthode scientifique</p>
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Répétition espacée Leitner (1, 3, 7, 14, 30, 60 jours) + révision immédiate de tes erreurs.
                  </p>
                </div>
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC]/70 p-4">
                  <p className="text-sm font-bold text-[#F97316]">motivation au top</p>
                  <p className="mt-1 text-xs leading-5 text-[#64748B]">
                    Séries quotidiennes, XP, combos, cœurs et quêtes reliées à ta vraie pratique orale.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {phase === "track" && (
            <motion.div
              key="track"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
              className="mx-auto max-w-2xl space-y-6"
            >
              <div className="flex items-center gap-4">
                <VoltMascot mood="happy" size={76} />
                <div className="relative rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#1E293B]">
                  Quel domaine d&apos;anglais veux-tu prioriser dans ton parcours ?
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {TRACKS.map((track) => {
                  const Icon = track.icon;
                  const selected = focusTrack === track.id;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => {
                        playTapSound(soundEnabled);
                        setFocusTrack(track.id);
                      }}
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                        selected
                          ? "border-[#6366F1] bg-[#E0E7FF]/60"
                          : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${track.accent}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1E293B]">{track.label}</p>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">{track.tag}</p>
                        <p className="mt-1 text-xs leading-4 text-[#64748B]">{track.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <TactileButton variant="outline" onClick={() => setPhase("hero")}>
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </TactileButton>
                <TactileButton
                  variant="primary"
                  onClick={() => {
                    playTapSound(soundEnabled);
                    setPhase("goal");
                  }}
                >
                  Continuer
                  <ArrowRight className="h-4 w-4" />
                </TactileButton>
              </div>
            </motion.div>
          )}

          {phase === "goal" && (
            <motion.div
              key="goal"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22 }}
              className="mx-auto max-w-xl space-y-6"
            >
              <div className="flex items-center gap-4">
                <VoltMascot mood="celebrating" size={76} />
                <div className="rounded-2xl border border-[#E2E8F0] bg-white px-4 py-3 text-sm font-bold text-[#1E293B]">
                  Super choix ! Quel objectif quotidien veux-tu tenir ?
                </div>
              </div>

              <div className="space-y-3">
                {GOALS.map((goal) => {
                  const selected = dailyGoalXp === goal.xp;
                  return (
                    <button
                      key={goal.xp}
                      type="button"
                      onClick={() => {
                        playTapSound(soundEnabled);
                        setDailyGoalXp(goal.xp);
                      }}
                      className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all ${
                        selected
                          ? "border-[#059669] bg-[#D1FAE5]/50"
                          : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Flame className={`h-5 w-5 ${selected ? "text-[#F97316]" : "text-[#94A3B8]"}`} />
                        <div>
                          <p className="text-base font-semibold text-[#1E293B]">{goal.label}</p>
                          <p className="text-xs font-semibold text-[#64748B]">{goal.minutes}</p>
                        </div>
                      </div>
                      <span
                        className={`rounded-xl px-3 py-1 text-xs font-semibold ${
                          selected ? "bg-[#059669] text-white" : "bg-[#F8FAFC] text-[#64748B]"
                        }`}
                      >
                        {goal.badge}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <TactileButton variant="outline" onClick={() => setPhase("track")}>
                  <ArrowLeft className="h-4 w-4" />
                  Retour
                </TactileButton>
                <TactileButton
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    playTapSound(soundEnabled);
                    onComplete({ focusTrack, dailyGoalXp });
                  }}
                >
                  Lancer mon parcours !
                  <ArrowRight className="h-5 w-5" />
                </TactileButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
