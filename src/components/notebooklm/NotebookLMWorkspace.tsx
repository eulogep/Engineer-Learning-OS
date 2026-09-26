"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookCopy, CheckCircle2, Clipboard, ExternalLink, FileCheck2, ShieldAlert, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { restoreNotebookLMStore, useNotebookLMStore } from "@/modules/notebooklm/browser-store";
import { networkingNotebookLMBundle, notebookLMPilotSources } from "@/modules/notebooklm/pilot-registry";
import type { NotebookLMHydrationState } from "@/modules/notebooklm/local-restore";
import type { NotebookLMTask } from "@/modules/notebooklm/types";
import { NotebookLMQuizActivity } from "./NotebookLMQuizActivity";

const statusLabels: Record<NotebookLMTask["status"], string> = {
  DRAFT: "Brouillon",
  WAITING_FOR_APPROVAL: "Approbation requise",
  READY: "Prête",
  AUTOMATION_RUNNING: "Automatisation en cours",
  AUTOMATION_FAILED: "Automatisation indisponible",
  HUMAN_LOGIN_REQUIRED: "Connexion humaine requise",
  IN_PROGRESS: "Exécution manuelle",
  COMPLETED: "Terminée",
  FAILED: "Échec",
  CANCELLED: "Annulée",
};

const studioFailureCodes = new Set([
  "STUDIO_NOT_FOUND",
  "ARTIFACT_TYPE_NOT_FOUND",
  "GENERATION_START_FAILED",
  "GENERATION_TIMEOUT",
  "ARTIFACT_NOT_IDENTIFIED",
  "RECOVERY_FAILED",
  "DOM_CHANGED",
]);

function automationFailureMessage(code: string | null | undefined) {
  if (code && studioFailureCodes.has(code)) return "NotebookLM a changé d’interface à l’étape Studio. La tâche préparée et son approbation sont conservées.";
  return `Code : ${code ?? "AUTOMATION_FAILED"}. La tâche préparée et son approbation sont conservées. Selon l’étape atteinte, la source autorisée peut déjà être présente dans le notebook dédié.`;
}

function sourceList() {
  return notebookLMPilotSources.map((source) => `${source.title} — ${source.originalPathOrReference ?? source.id} — ${source.classification}`).join("\n");
}

