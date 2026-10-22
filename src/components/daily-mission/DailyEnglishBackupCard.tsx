"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, CheckCircle2, Download, Languages, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BackupError, backupFilename, createBackup, importBackup } from "@/modules/daily-english/backup";
import type { KeyValueStorage } from "@/modules/daily-english/local-mission";

function storage(): KeyValueStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const count = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

/** Saves / restores the browser-only Daily English progress as a file kept by the learner. */
export function DailyEnglishBackupCard() {
  const input = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function download() {
    setError(null);
    const now = new Date();
    const blob = new Blob([JSON.stringify(createBackup(storage(), now), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = backupFilename(now); anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setMessage("Sauvegarde téléchargée. Gardez ce fichier : il contient vos phrases personnelles.");
  }

  async function restore(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMessage(null); setError(null);
    try {
      const summary = importBackup(storage(), await file.text());
      setMessage(`Progression fusionnée : ${count(summary.missions, "mission", "missions")} (${count(summary.completed, "terminée", "terminées")}), ${count(summary.wordsScheduled, "mot planifié", "mots planifiés")}. Rien n’a été écrasé.`);
    } catch (cause) {
      setError(cause instanceof BackupError ? cause.message : "Import impossible.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Languages className="size-5 text-emerald-700" aria-hidden="true" />Daily English (mode local)</CardTitle>
        <CardDescription>
          Planning de révision des mots, missions et phrases, stockés uniquement dans ce navigateur. Sauvegardez-les pour changer d’appareil ou de navigateur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Button onClick={download}><Download aria-hidden="true" />Exporter ma progression</Button>
          <Button variant="outline" onClick={() => input.current?.click()}><Upload aria-hidden="true" />Importer une sauvegarde</Button>
          <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void restore(event)} aria-label="Fichier de sauvegarde Daily English" />
        </div>
        <p className="text-xs text-slate-500">L’import fusionne avec la progression actuelle : chaque mot garde sa révision la plus récente.</p>
        {message && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 /><AlertTitle>Terminé</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
        {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Import refusé</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
      </CardContent>
    </Card>
  );
}
