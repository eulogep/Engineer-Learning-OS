"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useMissionStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PartyPopper,
  RotateCcw,
  Clock,
  BookOpen,
  Flame,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { browserProgressSummary, updateMission } from "@/components/daily-mission/mission-gateway";
import { dayKey, missionReviews, reviewStateFromWord } from "@/modules/daily-english/local-mission";
import { applyReview, daysBetween, type ReviewOutcome } from "@/modules/daily-english/spaced-review";

const OUTCOME_STYLE: Record<ReviewOutcome, string> = {
  SUCCESS: "bg-green-100 text-green-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  FAIL: "bg-stone-100 text-stone-600",
};

function reviewLabel(days: number): string {
  if (days <= 1) return "demain";
  if (days < 30) return `dans ${days} j`;
  return `dans ${Math.round(days / 30)} mois`;
}

export function DoneStep() {
  const {
    words,
    mission,
    persistence,
    personalSentences,
    transcription,
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

  // Spaced-review outcome per word: used in the sentence and in the oral production.
  const reviews = useMemo(
    () => missionReviews(words, personalSentences, transcription ?? ""),
    [words, personalSentences, transcription],
  );
  const schedule = useMemo(() => {
    const today = dayKey(new Date());
    return new Map(reviews.map((review) => {
      const word = words.find((item) => item.id === review.wordId);
      const next = applyReview(word ? reviewStateFromWord(word) : { lastReviewedDay: null, nextReviewDay: null }, review.outcome, today);
      return [review.wordId, { outcome: review.outcome, inDays: daysBetween(today, next.nextReviewDay) }];
    }));
  }, [reviews, words]);
  const consolidated = reviews.filter((review) => review.outcome === "SUCCESS").length;
  // Read after completion so the streak and counters include today.
  const summary = useMemo(() => (persistence === "browser" && completed ? browserProgressSummary() : null), [persistence, completed]);

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
      setMission(await updateMission(persistence, mission.id, {
        speakingSessionId: speakingSession.id,
        completed: true,
        reviews,
      }));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur de finalisation"
      );
      fetchedRef.current = false;
    } finally {
      setSaving(false);
    }
  }, [mission, persistence, speakingSession, completed, reviews, setError, setMission]);

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
                  {consolidated}/{wordCount}
                </p>
                <p className="text-xs text-stone-500">mots consolidés</p>
              </CardContent>
            </Card>
            <Card className="border-stone-200">
              <CardContent className="p-4 text-center">
                {summary ? (
                  <>
                    <Flame className="h-5 w-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-stone-900">{summary.streak}</p>
                    <p className="text-xs text-stone-500">jour{summary.streak > 1 ? "s" : ""} de suite</p>
                  </>
                ) : (
                  <>
                    <Clock className="h-5 w-5 text-amber-500 mx-auto mb-1" />
                    <p className="text-2xl font-bold text-stone-900">
                      {formatDuration(duration)}
                    </p>
                    <p className="text-xs text-stone-500">enregistrement</p>
                  </>
                )}
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
                Prochaines révisions
              </p>
              <div className="flex flex-wrap gap-2">
                {words.map((w) => {
                  const item = schedule.get(w.id);
                  return (
                    <span
                      key={w.id}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${OUTCOME_STYLE[item?.outcome ?? "FAIL"]}`}
                    >
                      {w.word}
                      {item && <span className="font-normal opacity-70">· {reviewLabel(item.inDays)}</span>}
                    </span>
                  );
                })}
              </div>
              <p className="text-xs text-stone-500">
                Vert : utilisé à l’écrit et à l’oral. Orange : une seule fois. Gris : à retravailler demain.
              </p>
              {summary && (
                <p className="text-xs text-stone-500">
                  {summary.seen}/{summary.total} mots déjà travaillés · {summary.mastered} maîtrisé{summary.mastered > 1 ? "s" : ""}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Restart button */}
          <div className="pt-2 space-y-2">
            <p className="text-center text-xs text-stone-500">Prochaine mission demain, avec vos révisions prévues.</p>
            <Button
              onClick={handleRestart}
              variant="outline"
              className="w-full border-stone-300 hover:bg-stone-50"
              size="lg"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Revoir la mission du jour
            </Button>
          </div>
        </>
      )}
    </div>
  );
}