"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMissionStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, Square, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";

const MAX_DURATION = 120; // 2 minutes

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function RepeatStep() {
  const {
    correctedText,
    speakingSession,
    setSpeakingSession,
    setStep,
    setError,
  } = useMissionStore();

  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [saving, setSaving] = useState(false);

  // `done` mirrors speakingSession.repeated directly — it's set true only
  // once the store is synced with the API response in saveRepeat, and the
  // record button only renders when !done, so there's no path that needs
  // a separate local flag or an effect to sync it.
  const done = !!speakingSession?.repeated;

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

  const saveRepeat = useCallback(async () => {
    if (!speakingSession?.id) return;

    setSaving(true);
    try {
      const res = await fetch("/api/speaking-session/repeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: speakingSession.id,
          durationSeconds: duration,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      const data = await res.json();
      // Sync the store so speakingSession.repeated reflects the DB —
      // otherwise navigating away and back within the same session
      // would forget the repeat was already done.
      if (data.session) {
        setSpeakingSession(data.session);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de la sauvegarde"
      );
    } finally {
      setSaving(false);
    }
  }, [speakingSession, duration, setError, setSpeakingSession]);

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
        await saveRepeat();
      };

      mediaRecorder.start(1000);
      setRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev + 1 >= MAX_DURATION) {
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
  }, [setError, stopTimer, cleanupStream, saveRepeat]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
    }
  }, [recording]);

  // No corrected text guard — shouldn't happen if flow is correct
  if (!correctedText) {
    return (
      <div className="text-center py-12">
        <p className="text-stone-500">Aucune correction disponible.</p>
        <Button
          variant="outline"
          onClick={() => setStep("correction")}
          className="mt-4"
        >
          Retour à la correction
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-stone-900">
          Répétez la version corrigée
        </h2>
        <p className="text-sm text-stone-500">
          Lisez le texte corrigé à voix haute. Prenez votre temps.
        </p>
      </div>

      {/* Corrected text to read */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Badge className="text-xs bg-blue-600">À lire</Badge>
            <p className="text-xs text-stone-400">Version corrigée par l&apos;IA</p>
          </div>
          <p className="text-sm text-stone-900 leading-relaxed font-medium">
            {correctedText}
          </p>
        </CardContent>
      </Card>

      {/* Recording area */}
      <Card className="border-stone-200">
        <CardContent className="p-6 flex flex-col items-center gap-4">
          {/* Timer */}
          <div className="text-3xl font-mono font-semibold text-stone-900">
            {formatTime(duration)}
          </div>
          <p className="text-xs text-stone-400">
            {recording
              ? "Enregistrement en cours..."
              : done
                ? "Répétition terminée !"
                : "Appuyez pour commencer la lecture"}
          </p>

          {/* Record / Done indicator */}
          {!done && !saving && (
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`flex h-20 w-20 items-center justify-center rounded-full transition-all ${
                recording
                  ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-200 animate-pulse"
                  : "bg-stone-900 hover:bg-stone-800 shadow-lg shadow-stone-200"
              }`}
              aria-label={
                recording
                  ? "Arrêter l'enregistrement"
                  : "Commencer la répétition"
              }
            >
              {recording ? (
                <Square className="h-8 w-8 text-white fill-white" />
              ) : (
                <Mic className="h-8 w-8 text-white" />
              )}
            </button>
          )}

          {/* Saving state */}
          {saving && (
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 border-4 border-stone-200 border-t-stone-600 rounded-full animate-spin" />
              <p className="text-sm text-stone-500">Sauvegarde...</p>
            </div>
          )}

          {/* Success state */}
          {done && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm text-green-700 font-medium">
                Bien joué ! Mission presque terminée.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setStep("correction")}
          className="shrink-0"
          size="lg"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Button
          onClick={() => setStep("done")}
          disabled={!done}
          className="flex-1 bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50"
          size="lg"
        >
          Terminer la mission
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}