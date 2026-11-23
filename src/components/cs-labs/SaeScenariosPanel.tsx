"use client";

import { useState } from "react";
import { Briefcase, CheckCircle2, Clock, Volume2, XCircle } from "lucide-react";
import { CYU_SAE_SCENARIOS, type SaeScenario } from "@/modules/cs-labs/sae-scenarios";
import { speakEnglish } from "@/components/daily-mission/studio/sound-effects";

interface SaeScenariosPanelProps {
  saeSolvedIds: readonly string[];
  onSaeSolved: (id: string) => void;
}

export function SaeScenariosPanel({ saeSolvedIds, onSaeSolved }: SaeScenariosPanelProps) {
  const [selectedId, setSelectedId] = useState<string>(CYU_SAE_SCENARIOS[0].id);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const active: SaeScenario =
    CYU_SAE_SCENARIOS.find((s) => s.id === selectedId) ?? CYU_SAE_SCENARIOS[0];

  const allStepsCorrect = active.steps.every((step) => answers[step.id] === step.correctAnswer);

  const pickAnswer = (stepId: string, choice: string) => {
    const nextAnswers = { ...answers, [stepId]: choice };
    setAnswers(nextAnswers);
    const scenarioDone = active.steps.every((step) => nextAnswers[step.id] === step.correctAnswer);
    if (scenarioDone) {
      onSaeSolved(active.id);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      {/* Scenario list */}
      <div className="space-y-2.5">
        {CYU_SAE_SCENARIOS.map((s) => {
          const done = saeSolvedIds.includes(s.id);
          const selected = s.id === active.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelectedId(s.id)}
              className={`flex w-full cursor-pointer items-start justify-between gap-2 rounded-2xl border-2 p-4 text-left transition-all ${
                selected
                  ? "border-[#059669] bg-[#ECFDF5] shadow-[0_3px_0_#059669]"
                  : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
              }`}
            >
              <div>
                <p className="text-xs font-black text-[#1E293B]">{s.title}</p>
                <p className="mt-1 text-[11px] font-semibold text-[#64748B]">{s.ueTag}</p>
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#94A3B8]">
                  <Clock className="h-3 w-3" /> {s.durationMinutes} min · {s.steps.length} étapes
                </p>
              </div>
              {done && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#059669]" />}
            </button>
          );
        })}
      </div>

      {/* Active SAE Scenario */}
      <div className="rounded-3xl border-2 border-[#E2E8F0] bg-white p-6 shadow-sm space-y-6">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-lg bg-[#D1FAE5] px-2.5 py-0.5 text-[11px] font-black text-[#047857]">
              <Briefcase className="h-3.5 w-3.5" /> {active.ueTag}
            </span>
            {saeSolvedIds.includes(active.id) && (
              <span className="rounded-lg bg-[#EEF2FF] px-2.5 py-0.5 text-[11px] font-black text-[#4338CA]">
                ✓ SAE validée
              </span>
            )}
          </div>
          <h3 className="text-xl font-black text-[#1E293B]">{active.title}</h3>
          <p className="rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm font-medium leading-6 text-[#334155]">
            {active.context}
          </p>
        </div>

        <div className="space-y-5">
          {active.steps.map((step) => {
            const picked = answers[step.id];
            const isRight = picked === step.correctAnswer;
            return (
              <div key={step.id} className="space-y-3 rounded-2xl border-2 border-[#E2E8F0] p-4">
                <p className="text-xs font-black uppercase tracking-wider text-[#6366F1]">
                  {step.stageLabel}
                </p>
                <p className="text-sm font-extrabold text-[#1E293B]">{step.prompt}</p>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-[#0F172A] p-3 font-mono text-xs text-[#E2E8F0]">
                  {step.evidenceSnippet}
                </pre>
                <div className="space-y-2">
                  {step.choices.map((choice) => {
                    const selected = picked === choice;
                    const right = selected && choice === step.correctAnswer;
                    const wrong = selected && choice !== step.correctAnswer;
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => pickAnswer(step.id, choice)}
                        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border-2 px-3.5 py-3 text-left text-xs font-extrabold transition-all ${
                          right
                            ? "border-[#059669] bg-[#D1FAE5] text-[#047857]"
                            : wrong
                              ? "border-[#F43F5E] bg-[#FFE4E6] text-[#E11D48]"
                              : "border-[#E2E8F0] bg-white text-[#334155] hover:border-[#059669] hover:bg-[#ECFDF5]/50"
                        }`}
                      >
                        <span>{choice}</span>
                        {right && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669]" />}
                        {wrong && <XCircle className="h-4 w-4 shrink-0 text-[#F43F5E]" />}
                      </button>
                    );
                  })}
                </div>
                {picked && (
                  <p className={`text-xs font-bold ${isRight ? "text-[#047857]" : "text-[#E11D48]"}`}>
                    {isRight ? `✓ ${step.explanation}` : "✗ Reprends les indices techniques de l'extrait."}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* English Engineering Summary Bridge */}
        <div
          className={`rounded-2xl border-2 p-4 space-y-2 ${
            allStepsCorrect
              ? "border-[#C7D2FE] bg-[#EEF2FF]"
              : "border-[#E2E8F0] bg-[#F8FAFC]"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-black uppercase tracking-wider text-[#4338CA]">
              Pont Anglais Technique · {active.englishSummaryPrompt}
            </p>
            <button
              type="button"
              onClick={() => speakEnglish(active.englishSummaryModel)}
              className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-[#6366F1] text-white shadow-[0_3px_0_#4338CA]"
              aria-label="Écouter le résumé en anglais"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          </div>
          <p className="text-sm font-bold italic text-[#1E293B]">
            “{active.englishSummaryModel}”
          </p>
        </div>
      </div>
    </div>
  );
}
