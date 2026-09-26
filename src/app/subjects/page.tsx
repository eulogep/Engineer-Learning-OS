import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { academicWorkspaceRegistry } from "@/modules/academic-workspace/pilot-registry";
import { PotentialAcademicSourcesCard } from "@/components/academic-workspace/PotentialAcademicSourcesCard";
import { SemesterSubjectsOverview } from "@/components/current-semester/CurrentSemesterViews";
export const metadata: Metadata = { title: "Matières" };
export default function SubjectsPage() {
  return <div className="space-y-7"><header className="space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Tes matières</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Espace académique multi-matière</h1><p className="max-w-2xl leading-7 text-slate-600">L’état déclaré du semestre et les contenus validés par des sources restent clairement séparés.</p></header><SemesterSubjectsOverview /><section aria-labelledby="validated-subjects-heading" className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Contenus validés</p><h2 id="validated-subjects-heading" className="mt-2 text-2xl font-semibold">Matières fondées sur des sources vérifiées</h2></div><div className="grid gap-5 md:grid-cols-2">{academicWorkspaceRegistry.subjects.map((subject) => <Card key={subject.id} className={subject.status === "ACTIVE" ? "border-emerald-300" : ""}><CardHeader><div className="flex items-center justify-between gap-3"><BookOpen className="size-5 text-emerald-700" /><Badge variant={subject.status === "ACTIVE" ? "default" : "outline"}>{subject.status === "ACTIVE" ? "Active" : "Planifiée"}</Badge></div><CardTitle>{subject.title}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-slate-600">{subject.description}</p>{subject.status === "ACTIVE" ? <Button asChild><Link href={`/subjects/${subject.slug}`}>Ouvrir la matière <ArrowRight /></Link></Button> : <p className="text-xs text-slate-500">Aucun contenu ni progression inventé.</p>}</CardContent></Card>)}</div></section><PotentialAcademicSourcesCard /></div>;
}
