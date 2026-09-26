"use client";

import { useState } from "react";
import { useMissionStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, PenLine } from "lucide-react";

export function SentencesStep() {
  const {
    words,
    mission,
    personalSentences,
    setPersonalSentence,
    setStep,
    setError,
  } = useMissionStore();
  const [saving, setSaving] = useState(false);

  const filledCount = Object.values(personalSentences).filter(
    (s) => s.trim().length > 0
  ).length;
  const allFilled = filledCount === words.length;

  /** Save sentences to the API and advance to speaking step */
  const handleValidate = async () => {
    if (!mission) return;

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-mission", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionId: mission.id,
          personalSentences,
        }),
      });

      if (!res.ok) {
        throw new Error("Impossible de sauvegarder les phrases");
      }

      setStep("speaking");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-xl font-semibold text-stone-900">
          Écrivez une phrase pour chaque mot
        </h2>
        <p className="text-sm text-stone-500">
          Utilisez le mot dans une phrase <strong>personnelle</strong>, en anglais.
        </p>
        <p className="text-xs text-stone-400">
          {filledCount}/{words.length} phrases écrites
        </p>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-stone-200 rounded-full h-1.5">
        <div
          className="bg-stone-900 h-1.5 rounded-full transition-all duration-300"
          style={{ width: `${(filledCount / words.length) * 100}%` }}
        />
      </div>

      {/* Word cards with textareas */}
      <div className="space-y-3">
        {words.map((word, i) => {
          const sentence = personalSentences[word.id] || "";
          const isFilled = sentence.trim().length > 0;

          return (
            <Card
              key={word.id}
              className={`border transition-colors ${
                isFilled ? "border-stone-300 bg-white" : "border-stone-200 bg-stone-50/50"
              }`}
            >
              <CardContent className="p-4 space-y-2">
                {/* Word header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-stone-400">
                      {i + 1}.
                    </span>
                    <span className="font-semibold text-stone-900">
                      {word.word}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-xs text-stone-400 font-normal"
                    >
                      {word.category}
                    </Badge>
                  </div>
                  {isFilled && (
                    <PenLine className="h-3.5 w-3.5 text-green-600" />
                  )}
                </div>

                {/* Textarea */}
                <Textarea
                  placeholder={`Write a personal sentence using "${word.word}"...`}
                  value={sentence}
                  onChange={(e) =>
                    setPersonalSentence(word.id, e.target.value)
                  }
                  className="min-h-[72px] resize-none text-sm border-stone-200 focus-visible:ring-stone-400 placeholder:text-stone-300"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          onClick={() => setStep("words")}
          className="shrink-0"
          size="lg"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Button
          onClick={handleValidate}
          disabled={!allFilled || saving}
          className="flex-1 bg-stone-900 hover:bg-stone-800 text-white disabled:opacity-50"
          size="lg"
        >
          {saving ? "Sauvegarde..." : "Valider mes phrases"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}