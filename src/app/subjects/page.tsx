import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { academicWorkspaceRegistry } from "@/modules/academic-workspace/pilot-registry";
import { PotentialAcademicSourcesCard } from "@/components/academic-workspace/PotentialAcademicSourcesCard";
import { SemesterSubjectsOverview } from "@/components/current-semester/CurrentSemesterViews";

const SYNTHETIC_LAB_LINKS: Readonly<Record<string, { href: string; label: string }>> = {
  networking: { href: "/learn/cs-labs?tab=networking", label: "Lab Réseaux & CIDR" },
  "system-administration": { href: "/learn/cs-labs?tab=linux", label: "Sandbox Linux" },
  cybersecurity: { href: "/learn/cs-labs?tab=linux", label: "Lab Cyber & SOC" },
  databases: { href: "/learn/cs-labs?tab=sql", label: "Atelier SQL & 3NF" },
  "technical-english": { href: "/daily-english", label: "Studio Daily English" },
};

export const metadata: Metadata = { title: "Matières" };
export default function SubjectsPage() {
  return (
    <div className="space-y-7">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Tes matières</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Espace académique multi-matière</h1>
        <p className="max-w-2xl leading-7 text-slate-600">
          L’état déclaré du semestre, les entraînements synthétiques CYU et les contenus validés par tes sources personnelles restent clairement séparés.
        </p>
      </header>

      <Card className="border-emerald-200 bg-emerald-50/40 shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-emerald-800 text-white">
              <Terminal className="size-5" aria-hidden="true" />
            </span>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Entraînement synthétique · CYU L3 / Licence Pro
              </p>
              <h2 className="text-lg font-semibold text-slate-950">Labs Ingénieur Informatique</h2>
              <p className="max-w-2xl text-sm text-slate-600">
                Subnetting CIDR/VLSM, Routage LPM, Sandbox Linux, Triage SOC/Pare-feu, Atelier SQL, Graphes/OS et Scénarios SAE d’alternance.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/learn/cs-labs">
              Ouvrir les Labs <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <SemesterSubjectsOverview />

      <section aria-labelledby="validated-subjects-heading" className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Contenus validés</p>
          <h2 id="validated-subjects-heading" className="mt-2 text-2xl font-semibold">Matières fondées sur des sources vérifiées</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {academicWorkspaceRegistry.subjects.map((subject) => {
            const syntheticLab = SYNTHETIC_LAB_LINKS[subject.slug];
            return (
              <Card key={subject.id} className={subject.status === "ACTIVE" ? "border-emerald-300" : ""}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <BookOpen className="size-5 text-emerald-700" />
                    <Badge variant={subject.status === "ACTIVE" ? "default" : "outline"}>
                      {subject.status === "ACTIVE" ? "Active" : "Planifiée"}
                    </Badge>
                  </div>
                  <CardTitle>{subject.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm leading-6 text-slate-600">{subject.description}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {subject.status === "ACTIVE" && (
                      <Button asChild>
                        <Link href={`/subjects/${subject.slug}`}>
                          Ouvrir la matière <ArrowRight />
                        </Link>
                      </Button>
                    )}
                    {syntheticLab ? (
                      <Button asChild variant={subject.status === "ACTIVE" ? "outline" : "secondary"}>
                        <Link href={syntheticLab.href}>
                          {syntheticLab.label} <ArrowRight />
                        </Link>
                      </Button>
                    ) : (
                      subject.status !== "ACTIVE" && (
                        <p className="text-xs text-slate-500">Aucun contenu ni progression inventé.</p>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
      <PotentialAcademicSourcesCard />
    </div>
  );
}
