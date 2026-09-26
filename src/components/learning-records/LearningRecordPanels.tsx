"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Circle, FileCheck2, Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLearningRecordStore } from "@/modules/learning-records/browser-store";
import {
  COMPETENCY_LABELS,
  COMPETENCY_SEMANTICS,
  type CompetencyId,
  type CompetencyRecord,
  type EvidenceRecord,
} from "@/modules/learning-records/types";

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(timestamp));
}

function uniqueAcademicPageReferences(record: EvidenceRecord) {
  return Array.from(
    new Map(
      (record.evaluationResult.academicPageReferences ?? []).map((reference) => [
        `${reference.sourceId}:${reference.pageStart}:${reference.pageEnd}`,
        reference,
      ]),
    ).values(),
  );
}

function EvidenceCard({ record }: { record: EvidenceRecord }) {
  const [open, setOpen] = useState(false);
  const viewed = useLearningRecordStore((state) => state.recordEvidenceViewed);
  const isTechnicalEnglish = record.evidenceType === "AUDIO_RESPONSE" || record.evidenceType === "TEXT_RESPONSE";
  const isDeepMastery = record.evidenceType === "DEEP_MASTERY_SESSION";
  const isProfessionalScenario = record.evidenceType === "PROFESSIONAL_SCENARIO";
  const isAcademicQuiz = record.evidenceType === "ACADEMIC_QUIZ";
  const isVisualPractice = record.evidenceType === "GUIDED_VISUAL_PRACTICE";
  const deepMasteryCompleted = isDeepMastery && record.evaluationResult.missionCompletion === "VALID";
  const professionalCompleted = isProfessionalScenario && record.evaluationResult.missionCompletion === "VALID";
  const academicCompleted = isAcademicQuiz && record.evaluationResult.missionCompletion === "VALID";
  const visualCompleted = isVisualPractice && record.evaluationResult.missionCompletion === "VALID";
  const completed = record.evidenceType === "MISSION_COMPLETION" || deepMasteryCompleted || professionalCompleted || academicCompleted || visualCompleted;
  const reviewResult = record.evidenceType === "REVIEW_RESULT";
  const reviewCorrect = record.evaluationResult.outcome === "REVIEW_SUCCESS";
  const transcriptAvailable = record.evaluationResult.transcriptionStatus === "MANUAL_AVAILABLE";
  const feedbackAvailable = record.evaluationResult.feedbackStatus === "AVAILABLE";
  const languageStatus = record.evaluationResult.languageStatus ?? "UNKNOWN";
  const contentStatus = record.evaluationResult.contentStatus ?? "UNKNOWN";
  const competencyEvidenceStatus = record.evaluationResult.competencyEvidenceStatus ?? "UNEVALUATED";
  const technicalAccepted = competencyEvidenceStatus === "VALID";

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) viewed(record.id);
  }

  const eyebrow = isVisualPractice
    ? "Pratique visuelle — OSI / TCP-IP"
    : isAcademicQuiz
    ? "Quiz académique — Réseaux"
    : isProfessionalScenario
    ? "Scénario professionnel — Anomalie industrielle"
    : isDeepMastery
    ? "Maîtrise profonde — Diagnostic CSV"
    : isTechnicalEnglish
    ? "Technical English"
    : reviewResult ? "Révision Excel — Import CSV" : "Excel CSV Foundations — Niveau 1";
  const title = isVisualPractice
    ? visualCompleted ? "Reconstruction visuelle terminée" : "Reconstruction visuelle en cours"
    : isAcademicQuiz
    ? academicCompleted ? "Quiz réseau terminé" : "Quiz réseau commencé"
    : isProfessionalScenario
    ? professionalCompleted ? "Situation professionnelle traitée" : "Situation professionnelle commencée"
    : isDeepMastery
    ? deepMasteryCompleted ? "Session de maîtrise terminée" : "Session de maîtrise commencée"
    : isTechnicalEnglish
    ? "Explication du diagnostic CSV"
    : reviewResult ? "Révision terminée" : completed ? "Mission terminée" : "Tentative en cours";
  const badge = isVisualPractice
    ? visualCompleted ? "Pratique visuelle guidée validée" : "Reconstruction à terminer"
    : isAcademicQuiz
    ? academicCompleted ? "Pratique académique validée" : "Quiz en cours"
    : isProfessionalScenario
    ? professionalCompleted ? "Pratique professionnelle validée" : "Analyse en cours"
    : isDeepMastery
    ? record.evaluationResult.outcome === "SUCCESSFUL_TRANSFER" ? "Transfert autonome validé" : deepMasteryCompleted ? "Pratique guidée validée" : "Session commencée"
    : isTechnicalEnglish
    ? record.evidenceType === "AUDIO_RESPONSE" ? "Audio enregistré" : "Réponse écrite"
    : reviewResult ? reviewCorrect ? "Réponse correcte" : "À renforcer"
    : completed ? "Preuve guidée valide" : "Mission commencée";

  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">{eyebrow}</p>
          <CardTitle className="mt-2 text-xl">{title}</CardTitle>
          <p className="mt-1 text-sm text-slate-500">{dateLabel(record.createdAt)}</p>
        </div>
        <Badge variant={completed || reviewCorrect || (isTechnicalEnglish && technicalAccepted) ? "default" : "outline"}>{badge}</Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-sm font-semibold">Compétence</p>
          <p className="mt-1 text-sm text-slate-600">{isVisualPractice ? "Raisonnement OSI et correspondance TCP/IP" : isAcademicQuiz ? "Fondamentaux réseau et raisonnement OSI/TCP-IP" : isProfessionalScenario ? "Analyse et communication professionnelles" : isTechnicalEnglish ? "Explication technique en anglais" : "Import CSV dans Excel"}</p>
        </div>

        {isVisualPractice ? (
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />Résultat : {record.evaluationResult.visualFinalResult === "CORRECT" ? "reconstruction correcte" : "à terminer"}</li>
            <li className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-cyan-700" />Difficulté initiale — ordre : {record.evaluationResult.visualOrderErrors?.length ?? 0} signal(s) · correspondance : {record.evaluationResult.visualClassificationErrors?.length ?? 0} signal(s)</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" />Preuve guidée plafonnée à Pratiquée; aucune promotion autonome.</li>
            {uniqueAcademicPageReferences(record).map((reference) => <li key={`${reference.sourceId}:${reference.pageStart}:${reference.pageEnd}`} className="flex gap-2"><BookOpen className="mt-0.5 size-4 shrink-0 text-cyan-700" />{reference.sourceId} — page {reference.pageStart}</li>)}
            {record.evaluationResult.visualOriginFlow && <li className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-cyan-700" />Remédiation : {record.evaluationResult.visualRemediationMethod?.replaceAll("_", " ").toLocaleLowerCase("fr-FR")} · origine conservée</li>}
            <li><Button variant="outline" size="sm" asChild><Link href="/learn/visual-lab">Revoir la reconstruction</Link></Button></li>
          </ul>
        ) : isAcademicQuiz ? (
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />Quiz relié à {record.evaluationResult.academicSourceIds?.length ?? 0} source(s), {record.evaluationResult.academicSectionIds?.length ?? 0} section(s) et {record.evaluationResult.academicConceptIds?.length ?? 0} concept(s).</li>
            {uniqueAcademicPageReferences(record).map((reference) => <li key={`${reference.sourceId}:${reference.pageStart}:${reference.pageEnd}`} className="flex gap-2"><BookOpen className="mt-0.5 size-4 shrink-0 text-cyan-700" />{reference.sourceId} — pages {reference.pageStart}–{reference.pageEnd}</li>)}
            {record.evaluationResult.academicRemediations?.filter((remediation) => remediation.selectedMethod).map((remediation) => <li key={`remediation:${remediation.questionId}`} className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-cyan-700" />Remédiation guidée : {remediation.selectedMethod?.replaceAll("_", " ").toLocaleLowerCase("fr-FR")} · résultat après support : {remediation.postRemediationResult === "SUCCESS" ? "réussi" : remediation.postRemediationResult === "FAILURE" ? "à renforcer" : "en attente"}</li>)}
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" />Provenance déterministe vérifiée; état plafonné à Pratiquée.</li>
            <li><Button variant="outline" size="sm" asChild><Link href={record.evaluationResult.academicSourceIds?.includes("ACADEMIC-NETWORK-CH01-001") ? "/subjects/networking/sources/ch01-introduction-inf3050" : "/subjects/networking"}>Retourner au cours source</Link></Button></li>
          </ul>
        ) : isProfessionalScenario ? (
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />Données du cas classées TRAINING_SYNTHETIC</li>
            {Object.entries(record.evaluationResult.professionalDimensions ?? {}).map(([dimension, status]) => <li key={dimension} className="flex gap-2">{status === "VALID" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />}<span>{dimension.replaceAll("_", " ")} : {status === "VALID" ? "validé" : status?.toLowerCase()}</span></li>)}
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />{professionalCompleted ? "État plafonné à Pratiquée pour ce scénario guidé" : "Aucune promotion avant une réalisation complète"}</li>
            <li className="flex gap-2"><Info className="mt-0.5 size-4 shrink-0 text-cyan-700" aria-hidden="true" /><span>Aide de rédaction déclarée : {record.evaluationResult.assistanceMode === "NONE" ? "aucune" : record.evaluationResult.assistanceMode === "IN_APP_SCAFFOLD" ? "canevas intégré" : record.evaluationResult.assistanceMode === "EXTERNAL_AI" ? "IA externe" : "autre ou non déclarée"}</span></li>
            {record.evaluationResult.professionalWritingEvidence === "INDEPENDENT" && <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />Rédaction indépendante enregistrée. Le scénario reste plafonné à Pratiquée.</li>}
            {record.evaluationResult.professionalWritingEvidence === "GUIDED" && <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-700" aria-hidden="true" />Rédaction guidée enregistrée : elle soutient Pratiquée, pas Démontrée.</li>}
            {record.evaluationResult.professionalWritingEvidence === "NOT_AUTONOMOUS_EXTERNAL_AI" && <li className="flex gap-2 text-amber-800"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Le texte est conservé, mais ne valide pas une rédaction professionnelle autonome.</li>}
          </ul>
        ) : isDeepMastery ? (
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2">{record.evaluationResult.feynmanExplanation === "VALID" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden="true" />}Explication avec ses propres mots {record.evaluationResult.feynmanExplanation === "VALID" ? "validée" : "à compléter"}</li>
            <li className="flex gap-2">{record.evaluationResult.heldOutTransfer === "VALID" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden="true" />}Cas nouveau {record.evaluationResult.heldOutTransfer === "VALID" ? "réussi" : "non validé"}</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />{record.evaluationResult.outcome === "SUCCESSFUL_TRANSFER" ? "Démontrée grâce à un transfert avec aide limitée" : deepMasteryCompleted ? "Pratiquée dans un parcours guidé" : "Aucune promotion avant une preuve suffisante"}</li>
          </ul>
        ) : isTechnicalEnglish ? (
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />{record.evidenceType === "AUDIO_RESPONSE" ? "Audio enregistré localement" : "Réponse écrite enregistrée localement"}</li>
            <li className="flex gap-2">{transcriptAvailable ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden="true" />}{transcriptAvailable ? "Transcription manuelle disponible" : "Aucune transcription : contenu non évalué automatiquement"}</li>
            <li className="flex gap-2">{languageStatus === "TARGET_LANGUAGE_CONFIRMED" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />}{languageStatus === "TARGET_LANGUAGE_CONFIRMED" ? "Langue cible : anglais confirmé par des signaux textuels" : languageStatus === "TARGET_LANGUAGE_NOT_CONFIRMED" ? "Langue cible : anglais non confirmé" : "Langue cible non évaluée avec suffisamment de fiabilité"}</li>
            <li className="flex gap-2">{contentStatus === "SUFFICIENT" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />}{contentStatus === "SUFFICIENT" ? "Contenu technique suffisant pour l’objectif" : contentStatus === "PARTIAL" ? "Contenu technique partiel : explication à renforcer" : contentStatus === "INSUFFICIENT" ? "Contenu insuffisant pour valider l’objectif" : "Contenu technique non évalué — aucune transcription disponible"}</li>
            <li className="flex gap-2">{technicalAccepted ? <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Info className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden="true" />}{technicalAccepted ? "Cette preuve valide une pratique guidée de l’explication technique en anglais." : "Cette tentative est conservée, mais ne valide pas encore « Explication technique en anglais »."}</li>
            <li className="flex gap-2">{feedbackAvailable ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden="true" />}{feedbackAvailable ? "Feedback déterministe disponible" : "Aucun feedback linguistique simulé"}</li>
          </ul>
        ) : reviewResult ? (
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />Tentative de récupération active enregistrée</li>
            <li className="flex gap-2">{reviewCorrect ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />}{reviewCorrect ? "Réponse déterministe correcte" : "Notion planifiée à revoir bientôt"}</li>
            <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />Reliée aux preuves de la mission d’origine</li>
          </ul>
        ) : (
          <ul className="space-y-2 text-sm text-slate-700">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />{completed ? "Mission terminée" : "Mission démarrée"}</li>
            <li className="flex gap-2">{record.evaluationResult.anomalyIdentification === "VALID" ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden="true" />}Anomalie correctement identifiée</li>
            <li className="flex gap-2">{record.artifactReference ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" /> : <Circle className="mt-0.5 size-4 shrink-0 text-slate-300" aria-hidden="true" />}Artefact local enregistré</li>
            {record.artifactReference && <li className="flex gap-2 text-amber-800"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Contenu de l’artefact non vérifié indépendamment</li>}
          </ul>
        )}

        <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm">
          <span className="font-semibold">Aide :</span> {record.assistance.hintCount} indice(s), {record.assistance.retryCount} nouvelle(s) tentative(s)
          {record.selfEvaluation !== null ? ` · confiance déclarée ${record.selfEvaluation}/5` : ""}
        </div>
        <Button variant="outline" onClick={toggle}>{open ? "Masquer les détails" : "Voir la preuve"}</Button>
        {open && (
          <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-600">
            {isVisualPractice ? (
              <>
                <p><strong>Essais :</strong> {record.evaluationResult.visualAttempts ?? 0}</p>
                <p className="mt-2"><strong>Provenance :</strong> {record.evaluationResult.academicSourceIds?.join(", ")} · section {record.evaluationResult.academicSectionIds?.join(", ")} · page 17</p>
              </>
            ) : isTechnicalEnglish ? (
              <>
                <p><strong>Stockage :</strong> local sur cet appareil</p>
                {record.artifactReference?.durationMs !== undefined && <p className="mt-2"><strong>Durée audio :</strong> {Math.max(1, Math.round(record.artifactReference.durationMs / 1000))} seconde(s)</p>}
              </>
            ) : reviewResult ? (
              <p><strong>Sources liées :</strong> {record.relatedEvidenceIds?.length ?? 0} preuve(s) d’origine</p>
            ) : (
              <p><strong>Référence locale :</strong> {record.artifactReference?.displayName ?? "Aucun artefact"}</p>
            )}
            {isTechnicalEnglish
              ? <p className="mt-2"><strong>Preuve de compétence :</strong> {technicalAccepted ? "valide" : competencyEvidenceStatus === "PARTIAL" ? "partielle" : competencyEvidenceStatus === "INVALID" ? "non valide" : "non évaluée"}</p>
              : <p className="mt-2"><strong>Vérification déterministe :</strong> {record.verificationStatus === "VALID" ? "valide" : record.verificationStatus.toLowerCase()}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EvidenceWorkspace() {
  const { hydrated, evidence } = useLearningRecordStore();
  if (!hydrated) return <p className="text-sm text-slate-500">Chargement des preuves locales…</p>;
  if (evidence.length === 0) {
    return <Card><CardContent className="grid min-h-64 place-items-center p-8 text-center"><div><FileCheck2 className="mx-auto size-10 text-slate-400" /><h1 className="mt-4 text-2xl font-semibold">Aucune preuve pour le moment</h1><p className="mt-2 text-slate-600">Une preuve apparaîtra après le démarrage d’une mission.</p><Button asChild className="mt-5"><Link href="/learn">Voir mes missions</Link></Button></div></CardContent></Card>;
  }
  return <div className="space-y-6"><header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Tes preuves locales</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Ce que tu as réellement produit</h1><p className="mt-2 text-slate-600">Chaque affirmation reste reliée à une tentative enregistrée sur cet appareil.</p></header><div className="grid gap-5">{[...evidence].reverse().map((record) => <EvidenceCard key={record.id} record={record} />)}</div></div>;
}

const competencyPresentation: Record<CompetencyId, { subject: string; title: string; evidenceLabel: string }> = {
  DAILY_ENGLISH_GUIDED_PRACTICE: { subject: "Anglais quotidien", title: "Pratique guidée quotidienne", evidenceLabel: "Daily English Mission" },
  EXCEL_CSV_IMPORT: { subject: "Excel / Données", title: "Import CSV dans Excel", evidenceLabel: "Mission Excel CSV Foundations" },
  TECHNICAL_ENGLISH_EXPLANATION: { subject: "Anglais professionnel", title: "Explication technique en anglais", evidenceLabel: "Mission Technical English" },
  DATA_ANOMALY_IDENTIFICATION: { subject: "Pratique professionnelle", title: "Identifier une anomalie de données", evidenceLabel: "Scénario professionnel industriel" },
  FACT_VS_ASSUMPTION: { subject: "Pratique professionnelle", title: "Distinguer fait et hypothèse", evidenceLabel: "Scénario professionnel industriel" },
  PROFESSIONAL_STATUS_UPDATE: { subject: "Communication professionnelle", title: "Rédiger un point de situation", evidenceLabel: "Scénario professionnel industriel" },
  ACTIONABLE_NEXT_STEP: { subject: "Décision professionnelle", title: "Proposer une prochaine action", evidenceLabel: "Scénario professionnel industriel" },
  NETWORK_FUNDAMENTALS: { subject: "Réseaux", title: "Fondamentaux des protocoles réseau", evidenceLabel: "Quiz académique réseau" },
  OSI_TCP_IP_REASONING: { subject: "Réseaux", title: "Raisonner avec OSI et TCP/IP", evidenceLabel: "Activité académique réseau" },
};

function CompetencyCard({ competency, supporting }: { competency: Pick<CompetencyRecord, "competencyId" | "status" | "supportingEvidenceIds" | "rationale">; supporting: EvidenceRecord[] }) {
  const [open, setOpen] = useState(false);
  const recordViewed = useLearningRecordStore((state) => state.recordCompetencyExplanationViewed);
  const presentation = competencyPresentation[competency.competencyId];
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) recordViewed(competency.competencyId);
  }
  return <Card className="border-emerald-900/15 bg-white shadow-sm"><CardHeader><p className="text-sm font-medium text-slate-500">{presentation.subject}</p><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-xl">{presentation.title}</CardTitle><Badge>{COMPETENCY_LABELS[competency.status]}</Badge></div></CardHeader><CardContent className="space-y-4"><p className="text-sm leading-6 text-slate-600">{competency.rationale}</p><Button variant="outline" onClick={toggle}>Pourquoi ?</Button>{open && <div className="rounded-xl bg-slate-50 p-4"><p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4 text-emerald-700" />Preuves justificatives</p>{supporting.length ? <ul className="mt-3 space-y-2 text-sm text-slate-600">{supporting.map((record) => <li key={record.id}>{presentation.evidenceLabel} — {dateLabel(record.createdAt)}</li>)}</ul> : <p className="mt-2 text-sm text-slate-600">Aucune preuve significative enregistrée.</p>}</div>}</CardContent></Card>;
}

export function ProgressWorkspace() {
  const { hydrated, competencies, evidence } = useLearningRecordStore();
  if (!hydrated) return <p className="text-sm text-slate-500">Chargement de la progression locale…</p>;
  const ids: CompetencyId[] = ["DAILY_ENGLISH_GUIDED_PRACTICE", "EXCEL_CSV_IMPORT", "TECHNICAL_ENGLISH_EXPLANATION", "DATA_ANOMALY_IDENTIFICATION", "FACT_VS_ASSUMPTION", "PROFESSIONAL_STATUS_UPDATE", "ACTIONABLE_NEXT_STEP", "NETWORK_FUNDAMENTALS", "OSI_TCP_IP_REASONING"];
  return <div className="space-y-6"><header><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Ta progression</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Des compétences expliquées par leurs preuves</h1><p className="mt-2 text-slate-600">Aucun pourcentage artificiel : chaque statut vient uniquement de tes activités enregistrées.</p></header><div className="grid gap-5">{ids.map((competencyId) => {
    const competency: Pick<CompetencyRecord, "competencyId" | "status" | "supportingEvidenceIds" | "rationale"> = competencies.find((record) => record.competencyId === competencyId) ?? { competencyId, status: "NOT_SEEN", supportingEvidenceIds: [], rationale: COMPETENCY_SEMANTICS.NOT_SEEN };
    const supporting = evidence.filter((record) => competency.supportingEvidenceIds.includes(record.id));
    return <CompetencyCard key={competencyId} competency={competency} supporting={supporting} />;
  })}</div></div>;
}
