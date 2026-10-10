"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useMissionStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowRight } from "lucide-react";
import { loadTodayMission } from "@/components/daily-mission/mission-gateway";
import { vocabularyEntry } from "@/modules/daily-english/vocabulary";
import { reviewStateFromWord } from "@/modules/daily-english/local-mission";
import { reviewStatus } from "@/modules/daily-english/spaced-review";
import type { WordStatus } from "@/types";

const STATUS_LABEL: Record<WordStatus, { label: string; className: string }> = {
  nouveau: { label: "Nouveau", className: "border-blue-200 bg-blue-50 text-blue-700" },
  actif: { label: "Révision", className: "border-amber-200 bg-amber-50 text-amber-800" },
  maitrise: { label: "Maîtrisé", className: "border-green-200 bg-green-50 text-green-700" },
};

export function WordsStep() {
  const { words, setWords, setMission, setPersistence, setPersonalSentence, setStep, setError } = useMissionStore();
  const [loading, setLoading] = useState(words.length === 0);
  const fetchedRef = useRef(false);

  const loadWords = useCallback(async () => {
    // If words are already in the store, skip fetch entirely
    if (words.length > 0) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const data = await loadTodayMission();
      setPersistence(data.persistence);
      setWords(data.words);
      setMission(data.mission);
      // Restore saved personal sentences from the mission
      try {
        const saved = JSON.parse(data.mission.personalSentencesJson || "{}");
        for (const [wordId, sentence] of Object.entries(saved)) {
          if (typeof sentence === "string" && sentence.trim()) {
            setPersonalSentence(wordId, sentence);
          }
        }
      } catch {
        // ignore parse errors
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
      fetchedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, [words.length, setWords, setMission, setPersistence, setPersonalSentence, setError]);

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

  // Derived from the schedule: legacy rows marked "actif" by the former rotation are still new.
  const statusOf = (word: (typeof words)[number]) => reviewStatus(reviewStateFromWord(word));
  const reviewCount = words.filter((word) => statusOf(word) !== "nouveau").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-300 border-t-stone-900" />
          <p className="text-sm text-stone-500">Chargement des mots...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-stone-900">
          Vos 10 mots du jour
        </h2>
        <p className="text-sm text-stone-500">
          Mémorisez-les. Vous devrez écrire une phrase personnelle pour chacun.
        </p>
        {words.length > 0 && (
          <p className="text-xs text-stone-400">
            {words.length - reviewCount} nouveau{words.length - reviewCount > 1 ? "x" : ""} · {reviewCount} en révision
          </p>
        )}
      </div>

      <div className="space-y-2">
        {words.map((word, i) => {
          const entry = vocabularyEntry(word.word);
          const status = STATUS_LABEL[statusOf(word)];
          return (
            <Card
              key={word.id}
              className="border-stone-200 bg-white transition-shadow hover:shadow-sm"
            >
              <CardContent className="flex items-start gap-4 p-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-medium text-stone-600">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 font-semibold text-stone-900 text-lg">
                      {word.word}
                    </span>
                    <Badge variant="outline" className={`text-xs font-normal ${status.className}`}>
                      {status.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs text-stone-400 font-normal">
                      {entry ? `${entry.packLabel} · ${word.category}` : word.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-stone-500 mt-0.5">
                    {word.translation}
                  </p>
                  {entry && (
                    <p className="mt-1.5 text-sm italic text-stone-600">
                      “{entry.example}”
                    </p>
                  )}
                </div>
                <BookOpen className="mt-1 h-4 w-4 text-stone-300 shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {words.length > 0 && (
        <div className="pt-2">
          <Button
            onClick={() => setStep("sentences")}
            className="w-full bg-stone-900 hover:bg-stone-800 text-white"
            size="lg"
          >
            J&apos;ai mémorisé mes mots
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}