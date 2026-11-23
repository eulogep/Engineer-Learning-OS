import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileCheck2, Languages, Terminal } from "lucide-react";
import { ExcelLearningPathCard } from "@/components/learning-os/ExcelLearningPathCard";
import { TechnicalEnglishLearningCard } from "@/components/technical-english/TechnicalEnglishLearningCard";
import { DeepMasteryLearningCard } from "@/components/deep-mastery/DeepMasteryLearningCard";
import { ProfessionalScenarioLearningCard } from "@/components/professional-scenarios/ProfessionalScenarioLearningCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SemesterExamModesCard } from "@/components/current-semester/CurrentSemesterViews";

export const metadata: Metadata = { title: "Apprendre" };

export default function LearnPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Apprendre</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Des parcours courts, reliés à un objectif réel.</h1><p className="max-w-2xl text-base leading-7 text-slate-600">Commence par le parcours qui répond au principal blocage observé pendant ta baseline.</p></header>
      <SemesterExamModesCard />
      <section aria-label="Parcours disponibles" className="grid gap-5 lg:grid-cols-2">
        <ExcelLearningPathCard />
        <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm"><CardHeader className="space-y-4"><span className="grid size-11 place-items-center rounded-xl bg-emerald-800 text-white"><FileCheck2 className="size-5" aria-hidden="true" /></span><div className="space-y-2"><Badge variant="outline">HELD-OUT</Badge><CardTitle className="text-xl">Validation Excel autonome</CardTitle><p className="text-sm font-medium text-slate-500">CSV inédit · sans procédure · 10 min</p></div></CardHeader><CardContent className="space-y-5"><p className="text-sm leading-6 text-slate-600">Transfère ce que tu as appris vers un nouveau fichier synthétique. L’évaluation reste isolée du bundle client.</p><Button asChild><Link href="/learn/excel-csv-foundations-level-1/held-out">Passer l’épreuve<ArrowRight aria-hidden="true" /></Link></Button></CardContent></Card>
        <TechnicalEnglishLearningCard />
        <DeepMasteryLearningCard />
        <ProfessionalScenarioLearningCard />
        <Card className="border-indigo-200 bg-indigo-50/40 shadow-sm">
          <CardHeader className="space-y-4">
            <span className="grid size-11 place-items-center rounded-xl bg-indigo-700 text-white">
              <Terminal className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-2">
              <Badge variant="outline">CYU L3 / LICENCE PRO</Badge>
              <CardTitle className="text-xl">Labs Ingénieur Informatique</CardTitle>
              <p className="text-sm font-medium text-slate-500">
                CIDR/VLSM · Sandbox Linux · SOC/ACL · SQL · Graphes &amp; SAE
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-slate-600">
              Simulateurs interactifs 100 % locaux alignés sur CY Cergy Paris Université (Réseaux, Linux, Cybersécurité, BDD, Algo/OS et Scénarios SAE).
            </p>
            <Button asChild>
              <Link href="/learn/cs-labs">
                Ouvrir les Labs<ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-white shadow-sm"><CardHeader className="space-y-4"><span className="grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-800"><Languages className="size-5" aria-hidden="true" /></span><div className="space-y-2"><Badge variant="outline">STUDIO GAMIFIÉ</Badge><CardTitle className="text-xl">Daily English Studio</CardTitle><p className="text-sm font-medium text-slate-500">9 unités · 240 termes · Histoires · Chrono · Oral</p></div></CardHeader><CardContent className="space-y-5"><p className="text-sm leading-6 text-slate-600">Parcours interactif inspiré du jeu, 6 histoires pro, pièges francophones et mission guidée en 6 étapes.</p><Button asChild variant="outline"><Link href="/daily-english">Continuer<ArrowRight aria-hidden="true" /></Link></Button></CardContent></Card>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h2 className="font-semibold text-slate-900">Prochaines étapes du parcours Excel</h2><p className="mt-2 text-sm leading-6 text-slate-600">Les niveaux suivants restent verrouillés jusqu’à la réussite et la revue du Niveau 1. Aucun progrès futur n’est simulé.</p></section>
    </div>
  );
}
