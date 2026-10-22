"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { useMissionStore } from "@/lib/store";
import type { MissionStep } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, PenLine, Mic, CheckCircle2, RotateCcw, PartyPopper } from "lucide-react";
import { WordsStep } from "@/components/daily-mission/WordsStep";
import { SentencesStep } from "@/components/daily-mission/SentencesStep";
import { SpeakingStep } from "@/components/daily-mission/SpeakingStep";
import { CorrectionStep } from "@/components/daily-mission/CorrectionStep";
import { RepeatStep } from "@/components/daily-mission/RepeatStep";
import { DoneStep } from "@/components/daily-mission/DoneStep";

const STEPS: { key: MissionStep; label: string; icon: React.ReactNode }[] = [
  { key: "words", label: "Mots du jour", icon: <BookOpen className="h-4 w-4" /> },
  { key: "sentences", label: "Phrases", icon: <PenLine className="h-4 w-4" /> },
  { key: "speaking", label: "Oral", icon: <Mic className="h-4 w-4" /> },
  { key: "correction", label: "Correction", icon: <CheckCircle2 className="h-4 w-4" /> },
  { key: "repeat", label: "Répétition", icon: <RotateCcw className="h-4 w-4" /> },
  { key: "done", label: "Terminé", icon: <PartyPopper className="h-4 w-4" /> },
];

const noSubscription = () => () => {};
const todayLabel = () => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

export function DailyEnglishMission() {
  // The page is prerendered at deploy time: the date must come from the browser, not the build.
  const today = useSyncExternalStore(noSubscription, todayLabel, () => "");
  const { currentStep, error, persistence, setStep, setError } = useMissionStore();
  const stepIndex = STEPS.findIndex((step) => step.key === currentStep);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-stone-50 to-stone-100 shadow-sm">
      <header className="border-b bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-stone-900">Daily English Mission</h1>
            <p className="text-xs text-stone-500">
              {today}
              {" · "}<Link href="/daily-english/roleplay" className="text-emerald-800 underline-offset-2 hover:underline">Jeux de rôle oraux</Link>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {persistence === "browser" && (
              <Badge variant="outline" className="text-xs text-stone-500" title="Progression enregistrée uniquement dans ce navigateur">
                Mode local
              </Badge>
            )}
            <Badge variant={currentStep === "done" ? "default" : "secondary"} className="text-xs">
              Étape {stepIndex + 1}/{STEPS.length}
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 pt-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-2" aria-label="Étapes de la mission">
          {STEPS.map((step, index) => {
            const isActive = step.key === currentStep;
            const isPast = index < stepIndex;
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => { if (isPast || isActive) setStep(step.key); }}
                disabled={!isPast && !isActive}
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-700 focus-visible:ring-offset-2 ${
                  isActive ? "bg-stone-900 text-white" : isPast ? "cursor-pointer bg-stone-200 text-stone-700 hover:bg-stone-300" : "cursor-not-allowed bg-stone-100 text-stone-400"
                }`}
              >
                {step.icon}<span className="hidden sm:inline">{step.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="mx-auto max-w-2xl px-4 pt-2">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center justify-between p-3">
              <p className="text-sm text-red-700">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => setError(null)} className="text-red-600 hover:text-red-800">Fermer</Button>
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

