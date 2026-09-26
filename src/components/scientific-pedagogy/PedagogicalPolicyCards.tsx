"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FlaskConical, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndexedDbCanonicalLearningRepository } from "@/modules/learning-history/adapters/indexeddb";
import { rebuildPedagogicalPolicyFromRepository, type PedagogicalPolicySnapshot } from "@/modules/scientific-pedagogy/snapshot";
import type { PedagogicalPlan } from "@/modules/scientific-pedagogy/types";

type LocalState = { status: "LOADING" | "READY" | "UNAVAILABLE"; snapshot: PedagogicalPolicySnapshot | null };

const actionCopy: Record<PedagogicalPlan["action"], string> = {
  RETRIEVE: "Récupérer la notion sans support",
  SPACE: "Attendre la prochaine vérification espacée",
  INTERLEAVE: "Distinguer deux notions proches",
  SELF_EXPLAIN: "Expliquer le mécanisme avec tes propres mots",
  WORKED_EXAMPLE: "Étudier un exemple résolu",
  FADE_SUPPORT: "Réessayer avec moins d’aide",
  TRANSFER: "Appliquer la notion à un cas nouveau",
  REMEDIATE_PREREQUISITE: "Revoir un prérequis précis",
};

function routeFor(action: PedagogicalPlan["action"]) {
  if (action === "RETRIEVE" || action === "INTERLEAVE" || action === "REMEDIATE_PREREQUISITE") return "/review";
  if (action === "TRANSFER" || action === "SELF_EXPLAIN" || action === "FADE_SUPPORT") return "/learn/deep-mastery-csv";
  return "/learn";
}

function usePedagogicalPolicy(): LocalState {
  const [state, setState] = useState<LocalState>({ status: "LOADING", snapshot: null });
  useEffect(() => {
    const repository = new IndexedDbCanonicalLearningRepository();
    let active = true;
    void repository.initialize()
      .then(() => rebuildPedagogicalPolicyFromRepository(repository))
      .then((snapshot) => { if (active) setState({ status: "READY", snapshot }); })
      .catch(() => { if (active) setState({ status: "UNAVAILABLE", snapshot: null }); })
      .finally(() => repository.close());
    return () => { active = false; repository.close(); };
  }, []);
  return state;
}

export function PedagogicalNextActionCard() {
  const state = usePedagogicalPolicy();
  const plan = state.snapshot?.plans[0] ?? null;
  return <Card className="border-cyan-200/80 bg-cyan-50/50 shadow-sm">
    <CardHeader className="space-y-2">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800"><FlaskConical className="size-4" aria-hidden="true" />Politique pédagogique locale</p>
      <CardTitle className="text-xl">{state.status === "LOADING" ? "Analyse des preuves locales…" : plan ? actionCopy[plan.action] : "Aucune action scientifique prioritaire"}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm leading-6 text-slate-600">{state.status === "UNAVAILABLE" ? "L’analyse locale est indisponible; aucune progression n’est modifiée." : plan ? "Cette proposition vient de preuves canoniques et reste une recommandation explicable." : "Une recommandation apparaîtra après une preuve, une erreur ou une révision."}</p>
      {plan && <Button asChild variant="outline"><Link href={routeFor(plan.action)}>Continuer<ArrowRight /></Link></Button>}
    </CardContent>
  </Card>;
}

export function PedagogicalProgressCard() {
  const state = usePedagogicalPolicy();
  const metrics = state.snapshot?.metrics;
  return <Card className="border-slate-200 bg-white shadow-sm">
    <CardHeader><p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800">Indicateurs d’apprentissage</p><CardTitle>Mesures fondées sur les preuves</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {state.status === "LOADING" ? <p className="text-sm text-slate-600">Calcul local en cours…</p> : state.status === "UNAVAILABLE" ? <p role="status" className="text-sm text-amber-800">Indicateurs indisponibles; l’historique local reste inchangé.</p> : <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Récupérations différées réussies</dt><dd className="mt-1 text-xl font-semibold">{metrics?.delayedRetrievalSuccesses ?? 0}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Transferts réussis</dt><dd className="mt-1 text-xl font-semibold">{metrics?.transferSuccesses ?? 0}</dd></div>
        <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Erreurs récurrentes</dt><dd className="mt-1 text-xl font-semibold">{metrics?.recurringErrors ?? 0}</dd></div>
      </dl>}
      <p className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="size-4 text-emerald-700" aria-hidden="true" />Calculé sur cet appareil; la confiance seule ne crée jamais de maîtrise.</p>
    </CardContent>
  </Card>;
}
