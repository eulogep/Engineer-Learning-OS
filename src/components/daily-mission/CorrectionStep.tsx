"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMissionStore } from "@/lib/store";
import type { ParsedFeedback } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Loader2, AlertTriangle } from "lucide-react";

async function fetchCorrection(
  transcription: string,
  words: { id: string; word: string }[],
  personalSentences: Record<string, string>,
  sessionId?: string
) {
  const res = await fetch("/api/correction", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcription, words, personalSentences, sessionId }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Erreur de correction");
  }
  return res.json() as Promise<{
    correctedText: string;
    feedback: ParsedFeedback;
  }>;
}

export function CorrectionStep() {
  const {
    transcription,
    words,
    personalSentences,
    speakingSession,
    correctedText,
    feedback,
    setCorrectedText,
    setFeedback,
    setStep,
    setError,
  } = useMissionStore();

  const [loading, setLoading] = useState(!correctedText);
  const fetchedRef = useRef(false);

  const loadCorrection = useCallback(async () => {
    if (fetchedRef.current || !transcription || correctedText) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const wordSummaries = words.map((w) => ({ id: w.id, word: w.word }));
      const data = await fetchCorrection(
        transcription,
        wordSummaries,
        personalSentences,
        speakingSession?.id
      );
      setCorrectedText(data.correctedText);
      setFeedback(data.feedback);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de correction");
      fetchedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [
    transcription,
    correctedText,
    words,
    personalSentences,
    speakingSession,
    setCorrectedText,
    setFeedback,
    setError,
  ]);

  useEffect(() => {
    void loadCorrection();
  }, [loadCorrection]);

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h2 className="text-xl font-semibold text-stone-900">
            Correction en cours...
          </h2>
          <p className="text-sm text-stone-500">
            L&apos;IA analyse votre anglais.
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 text-stone-400 animate-spin" />
            <p className="text-sm text-stone-400">Analyse par l&apos;IA...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-stone-900">
          Votre correction
        </h2>
        <p className="text-sm text-stone-500">
          Comparez votre version avec la version corrigée.
        </p>
      </div>

      {/* Original transcription */}
      <Card className="border-stone-200">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              Original
            </Badge>
            <p className="text-xs text-stone-400">Transcription de votre oral</p>
          </div>
          <p className="text-sm text-stone-700 leading-relaxed">
            {transcription}
          </p>
        </CardContent>
      </Card>

      {/* Corrected version */}
      {correctedText && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="text-xs bg-green-600">Corrigé</Badge>
              <p className="text-xs text-stone-400">Version améliorée par l&apos;IA</p>
            </div>
            <p className="text-sm text-stone-900 leading-relaxed font-medium">
              {correctedText}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Key errors */}
      {feedback && feedback.errors.length > 0 && (
        <Card className="border-amber-200">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-800">
                {feedback.errors.length} erreur{feedback.errors.length > 1 ? "s" : ""} importante{feedback.errors.length > 1 ? "s" : ""}
              </p>
            </div>

            <div className="space-y-3">
              {feedback.errors.map((err, i) => (
                <div
                  key={i}
                  className="pl-3 border-l-2 border-amber-300 space-y-1"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xs font-mono text-red-600 line-through bg-red-50 px-1.5 py-0.5 rounded">
                      {err.original}
                    </span>
                    <span className="text-xs text-stone-400">→</span>
                    <span className="text-xs font-mono text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-medium">
                      {err.corrected}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 pl-1">
                    {err.explanation}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => setStep("speaking")}
          className="shrink-0"
          size="lg"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Button
          onClick={() => setStep("repeat")}
          disabled={!correctedText}
          className="flex-1 bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50"
          size="lg"
        >
          Répéter la version corrigée
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}