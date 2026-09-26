"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Brain, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ACADEMIC_REMEDIATION_METHODS,
  recommendedRemediation,
  remediationMethod,
  remediationSupport,
} from "@/modules/academic-workspace/remediation";
import type {
  AcademicQuizQuestion,
  AcademicRemediationRecord,
  RemediationMethodId,
} from "@/modules/academic-workspace/types";

export function AcademicRemediationHub({
  question,
  remediation,
  onSelect,
  onClose,
}: {
  question: AcademicQuizQuestion;
  remediation: AcademicRemediationRecord;
  onSelect: (methodId: RemediationMethodId) => void;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const recommended = recommendedRemediation(
    question.conceptIds.includes("NETWORK_ENCAPSULATION")
      ? "SYSTEM_RELATIONSHIP_FAILURE"
      : "CONCEPT_CONFUSION",
  );
  const support = remediation.selectedMethod
    ? remediationSupport(remediation.selectedMethod, question)
    : null;
  const selectedRoute = remediation.selectedMethod ? remediationMethod(remediation.selectedMethod).route : undefined;
  const originConcept = question.conceptIds.includes("NETWORK_ENCAPSULATION") ? "ENCAPSULATION_PDU_CONFUSION" : "OSI_LAYER_MISCLASSIFICATION";
  const visualHref = selectedRoute
    ? `${selectedRoute}?originFlow=ACADEMIC_REMEDIATION&originErrorPatternId=${encodeURIComponent(`error:OSI_TCP_IP_REASONING:INCOMPLETE_RESPONSE:${originConcept}`)}&returnTo=${encodeURIComponent(pathname ?? "/")}`
    : null;

  return (
    <Card className="border-cyan-200 bg-cyan-50/50">
      <CardHeader>
        <p className="text-sm font-semibold text-cyan-900">Ce point semble encore fragile.</p>
        <CardTitle className="text-xl">Comment veux-tu le retravailler ?</CardTitle>
        <p className="text-sm text-slate-600">La remédiation aide à apprendre, mais reste une preuve guidée plafonnée à Pratiquée.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        {!remediation.selectedMethod ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {ACADEMIC_REMEDIATION_METHODS.map((item) => (
                <Button key={item.id} variant="outline" className="h-auto justify-between py-3 text-left" onClick={() => onSelect(item.id)}>
                  <span>{item.label}</span>
                  {recommended.includes(item.id) && <Badge>Recommandé</Badge>}
                </Button>
              ))}
            </div>
            <p className="text-xs text-slate-500">Tu gardes le choix : la recommandation dépend du type d’erreur, pas d’un style d’apprentissage imposé.</p>
          </>
        ) : support ? (
          <div className="space-y-4">
            <Badge variant="outline">{ACADEMIC_REMEDIATION_METHODS.find((item) => item.id === remediation.selectedMethod)?.label}</Badge>
            <div className="rounded-xl bg-white p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><BookOpen className="size-4 text-emerald-700" />Faits issus de la source</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">{support.sourceFacts.map((fact) => <li key={fact}>• {fact}</li>)}</ul>
              <p className="mt-3 text-xs text-slate-500">Source : {support.sourceId} · section {support.sectionId} · pages {support.pageStart}–{support.pageEnd}</p>
            </div>
            <div className="rounded-xl border border-dashed border-cyan-300 bg-white p-4">
              <p className="flex items-center gap-2 text-sm font-semibold"><Brain className="size-4 text-cyan-700" />Méthode pédagogique dérivée</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{support.pedagogicalSupport}</p>
            </div>
            {remediation.selectedMethod === "VISUAL_RECONSTRUCTION" && visualHref && <Button asChild><Link href={visualHref}>Ouvrir la reconstruction visuelle</Link></Button>}
            <Button variant={remediation.selectedMethod === "VISUAL_RECONSTRUCTION" ? "outline" : "default"} onClick={onClose}>Fermer le support et me retester</Button>
          </div>
        ) : null}
        <p className="flex gap-2 text-xs text-slate-600"><ShieldCheck className="size-4 shrink-0 text-emerald-700" />Le support sera fermé avant la nouvelle variante de rappel.</p>
      </CardContent>
    </Card>
  );
}
