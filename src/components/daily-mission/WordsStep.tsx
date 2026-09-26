"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useMissionStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowRight } from "lucide-react";

async function fetchDailyMission() {
  const res = await fetch("/api/daily-mission");
  if (!res.ok) {
    throw new Error("Impossible de charger les mots du jour");
  }
  return res.json() as Promise<{
    words: import("@/types").Word[];
    mission: import("@/types").DailyMission;
  }>;
}

export function WordsStep() {
  const { words, setWords, setMission, setPersonalSentence, setStep, setError } = useMissionStore();
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
      const data = await fetchDailyMission();
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
  }, [words.length, setWords, setMission, setError]);

  useEffect(() => {
    void loadWords();
  }, [loadWords]);

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
      </div>

      <div className="space-y-2">
        {words.map((word, i) => (
          <Card
            key={word.id}
            className="border-stone-200 bg-white transition-shadow hover:shadow-sm"
          >
            <CardContent className="flex items-center gap-4 p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-stone-100 text-sm font-medium text-stone-600">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-stone-900 text-lg">
                    {word.word}
                  </span>
                  <Badge
                    variant="outline"
                    className="text-xs text-stone-400 font-normal"
                  >
                    {word.category}
                  </Badge>
                </div>
                <p className="text-sm text-stone-500 mt-0.5">
                  {word.translation}
                </p>
              </div>
              <BookOpen className="h-4 w-4 text-stone-300 shrink-0" />
            </CardContent>
          </Card>
        ))}
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