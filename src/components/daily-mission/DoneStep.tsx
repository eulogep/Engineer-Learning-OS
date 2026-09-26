"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMissionStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PartyPopper,
  RotateCcw,
  Clock,
  BookOpen,
  AlertTriangle,
  Loader2,
} from "lucide-react";

export function DoneStep() {
  const {
    words,
    mission,
    speakingSession,
    feedback,
    correctedText,
    reset,
    setStep,
    setMission,
    setError,
  } = useMissionStore();

  const [saving, setSaving] = useState(false);
  const fetchedRef = useRef(false);

  // `completed` mirrors mission.completed directly. The PATCH response is
  // synced back into the store below, so navigating away and back within
  // the same session (without a full reload) still reflects the true state
  // instead of re-triggering a redundant PATCH.
  const completed = !!mission?.completed;

  const finalizeMission = useCallback(async () => {
    if (
      fetchedRef.current ||
      !mission?.id ||
      !speakingSession?.id ||
      completed
    )
      return;
    fetchedRef.current = true;
    setSaving(true);

    try {
      const res = await fetch("/api/daily-mission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId: mission.id,
          speakingSessionId: speakingSession.id,
          completed: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur de finalisation");
      }

      const data = await res.json();
      if (data.mission) {
        setMission(data.mission);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur de finalisation"
      );
      fetchedRef.current = false;
    } finally {
      setSaving(false);
    }
  }, [mission, speakingSession, completed, setError, setMission]);

  useEffect(() => {
    void finalizeMission();
  }, [finalizeMission]);

  const errorCount = feedback?.errors.length ?? 0;
  const duration = speakingSession?.durationSeconds ?? 0;
  const wordCount = words.length;

  function formatDuration(secs: number): string {
    if (secs <= 0) return "—";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m} min ${s}s`;
  }

  const handleRestart = () => {
    reset();
    setStep("words");
  };

  return (
    <div className="space-y-6">
      {/* Saving state */}
      {saving && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="h-10 w-10 text-stone-400 animate-spin" />
          <p className="text-sm text-stone-500">Finalisation de la mission...</p>
        </div>
      )}

      {/* Completed state */}
      {completed && !saving && (
        <>
          {/* Celebration header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-2">
              <PartyPopper className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900">
              Mission terminée !
            </h2>
            <p className="text-sm text-stone-500">
              Bravo ! Vous avez complété votre Daily English Mission du jour.
            </p>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-stone-200">
              <CardContent className="p-4 text-center">
                <BookOpen className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-stone-900">
                  {wordCount}
                </p>
                <p className="text-xs text-stone-500">mots appris</p>
              </CardContent>
            </Card>
            <Card className="border-stone-200">
              <CardContent className="p-4 text-center">
                <Clock className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                <p className="text-2xl font-bold text-stone-900">
                  {formatDuration(duration)}
                </p>
                <p className="text-xs text-stone-500">enregistrement</p>
              </CardContent>
            </Card>
            <Card className="border-stone-200">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="h-5 w-5 text-red-400 mx-auto mb-1" />
                <p className="text-2xl font-bold text-stone-900">
                  {errorCount}
                </p>
                <p className="text-xs text-stone-500">correction{errorCount !== 1 ? "s" : ""}</p>
              </CardContent>
            </Card>
          </div>

          {/* Corrected text recap */}
          {correctedText && (
            <Card className="border-green-200 bg-green-50/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge className="text-xs bg-green-600">Récapitulatif</Badge>
                  <p className="text-xs text-stone-400">
                    Votre anglais corrigé d&apos;aujourd&apos;hui
                  </p>
                </div>
                <p className="text-sm text-stone-800 leading-relaxed">
                  {correctedText}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Words recap */}
          <Card className="border-stone-200">
            <CardContent className="p-4 space-y-2">
              <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                Vos 10 mots du jour
              </p>
              <div className="flex flex-wrap gap-2">
                {words.map((w) => (
                  <span
                    key={w.id}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700"
                  >
                    {w.word}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Restart button */}
          <div className="pt-2">
            <Button
              onClick={handleRestart}
              variant="outline"
              className="w-full border-stone-300 hover:bg-stone-50"
              size="lg"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Commencer une nouvelle mission
            </Button>
          </div>
        </>
      )}
    </div>
  );
}