export function NotebookLMWorkspace() {
  const state = useNotebookLMStore();
  const [hydrationState, setHydrationState] = useState<NotebookLMHydrationState>("RESTORING");
  const [restoreFailure, setRestoreFailure] = useState<string | null>(null);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, { title: string; reference: string }>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void restoreNotebookLMStore().then((outcome) => {
      if (!active) return;
      setRestoreFailure(outcome.failureCode);
      setHydrationState(outcome.state);
    });
    return () => { active = false; };
  }, []);

  async function retryRestore() {
    setRestoreFailure(null);
    setHydrationState("RESTORING");
    const outcome = await restoreNotebookLMStore();
    setRestoreFailure(outcome.failureCode);
    setHydrationState(outcome.state);
  }

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
  }

  if (hydrationState === "NOT_STARTED" || hydrationState === "RESTORING") {
    return <p className="text-sm text-slate-500">Restauration des tâches NotebookLM locales…</p>;
  }
  if (hydrationState === "FAILED") {
    return <Card className="border-amber-200 bg-amber-50/70"><CardContent className="space-y-4 p-5 text-sm text-amber-950">
      <div className="flex gap-3"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">Certaines données locales n'ont pas pu être restaurées.</p><p className="mt-1">Code : {restoreFailure ?? "LOCAL_RESTORE_FAILED"}. Aucune donnée n'a été supprimée et aucune automatisation NotebookLM n'a été relancée.</p></div></div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => void retryRestore()}>Réessayer la restauration</Button><Button variant="outline" onClick={() => setHydrationState("READY")}>Continuer sans restaurer</Button></div>
    </CardContent></Card>;
  }
  const tasks = Object.values(state.tasks).filter((task) => task.sourceBundleId === networkingNotebookLMBundle.id);
  const artifacts = Object.values(state.artifacts);

  return <div className="space-y-8">
    {state.restoreWarning && <Card className="border-amber-200 bg-amber-50/70"><CardContent className="flex gap-3 p-4 text-sm text-amber-950"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><p>Certaines données NotebookLM locales obsolètes ou invalides ont été ignorées. Les tâches et artefacts valides restent disponibles.</p></CardContent></Card>}
    <header className="space-y-3">
      <div className="flex items-center gap-2 text-emerald-800"><Sparkles className="size-5" /><span className="text-xs font-semibold uppercase tracking-[0.2em]">Support externe contrôlé</span></div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">NotebookLM, sans perdre la maîtrise des sources</h1>
      <p className="max-w-3xl leading-7 text-slate-600">Engineer Learning OS prépare le bundle, contrôle le manifeste, pilote NotebookLM dans un profil local dédié puis ramène un artefact non vérifié vers une activité active.</p>
    </header>

    <Card className="border-amber-200 bg-amber-50/70"><CardContent className="flex gap-3 p-5 text-sm text-amber-950"><ShieldAlert className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">Automatisation legacy · risque connu accepté</p><p className="mt-1">Patchright, interaction DOM et session Google persistante sont autorisés uniquement dans le profil local dédié. Le manifeste, les classifications et l’approbation restent obligatoires. Le mode manuel et l’apprentissage local restent disponibles en secours.</p></div></CardContent></Card>

    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">SourceBundle</p><h2 className="mt-1 text-2xl font-semibold">{networkingNotebookLMBundle.title}</h2></div><Badge variant="outline">{notebookLMPilotSources.length} source</Badge></div>
      <Card><CardContent className="space-y-4 p-5">
        <p className="text-sm text-slate-600">{networkingNotebookLMBundle.purpose}</p>
        <div className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Classification</p><p className="font-semibold">{networkingNotebookLMBundle.classification}</p></div><div><p className="text-xs text-slate-500">Copyright</p><p className="font-semibold">{networkingNotebookLMBundle.copyrightStatus}</p></div><div><p className="text-xs text-slate-500">Usage externe</p><p className="font-semibold">Approbation explicite</p></div></div>
        <ul className="space-y-2">{notebookLMPilotSources.map((source) => <li key={source.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold">{source.title}</p><p className="mt-1 break-words text-slate-600">{source.originalPathOrReference}</p><p className="mt-1 text-xs text-slate-500">{source.classification} · copyright {source.copyrightStatus}</p></li>)}</ul>
        <p className="flex gap-2 text-xs text-slate-600"><ShieldCheck className="size-4 shrink-0 text-emerald-700" />Seules ces références sont autorisées. Le copyright inconnu n’est pas présenté comme une permission de redistribution.</p>
      </CardContent></Card>
    </section>

    <section className="space-y-4"><h2 className="text-2xl font-semibold">Tâches préparées</h2><div className="grid gap-5 xl:grid-cols-2">{tasks.map((task) => {
      const draft = drafts[task.id] ?? { title: "", reference: "" };
      return <Card key={task.id} className="border-emerald-900/15"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge>{task.taskType}</Badge><CardTitle className="mt-3">{task.purpose}</CardTitle></div><Badge variant="outline">{statusLabels[task.status]}</Badge></div></CardHeader><CardContent className="space-y-5">
        <dl className="grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Mode</dt><dd className="font-semibold">Legacy contrôlé · manuel en secours</dd></div><div><dt className="text-slate-500">Autorisation</dt><dd className="font-semibold">{task.authorizationStatus}</dd></div></dl>
        {task.status === "WAITING_FOR_APPROVAL" && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">These sources will be sent to NotebookLM</p><p>{notebookLMPilotSources.map((source) => source.title).join(", ")} · {networkingNotebookLMBundle.classification} · copyright {networkingNotebookLMBundle.copyrightStatus} · {notebookLMPilotSources.length} source</p><p><strong>Action :</strong> {task.taskType} · <strong>Mode :</strong> LEGACY_CONTROLLED</p><div className="rounded-lg bg-white/70 p-3"><p className="font-semibold">Prompt complet · {task.promptTemplateId}</p><p className="mt-2 whitespace-pre-wrap text-slate-700">{task.preparedPrompt}</p></div><label className="flex items-start gap-2"><input className="mt-1" type="checkbox" checked={Boolean(consents[task.id])} onChange={(event) => setConsents((values) => ({ ...values, [task.id]: event.target.checked }))} /><span>J’approuve cette transmission externe précise et son exécution mécanique. Je comprends qu’aucun droit de redistribution n’est établi.</span></label><Button disabled={!consents[task.id]} onClick={() => state.approve(task.id, true)}><ShieldCheck />Approuver cette tâche</Button></div>}
        {(task.status === "READY" || task.status === "IN_PROGRESS") && <div className="space-y-3"><div className="rounded-xl bg-slate-50 p-4 text-sm leading-6"><p className="font-semibold">Prompt · {task.promptTemplateId}</p><p className="mt-2 whitespace-pre-wrap text-slate-700">{task.preparedPrompt}</p></div><div className="flex flex-wrap gap-2">{task.status === "READY" && <><Button onClick={() => void state.requestAutomation(task.id)}><Sparkles />Générer avec NotebookLM</Button><Button variant="outline" onClick={() => state.beginManual(task.id)}>Faire manuellement <ArrowRight /></Button></>}<Button variant="ghost" onClick={() => void copy(task.preparedPrompt, `${task.id}:prompt`)}><Clipboard />{copied === `${task.id}:prompt` ? "Prompt copié" : "Copier le prompt"}</Button><Button variant="ghost" onClick={() => void copy(sourceList(), `${task.id}:sources`)}><BookCopy />{copied === `${task.id}:sources` ? "Sources copiées" : "Copier les sources"}</Button></div></div>}
        {task.status === "AUTOMATION_RUNNING" && <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm"><p className="font-semibold">Progression contrôlée</p><div className="grid gap-2 sm:grid-cols-3"><span>✓ Préparation</span><span>Notebook</span><span>Sources</span><span>Génération</span><span>Récupération</span><span>Prêt</span></div><p>Aucune actualisation ne relance automatiquement ce plan.</p></div>}
        {task.status === "AUTOMATION_FAILED" && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">Automatisation arrêtée proprement</p><p>{automationFailureMessage(task.automationFailure)}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => state.prepareAutomationRetry(task.id)}>Réessayer explicitement</Button><Button onClick={() => state.beginManual(task.id)}>Continuer manuellement <ArrowRight /></Button></div></div>}
        {task.status === "HUMAN_LOGIN_REQUIRED" && <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-semibold">Connexion humaine requise</p><p>Termine la connexion Google dans la fenêtre du profil dédié. Aucun CAPTCHA ni MFA n’est contourné. La reprise conserve la même tâche, le même manifeste et l’approbation existante.</p><div className="flex gap-2"><Button variant="outline" onClick={() => void state.resumeAutomation(task.id)}>Reprendre après connexion</Button><Button onClick={() => state.beginManual(task.id)}>Continuer manuellement</Button></div></div>}
        {task.status === "IN_PROGRESS" && <div className="space-y-4 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4 text-sm"><ol className="list-decimal space-y-1 pl-5"><li>Ouvre NotebookLM toi-même.</li><li>Crée un notebook et ajoute uniquement la source affichée.</li><li>Colle le prompt préparé.</li><li>Reviens ici sans importer le contenu généré.</li></ol><Button variant="outline" asChild><a href="https://notebooklm.google.com/" target="_blank" rel="noreferrer">Ouvrir NotebookLM manuellement <ExternalLink /></a></Button><div className="grid gap-3"><label><span className="mb-1 block font-semibold">Titre de l’artefact obtenu</span><Input value={draft.title} onChange={(event) => setDrafts((values) => ({ ...values, [task.id]: { ...draft, title: event.target.value } }))} /></label><label><span className="mb-1 block font-semibold">Référence facultative, sans contenu ni secret</span><Input value={draft.reference} onChange={(event) => setDrafts((values) => ({ ...values, [task.id]: { ...draft, reference: event.target.value } }))} placeholder="Nom du notebook ou note locale" /></label><Button disabled={!draft.title.trim()} onClick={() => state.registerArtifact(task.id, draft.title, draft.reference)}><FileCheck2 />Enregistrer seulement les métadonnées</Button></div></div>}
        {task.status === "COMPLETED" && <div className="space-y-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950"><p className="flex gap-2 font-semibold"><CheckCircle2 className="size-5" />Artefact déclaré comme DÉRIVÉ · NON VÉRIFIÉ</p><p>Il ne constitue ni une preuve, ni une évaluation, ni une promotion de compétence.</p><div className="flex flex-wrap gap-2"><Button asChild><Link href={task.activeFollowup.href}>{task.activeFollowup.label} <ArrowRight /></Link></Button><Button variant="outline" onClick={() => state.prepareAutomationRetry(task.id)}>Générer de nouveau explicitement</Button></div></div>}
      </CardContent></Card>;
    })}</div></section>

    <section className="space-y-4"><h2 className="text-2xl font-semibold">Artefacts dérivés</h2>{artifacts.length === 0 ? <p className="rounded-xl border border-dashed p-5 text-sm text-slate-600">Aucun artefact récupéré ou déclaré.</p> : <div className="grid gap-4">{artifacts.map((artifact) => <Card key={artifact.id} className="border-cyan-200 bg-cyan-50/40"><CardContent className="space-y-2 p-5"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">DÉRIVÉ</Badge><Badge variant="outline">NON VÉRIFIÉ</Badge><Badge variant="outline">{artifact.recoveryMode ?? "METADATA_ONLY"}</Badge></div><p className="font-semibold">{artifact.title}</p><p className="text-sm text-slate-600">Artefact → tâche {tasks.find((task) => task.artifactIds.includes(artifact.id))?.id} → bundle {artifact.sourceBundleId} → {artifact.sourceIds.join(", ")}</p>{artifact.recoveredContent && <details className="rounded-lg border bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold">Aperçu récupéré · non vérifié</summary><p className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-slate-700">{artifact.recoveredContent}</p></details>}{artifact.type === "QUIZ" && <NotebookLMQuizActivity artifact={artifact} />}</CardContent></Card>)}</div>}</section>

    <Card><CardContent className="space-y-3 p-5"><p className="font-semibold">Frontières des fournisseurs</p><p className="text-sm text-slate-600">Le fournisseur legacy reste subordonné au Guard. Seuls les fichiers du manifeste approuvé sont accessibles. Cookies et profil restent dans <code>.local/notebooklm-session/</code>, hors Git, Evidence et métadonnées d’artefact. La génération ne constitue jamais une preuve et ne promeut aucune compétence.</p><div className="flex flex-wrap gap-3"><Button variant="outline" asChild><Link href="/subjects/networking">Retour à Réseaux</Link></Button><Button variant="outline" asChild><Link href="/review">Review locale</Link></Button></div></CardContent></Card>
  </div>;
}
