"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, FileText, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { academicWorkspaceRegistry, networkingPdfSectionQuizzes, networkingPdfSections } from "@/modules/academic-workspace/pilot-registry";
import { AcademicQuizCard } from "./AcademicQuizCard";
import { DocumentExtractionComparison } from "./DocumentExtractionComparison";

const manifest = {
  pdfType: "TEXT_PDF",
  pageCount: 42,
  status: "SUCCESS",
  pagesExtracted: "14–20 (7 pages bornées)",
  method: "pdfjs-dist 6.2.108 — local",
  warnings: [
    "La page 17 contient très peu de texte extractible.",
    "Le schéma de la page 20 perd une partie de sa disposition spatiale lors de l’extraction texte.",
    "Aucun OCR n’a été exécuté.",
  ],
} as const;

export function PdfSourceWorkspace() {
  const [index, setIndex] = useState(0);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const section = networkingPdfSections[index];
  const sectionQuiz = networkingPdfSectionQuizzes.find((quiz) => quiz.sourceBundle.sectionIds.includes(section.id));
  const source = academicWorkspaceRegistry.sources.find((item) => item.id === "ACADEMIC-NETWORK-CH01-001")!;
  const concepts = academicWorkspaceRegistry.concepts.filter((concept) => concept.sectionIds.includes(section.id));
  return <div className="space-y-7">
    <header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Source académique locale</p><h1 className="mt-2 text-3xl font-semibold">{source.title}</h1><p className="mt-2 max-w-3xl leading-7 text-slate-600">Le document original reste privé et canonique. L’OS expose uniquement une représentation dérivée, bornée et traçable.</p></header>
    <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-emerald-700" />Détail PDF</CardTitle></CardHeader><CardContent className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-2"><Badge>PDF</Badge><Badge>ACADEMIC_PERSONAL_USE</Badge><Badge variant="outline">Original source</Badge></div>
        <p><strong>Type :</strong> {manifest.pdfType}</p><p><strong>Extraction :</strong> {manifest.status}</p><p><strong>Pages du PDF :</strong> {manifest.pageCount}</p><p><strong>Pages ingérées :</strong> {manifest.pagesExtracted}</p><p><strong>Méthode :</strong> {manifest.method}</p>
        <Button variant="outline" onClick={() => setReferenceOpen((value) => !value)}><BookOpen />{referenceOpen ? "Masquer" : "Ouvrir"} la référence source</Button>
        {referenceOpen && <div className="rounded-xl bg-slate-50 p-3"><p className="break-words">{source.originalPathOrReference}</p><p className="mt-2 text-xs text-slate-500">Ouvre ce chemin dans l’explorateur local; le binaire n’est pas servi par l’application.</p></div>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Limites visibles</CardTitle></CardHeader><CardContent><ul className="space-y-3 text-sm text-amber-900">{manifest.warnings.map((warning) => <li className="flex gap-2" key={warning}><ShieldAlert className="mt-0.5 size-4 shrink-0" />{warning}</li>)}</ul></CardContent></Card>
    </div>

    <DocumentExtractionComparison />

    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Section {index + 1}/{networkingPdfSections.length}</p><CardTitle className="mt-2">{section.title}</CardTitle></div><Badge variant="outline">Pages {section.sourceReference.match(/pages? (.+)$/i)?.[1]}</Badge></div></CardHeader><CardContent className="space-y-5">
      <ul className="space-y-3 text-sm leading-6 text-slate-700">{section.summary.map((item) => <li className="flex gap-2" key={item}><ShieldCheck className="mt-1 size-4 shrink-0 text-emerald-700" />{item}</li>)}</ul>
      <div><p className="text-sm font-semibold">Concepts reliés</p><div className="mt-2 flex flex-wrap gap-2">{concepts.map((concept) => <Badge key={concept.id} variant="outline">{concept.label}</Badge>)}</div></div>
      <p className="rounded-xl bg-slate-50 p-3 text-sm"><strong>Provenance :</strong> {section.sourceReference}</p>
      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}><ArrowLeft />Section précédente</Button><Button variant="outline" disabled={index === networkingPdfSections.length - 1} onClick={() => setIndex((value) => value + 1)}>Section suivante <ArrowRight /></Button>{sectionQuiz && sectionQuiz.sectionCoverage !== "INSUFFICIENT" ? <Button asChild><a href="#pdf-quiz">Quiz cette section</a></Button> : <Button disabled>Quiz indisponible</Button>}<Badge variant="outline">Couverture : {sectionQuiz?.sectionCoverage ?? "INSUFFICIENT"}</Badge><Button variant="outline" asChild><Link href="/notebooklm"><Sparkles />Support NotebookLM contrôlé</Link></Button><Button variant="outline" disabled>Deep Mastery — futur</Button><Button variant="outline" disabled>Ajouter à Review après une erreur réelle</Button></div>
      {(!sectionQuiz || sectionQuiz.sectionCoverage === "INSUFFICIENT") && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Cette section ne contient pas encore assez de contenu vérifié pour créer un quiz fiable.</p>}
      <p className="text-xs text-slate-500">Aucune révision n’est créée artificiellement : Review reste alimenté par les erreurs observées dans le quiz.</p>
    </CardContent></Card>

    {sectionQuiz && sectionQuiz.sectionCoverage !== "INSUFFICIENT" && <AcademicQuizCard key={sectionQuiz.id} definition={sectionQuiz} sourceTitle={source.title} />}
    <div className="flex flex-wrap gap-3"><Button variant="outline" asChild><Link href="/subjects/networking">Retour à Réseaux</Link></Button><Button variant="outline" asChild><Link href="/subjects">Toutes les matières</Link></Button><Button variant="outline" asChild><Link href="/progress">Progression</Link></Button></div>
  </div>;
}
