"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Download, Pause, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { heldOutExcelEvidence } from "@/modules/held-out-excel/core";
import { heldOutExcelDefinition } from "@/modules/held-out-excel/definition";
import { useHeldOutExcelStore } from "@/modules/held-out-excel/browser-store";
import type { HeldOutExcelResult } from "@/modules/held-out-excel/types";
import { useLearningRecordStore } from "@/modules/learning-records/browser-store";

export function HeldOutExcelWorkspace() {
  const state = useHeldOutExcelStore();
  const addEvidenceRecords = useLearningRecordStore((current) => current.addEvidenceRecords);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      useHeldOutExcelStore.persist.rehydrate(),
      useLearningRecordStore.persist.rehydrate(),
    ]).then(() => {
      state.markHydrated();
      useLearningRecordStore.getState().markHydrated();
    });
  }, [state.markHydrated]);

  useEffect(() => {
    const evidence = heldOutExcelEvidence(state.attempt);
    if (state.hydrated && evidence) addEvidenceRecords([evidence]);
  }, [addEvidenceRecords, state.attempt, state.hydrated]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/assessment/excel-held-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delimiter: state.attempt.delimiter,
          anomalyId: state.attempt.anomalyId,
          explanation: state.attempt.explanation,
        }),
      });
      if (!response.ok) throw new Error("ASSESSMENT_UNAVAILABLE");
      state.complete(await response.json() as HeldOutExcelResult);
    } catch {
      setError("L’évaluation locale est indisponible. Tes réponses restent sauvegardées sur cet appareil; réessaie sans les ressaisir.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!state.hydrated) return <div className="mx-auto max-w-3xl animate-pulse rounded-2xl bg-slate-200 p-16" aria-label="Chargement de l’épreuve" />;

  if (state.attempt.status === "READY") return <div className="mx-auto max-w-3xl space-y-6">
    <Header />
    <Card><CardHeader><CardTitle>{heldOutExcelDefinition.title}</CardTitle></CardHeader><CardContent className="space-y-5">
      <p className="leading-7 text-slate-700">Nouveau fichier, aucune procédure détaillée et aucun indice. Travaille dans Excel, puis soumets uniquement ton diagnostic.</p>
      <ul className="list-disc space-y-2 pl-5 text-sm text-slate-600">{heldOutExcelDefinition.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ul>
      <div className="flex flex-wrap gap-3"><Button asChild variant="outline"><a href={heldOutExcelDefinition.datasetHref} download={heldOutExcelDefinition.datasetName}><Download />Télécharger le CSV inédit</a></Button><Button onClick={state.start}>Commencer sans aide</Button></div>
    </CardContent></Card>
    <Privacy />
  </div>;

  if (state.attempt.status === "PAUSED") return <div className="mx-auto max-w-3xl space-y-6"><Header /><Card><CardContent className="space-y-5 p-8 text-center"><Pause className="mx-auto size-10 text-amber-700" /><h1 className="text-2xl font-semibold">Épreuve en pause</h1><p className="text-slate-600">Le délimiteur, l’identifiant et ton explication sont conservés localement.</p><Button onClick={state.resume}>Reprendre exactement ici</Button></CardContent></Card><Privacy /></div>;

  if (state.attempt.status === "SUBMITTED" && state.attempt.result) {
    const result = state.attempt.result;
    return <div className="mx-auto max-w-3xl space-y-6"><Header /><Card className={result.passed ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}><CardContent className="space-y-5 p-8"><CheckCircle2 className="size-10 text-emerald-800" /><div><p className="text-xs font-semibold uppercase tracking-[0.18em]">Épreuve soumise</p><h1 className="mt-2 text-3xl font-semibold">{result.passed ? "Transfert autonome démontré" : "Une reprise ciblée est recommandée"}</h1></div><dl className="grid gap-3 sm:grid-cols-3"><Criterion label="Délimiteur" passed={result.delimiterValid} /><Criterion label="Anomalie" passed={result.anomalyValid} /><Criterion label="Explication" passed={result.explanationValid} /></dl><p className="text-sm leading-6 text-slate-700">La preuve et son résultat sont reliés à ta progression locale. Une soumission incomplète ne produit aucune maîtrise artificielle.</p><div className="flex flex-wrap gap-3"><Button onClick={state.reset}><RotateCcw />Nouvelle tentative</Button><Button asChild variant="outline"><Link href="/evidence">Voir la preuve</Link></Button></div></CardContent></Card><Privacy /></div>;
  }

  const canSubmit = state.attempt.delimiter && state.attempt.anomalyId.trim().length >= 3 && state.attempt.explanation.trim().length >= 35;
  return <div className="mx-auto max-w-3xl space-y-6">
    <Header />
    <Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Épreuve indépendante</p><CardTitle className="mt-2">Ton diagnostic</CardTitle></div><Button variant="outline" onClick={state.pause}><Pause />Pause</Button></div></CardHeader><CardContent className="space-y-5">
      <Button asChild variant="outline"><a href={heldOutExcelDefinition.datasetHref} download={heldOutExcelDefinition.datasetName}><Download />Télécharger le CSV inédit</a></Button>
      <div className="space-y-2"><label htmlFor="held-out-delimiter" className="text-sm font-semibold">Délimiteur utilisé</label><select id="held-out-delimiter" className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={state.attempt.delimiter} onChange={(event) => state.update({ delimiter: event.target.value })}><option value="">Choisir…</option><option value="comma">Virgule</option><option value="semicolon">Point-virgule</option><option value="tab">Tabulation</option></select></div>
      <div className="space-y-2"><label htmlFor="held-out-anomaly" className="text-sm font-semibold">Identifiant de la ligne dont la mesure est absente</label><Input id="held-out-anomaly" value={state.attempt.anomalyId} onChange={(event) => state.update({ anomalyId: event.target.value })} autoComplete="off" /></div>
      <div className="space-y-2"><label htmlFor="held-out-explanation" className="text-sm font-semibold">Comment l’aperçu confirme-t-il ton diagnostic ?</label><Textarea id="held-out-explanation" className="min-h-32" value={state.attempt.explanation} onChange={(event) => state.update({ explanation: event.target.value })} placeholder="Explique avec tes propres mots, sans tutoriel…" /></div>
      {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
      <Button size="lg" disabled={!canSubmit || submitting} onClick={() => void submit()}>{submitting ? "Évaluation locale…" : "Soumettre l’épreuve"}</Button>
    </CardContent></Card>
    <Privacy />
  </div>;
}

function Header() {
  return <header><Button asChild variant="ghost" className="-ml-3"><Link href="/learn/excel-csv-foundations-level-1"><ArrowLeft />Parcours guidé</Link></Button><p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Excel CSV Foundations</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Validation held-out</h1></header>;
}

function Criterion({ label, passed }: { label: string; passed: boolean }) {
  return <div className="rounded-xl bg-white/80 p-4"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold">{passed ? "Validé" : "À reprendre"}</dd></div>;
}

function Privacy() {
  return <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p>Fichier entièrement synthétique. Réponses et preuve conservées localement; aucun outil externe ni upload cloud.</p></div>;
}
