"use client";

import { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function localFrenchVoice(): SpeechSynthesisVoice | null {
  const local = window.speechSynthesis.getVoices().filter((item) => item.localService && item.lang.toLowerCase().startsWith("fr"));
  return local.find((item) => item.lang.toLowerCase().replace("_", "-") === "fr-fr") ?? local[0] ?? null;
}

/**
 * Reads text aloud with the browser's speech synthesis, restricted to voices that
 * run on the device: online voices (e.g. Chrome's "Google" voices) would send the
 * text to an external service.
 */
export function ListenButton({ text, label = "Écouter" }: { text: string; label?: string }) {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(() => (supported ? localFrenchVoice() : null));
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const pick = () => setVoice(localFrenchVoice());
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => { window.speechSynthesis.removeEventListener("voiceschanged", pick); window.speechSynthesis.cancel(); };
  }, [supported]);

  if (!supported) return null;
  if (!voice) return <p className="text-xs text-slate-500">Lecture audio indisponible : aucune voix française locale sur cet appareil.</p>;

  function toggle() {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice; utterance.lang = voice!.lang; utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={toggle} aria-pressed={speaking}>
      {speaking ? <Square className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> : <Volume2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
      {speaking ? "Arrêter" : label}
      <span className="ml-1.5 text-[10px] text-slate-500">· voix locale {voice.name}</span>
    </Button>
  );
}
