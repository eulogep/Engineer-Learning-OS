"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NotebookLMDerivedArtifact } from "@/modules/notebooklm/types";

export function NotebookLMQuizActivity({ artifact }: { artifact: NotebookLMDerivedArtifact }) {
  const candidates = artifact.quizCandidates ?? [];
  const questions = useMemo(() => candidates.filter((candidate) => candidate.validForActiveQuiz), [candidates]);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState<boolean | null>(null);
  const current = questions[index];

  function checkAnswer() {
    if (!current?.answer || !answer) return;
    setChecked(answer === current.answer);
  }

  function next() {
    setAnswer("");
    setChecked(null);
    setIndex((value) => value + 1);
  }

  return <div className="mt-4 space-y-3 rounded-xl border border-cyan-200 bg-white p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="font-semibold">Quiz NotebookLM prêt</p><p className="text-slate-600">{candidates.length} question(s) récupérée(s) · {questions.length} utilisable(s) dans l'activité locale</p></div>
      <div className="flex flex-wrap gap-2"><Badge variant="outline">DÉRIVÉ</Badge><Badge variant="outline">NON VÉRIFIÉ</Badge></div>
    </div>
    <p className="text-xs text-slate-600">Bundle : {artifact.sourceBundleId} · Artefact : {artifact.id}</p>
    {!started && questions.length > 0 && <Button onClick={() => setStarted(true)}>Commencer le quiz <ArrowRight /></Button>}
    {!started && questions.length === 0 && <p className="flex gap-2 text-amber-800"><CircleAlert className="size-4 shrink-0" />Aucune question ne possède encore une réponse récupérée de façon suffisamment déterministe. L'artefact reste visible, mais aucun contenu manquant n'est inventé.</p>}
    {started && current && <div className="space-y-3">
      <p className="font-semibold">Question {index + 1}/{questions.length} · {current.question}</p>
      {current.choices.length > 0 ? <div className="grid gap-2">{current.choices.map((choice) => <label key={choice} className="flex gap-2 rounded-lg border p-3"><input type="radio" name={current.id} checked={answer === choice} onChange={() => { setAnswer(choice); setChecked(null); }} /><span>{choice}</span></label>)}</div> : <input className="w-full rounded-lg border px-3 py-2" value={answer} onChange={(event) => { setAnswer(event.target.value); setChecked(null); }} />}
      {checked === null ? <Button disabled={!answer} onClick={checkAnswer}>Vérifier</Button> : <div className="space-y-2">
        <p className={checked ? "font-semibold text-emerald-800" : "font-semibold text-rose-800"}>{checked ? "Réponse correcte." : "Réponse incorrecte."}</p>
        {current.explanation && <p className="text-slate-700">{current.explanation}</p>}
        <p className="text-xs text-slate-600">{current.sourceSupport === "PROVIDER_CITED" ? "Référence fournisseur : " + current.sourceRefs.join(", ") : "SOURCE_SUPPORT : UNVERIFIED"}</p>
        {index + 1 < questions.length ? <Button onClick={next}>Question suivante <ArrowRight /></Button> : <p className="flex gap-2 font-semibold text-emerald-800"><CheckCircle2 className="size-5" />Quiz local terminé. Cette activité n'est pas automatiquement enregistrée comme Evidence.</p>}
      </div>}
    </div>}
  </div>;
}
