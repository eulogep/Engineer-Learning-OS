"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { localFrenchVoice } from "@/components/learning-studio/ListenButton";
import type { AudioOverview } from "@/modules/learning-studio/overview";
import type { StudioCitation } from "@/modules/learning-studio/types";

/** Plays an audio overview segment by segment with on-device voices only, pausing before each answer. */
export function AudioOverviewPlayer({ overview, renderCitation }: { overview: AudioOverview; renderCitation: (citation: StudioCitation) => React.ReactNode }) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() => (supported ? localFrenchVoice() : null));
  const [current, setCurrent] = useState<number | null>(null);
  const cancelled = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!supported) return;
    const pick = () => setVoice(localFrenchVoice());
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", pick); cancelled.current = true; window.speechSynthesis.cancel(); if (timer.current) clearTimeout(timer.current); };
  }, [supported]);

  function stop() {
    cancelled.current = true;
    if (timer.current) clearTimeout(timer.current);
    window.speechSynthesis.cancel();
    setCurrent(null);
  }

  function play(index: number) {
    if (cancelled.current || index >= overview.segments.length || !voice) { setCurrent(null); return; }
    setCurrent(index);
    const segment = overview.segments[index];
    const utterance = new SpeechSynthesisUtterance(segment.text);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.95;
    utterance.onend = () => { timer.current = setTimeout(() => play(index + 1), segment.pauseAfterMs); };
    utterance.onerror = () => setCurrent(null);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {supported && voice ? (
          current === null
            ? <Button type="button" size="sm" onClick={() => { cancelled.current = false; play(0); }}><Headphones className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />Écouter le résumé audio</Button>
            : <Button type="button" size="sm" variant="outline" onClick={stop}><Square className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />Arrêter</Button>
        ) : <p className="text-xs text-slate-500">Lecture audio indisponible : aucune voix française locale sur cet appareil. Le script reste lisible ci-dessous.</p>}
        {voice && <span className="text-[11px] text-slate-500">voix locale {voice.name} · {overview.segments.length} segments</span>}
      </div>
      <ol className="max-h-80 space-y-1 overflow-y-auto text-sm" aria-label="Script du résumé audio">
        {overview.segments.map((segment, index) => (
          <li key={index} aria-current={current === index ? "true" : undefined}
            className={`rounded-md px-2 py-1 ${current === index ? "bg-emerald-100 ring-1 ring-emerald-400" : ""} ${segment.kind === "QUESTION" ? "font-medium" : ""} ${segment.kind === "CONFUSION" ? "text-amber-900" : ""}`}>
            {segment.text}
            {segment.citation && <span className="ml-1 inline-block align-middle">{renderCitation(segment.citation)}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
