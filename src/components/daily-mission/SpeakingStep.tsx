"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMissionStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Square, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { isExternalZaiClientProcessingEnabled } from "@/config/external-ai";

const MAX_DURATION = 120; // 2 minutes in seconds

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SpeakingStep() {
  const externalProcessingEnabled = isExternalZaiClientProcessingEnabled();
  const {
    words,
    personalSentences,
    mission,
    transcription,
    setTranscription,
    setSpeakingSession,
    setStep,
    setError,
  } = useMissionStore();

  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [transcribing, setTranscribing] = useState(false);

  // `done` always tracks `transcription` 1:1 in every code path below
  // (startRecording clears both, transcribeAudio sets both), so it's
  // derived directly instead of duplicated in its own state + effect.
  const done = !!transcription;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      cleanupStream();
    };
  }, []);

  const transcribeAudio = useCallback(
    async (blob: Blob) => {
      setTranscribing(true);
      try {
        // Convert blob to base64
        const arrayBuffer = await blob.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < uint8Array.length; i++) {
          binary += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binary);

        const res = await fetch("/api/speaking-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: base64,
            missionId: mission?.id,
            durationSeconds: duration,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Erreur de transcription");
        }

        const data = await res.json();
        setTranscription(data.transcription);
        setSpeakingSession(data.session);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de transcription");
      } finally {
        setTranscribing(false);
      }
    },
    [mission, duration, setTranscription, setSpeakingSession, setError]
  );

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stopTimer();
        cleanupStream();
        setRecording(false);

        // Auto-transcribe
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribeAudio(blob);
      };

      mediaRecorder.start(1000); // collect chunks every second
      setRecording(true);
      setDuration(0);
      setTranscription(null);

      // Start timer
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev + 1 >= MAX_DURATION) {
            // Auto-stop at max duration
            mediaRecorderRef.current?.stop();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Micro inaccessible : ${err.message}`
          : "Impossible d'accéder au micro"
      );
    }
  }, [setError, setTranscription, stopTimer, cleanupStream, transcribeAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  }, [recording]);

  // Build a summary of personal sentences to show as prompt
  const sentenceList = words
    .map((w) => `• ${w.word}: ${personalSentences[w.id] || "—"}`)
    .join("\n");

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-stone-900">
          Parlez en anglais pendant 2 minutes
        </h2>
        <p className="text-sm text-stone-500">
          Utilisez vos 10 mots dans un discours personnel. Soyez naturel.
        </p>
      </div>

      {/* Sentences reminder (collapsible) */}
      <Card className="border-stone-200">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
            Vos phrases personnelles
          </p>
          <div className="text-sm text-stone-600 whitespace-pre-line max-h-40 overflow-y-auto">
            {sentenceList}
          </div>
        </CardContent>
      </Card>

      {/* Recording area */}
      <Card className="border-stone-200">
        <CardContent className="p-6 flex flex-col items-center gap-4">
          {!externalProcessingEnabled && (
            <div className="w-full rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
              La transcription cloud ZAI est désactivée pour protéger vos données réelles. Utilisez l’exercice Technical English pour enregistrer un audio local ou saisir une réponse sans service externe.
            </div>
          )}
          {/* Timer */}
          <div className="text-3xl font-mono font-semibold text-stone-900">
            {formatTime(duration)}
          </div>
          <p className="text-xs text-stone-400">
            {recording
              ? "Enregistrement en cours..."
              : done
                ? "Enregistrement terminé"
                : "Appuyez pour commencer"}
          </p>

          {/* Record button */}
          {!done && !transcribing && (
            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={!externalProcessingEnabled}
              className={`flex h-20 w-20 items-center justify-center rounded-full transition-all disabled:cursor-not-allowed disabled:bg-stone-300 disabled:shadow-none ${
                recording
                  ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 animate-pulse"
                  : "bg-stone-900 hover:bg-stone-800 shadow-lg shadow-stone-200"
              }`}
              aria-label={externalProcessingEnabled ? (recording ? "Arrêter l'enregistrement" : "Commencer l'enregistrement") : "Transcription cloud désactivée"}
            >
              {recording ? (
                <Square className="h-8 w-8 text-white fill-white" />
              ) : (
                <Mic className="h-8 w-8 text-white" />
              )}
            </button>
          )}

          {/* Transcribing state */}
          {transcribing && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 text-stone-400 animate-spin" />
              <p className="text-sm text-stone-500">Transcription en cours...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transcription result */}
      {done && transcription && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-medium text-green-700 uppercase tracking-wider">
              Transcription
            </p>
            <p className="text-sm text-stone-800 leading-relaxed">
              {transcription}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setStep("sentences")}
          className="shrink-0"
          size="lg"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Button
          onClick={() => setStep("correction")}
          disabled={!done}
          className="flex-1 bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50"
          size="lg"
        >
          Voir la correction
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
