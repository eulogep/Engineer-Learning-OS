"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bot, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SNAPSHOT_FILE, chooseFolder, downloadSnapshot, folderSyncSupported, forgetFolder, readAgentPractice, savedFolder, syncSnapshot } from "@/modules/learner-snapshot/browser-bridge";
import type { AgentPractice } from "@/modules/learner-snapshot/agent-practice";

type Folder = Awaited<ReturnType<typeof savedFolder>>;
const noSubscription = () => () => {};

/** Lets the learner share a minimal, read-only progress snapshot with a local agent (e.g. Hermes). */
export function AgentBridgePanel() {
  const [folder, setFolder] = useState<Folder>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [practice, setPractice] = useState<AgentPractice | null>(null);
  // Server render cannot know the browser API: decide on the client only (no hydration mismatch).
  const supported = useSyncExternalStore(noSubscription, folderSyncSupported, () => false);

  useEffect(() => { savedFolder().then(setFolder).catch(() => {}); }, []);
  useEffect(() => {
    if (!folder) return;
    let alive = true;
    void readAgentPractice(folder).then((value) => { if (alive) setPractice(value); });
    return () => { alive = false; };
  }, [folder, status]);

  async function run(action: () => Promise<string>) {
    try { setStatus(await action()); } catch (error) { setStatus(error instanceof Error && error.name === "AbortError" ? "Choix annulé." : "Opération impossible."); }
  }

  const describe = (result: string) => result === "written" ? `${SNAPSHOT_FILE} mis à jour.` : result === "unchanged" ? "Déjà à jour." : "Autorisation nécessaire : clique sur « Synchroniser maintenant ».";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bot className="size-5 text-emerald-700" aria-hidden="true" />Agent local (Hermes)</CardTitle>
        <CardDescription>
          Partage avec ton agent un résumé en lecture seule : mots et cartes à réviser, difficultés, examens à venir, série de jours.
          Jamais tes phrases, transcriptions, notes, réponses ni passages de cours. L’agent peut l’envoyer à son fournisseur de modèle.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {supported ? (
          folder ? (
            <>
              <p>Dossier : <b>{folder.name}</b> · fichier <code>{SNAPSHOT_FILE}</code>, mis à jour automatiquement tant que l’application est ouverte.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" onClick={() => run(async () => describe(await syncSnapshot(folder, { force: true, request: true })))}>Synchroniser maintenant</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => run(async () => { await forgetFolder(); setFolder(null); return "Dossier oublié : plus aucune écriture."; })}>Arrêter le partage</Button>
              </div>
            </>
          ) : (
            <Button type="button" size="sm" onClick={() => run(async () => { const handle = await chooseFolder(); setFolder(handle); return describe(await syncSnapshot(handle, { force: true, request: true })); })}>
              <FolderOpen className="mr-1.5 size-4" aria-hidden="true" />Choisir le dossier partagé avec l’agent
            </Button>
          )
        ) : <p className="text-slate-600">Ce navigateur ne permet pas d’écrire dans un dossier : utilise le téléchargement ci-dessous (ou Chrome).</p>}
        <Button type="button" size="sm" variant="ghost" onClick={() => run(async () => { await downloadSnapshot(); return `${SNAPSHOT_FILE} téléchargé.`; })}>Télécharger {SNAPSHOT_FILE}</Button>
        {status && <p role="status" className="text-xs text-emerald-800">{status}</p>}
        {practice && practice.chapters.length > 0 && (
          <section aria-label="Entraînement avec l’agent" className="space-y-2 border-t pt-3">
            <p className="font-medium">Entraînement avec l’agent</p>
            <p className="text-xs text-slate-600">QCM tirés de tes cours et faits avec Hermes. C’est de l’entraînement assisté : il ne change aucun niveau de maîtrise.</p>
            <ul className="space-y-1">
              {practice.chapters.map((chapter) => (
                <li key={chapter.chapterId} className="flex flex-wrap justify-between gap-2 text-xs">
                  <span>{chapter.title}{chapter.subject ? <span className="text-slate-500"> · {chapter.subject}</span> : null}</span>
                  <span>{chapter.correct}/{chapter.answered} justes{chapter.toRetry > 0 ? ` · ${chapter.toRetry} à revoir` : ""}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
