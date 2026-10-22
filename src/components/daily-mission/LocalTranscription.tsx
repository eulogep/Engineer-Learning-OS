"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Cpu, Loader2, ShieldCheck } from "lucide-react";
import {
  LOCAL_ASR_MODEL_SIZE_LABEL,
  readLocalAsrConsent,
  writeLocalAsrConsent,
  type KeyValueStorage,
} from "@/modules/local-speech/core";
import {
  prepareLocalTranscription,
  transcribeLocally,
  type TranscriptionStatus,
} from "@/modules/local-speech/browser-transcriber";

type Status = TranscriptionStatus | Readonly<{ phase: "error"; message: string }> | null;

function storage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** On-device Whisper: explicit opt-in, then transcription that never leaves the browser. */
export function useLocalTranscription() {
  const [enabled, setEnabled] = useState(() => readLocalAsrConsent(storage()));
  const [status, setStatus] = useState<Status>(null);

  const enable = useCallback(async () => {
    writeLocalAsrConsent(storage(), true);
    setEnabled(true);
    setStatus({ phase: "downloading", percent: null });
    try {
      await prepareLocalTranscription(setStatus);
      setStatus(null);
    } catch (error) {
      setStatus({ phase: "error", message: error instanceof Error ? error.message : "Chargement impossible" });
    }
  }, []);

  const disable = useCallback(() => {
    writeLocalAsrConsent(storage(), false);
    setEnabled(false);
    setStatus(null);
  }, []);

  /** Returns the transcript, or null when disabled or failed (the learner then types). */
  const transcribe = useCallback(async (blob: Blob): Promise<string | null> => {
    if (!enabled) return null;
    setStatus({ phase: "transcribing" });
    try {
      const text = await transcribeLocally(blob, setStatus);
      setStatus(null);
      return text;
    } catch (error) {
      setStatus({ phase: "error", message: error instanceof Error ? error.message : "Transcription impossible" });
      return null;
    }
  }, [enabled]);

  const busy = status?.phase === "downloading" || status?.phase === "transcribing";
  return { enabled, status, busy, enable, disable, transcribe };
}

export type LocalTranscription = ReturnType<typeof useLocalTranscription>;

export function LocalTranscriptionPanel({ asr, purpose }: { asr: LocalTranscription; purpose: "production" | "pronunciation" }) {
  const { enabled, status } = asr;

  if (status?.phase === "downloading") {
    return (
      <div className="w-full space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
        <p className="font-medium">Préparation de la reconnaissance vocale… {status.percent !== null ? `${status.percent} %` : ""}</p>
        <div className="h-1.5 w-full rounded-full bg-emerald-100">
          <div className="h-1.5 rounded-full bg-emerald-600 transition-all" style={{ width: `${status.percent ?? 5}%` }} />
        </div>
        <p className="text-xs text-emerald-800">Une seule fois : le modèle est ensuite gardé dans ce navigateur, même hors ligne.</p>
      </div>
    );
  }
  if (status?.phase === "transcribing") {
    return (
      <div className="flex w-full items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900" role="status">
        <Loader2 className="h-4 w-4 animate-spin" /> Transcription sur votre appareil…
      </div>
    );
  }
  if (status?.phase === "error") {
    return (
      <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
        La reconnaissance vocale locale n’a pas pu fonctionner ({status.message}). {purpose === "production" ? "Écrivez votre production à la main." : "Vous pouvez continuer sans retour de prononciation."}
      </div>
    );
  }
  if (enabled) {
    return (
      <div className="flex w-full items-center justify-between gap-2 rounded-lg border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600">
        <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Reconnaissance vocale active, 100 % sur cet appareil.</span>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={asr.disable}>Désactiver</Button>
      </div>
    );
  }
  return (
    <div className="w-full space-y-2 rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-700">
      <p className="flex items-center gap-2 font-medium text-stone-900">
        <Cpu className="h-4 w-4 text-emerald-700" />
        {purpose === "production" ? "Transcription automatique, sans cloud" : "Retour de prononciation, sans cloud"}
      </p>
      <p className="text-xs text-stone-600">
        {purpose === "production"
          ? "Whisper transcrit votre anglais directement dans ce navigateur : votre voix n’est jamais envoyée."
          : "Lisez le texte corrigé : Whisper l’écoute dans ce navigateur et surligne les mots qu’il n’a pas reconnus. Votre voix n’est jamais envoyée."}
        {" "}Activation unique : téléchargement d’un modèle open source ({LOCAL_ASR_MODEL_SIZE_LABEL}) depuis Hugging Face.
      </p>
      <Button size="sm" variant="secondary" onClick={() => void asr.enable()}>Activer la reconnaissance vocale</Button>
    </div>
  );
}
