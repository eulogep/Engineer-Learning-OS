"use client";

import { useRef, useState, useSyncExternalStore, type ChangeEvent } from "react";
import { AlertCircle, CheckCircle2, DatabaseBackup, Download, HardDrive, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CANONICAL_DATABASE_VERSION,
  CanonicalStorageError,
  IndexedDbCanonicalLearningRepository,
} from "@/modules/learning-history/adapters/indexeddb";
import {
  decodeBrowserRecoveryFile,
  encodeBrowserRecoveryFile,
  MAX_RECOVERY_FILE_BYTES,
  recoveryFilename,
} from "@/modules/learning-history/export/browser-file";
import { RecoveryError } from "@/modules/learning-history/export/export-format";
import { exportCanonicalHistory, importCanonicalHistory } from "@/modules/learning-history/export/recovery";
import { createEventId } from "@/modules/learning-history/ids";
import { canonicalOperationsStatus } from "@/modules/learning-history/operations/browser-status";
import { createOperationalTelemetry } from "@/modules/learning-history/operations/telemetry";
import { localOperationalTelemetry } from "@/modules/learning-history/operations/telemetry-journal";
import { OperationalHistoryPanel } from "@/components/learning-history/OperationalHistoryPanel";
import { RemoteSyncPanel } from "@/components/learning-history/RemoteSyncPanel";

const HEALTH_COPY = {
  INITIALIZING: ["Initialisation", "Le stockage canonique démarre."],
  RECONCILING: ["Mise à jour", "Les données locales sont rapprochées de l’historique canonique."],
  HEALTHY: ["Protégé", "Le navigateur indique que le stockage local est persistant."],
  BEST_EFFORT: ["Stockage standard", "Les données sont locales, mais le navigateur peut les supprimer sous pression d’espace."],
  UNAVAILABLE: ["Indisponible", "Le stockage canonique n’est pas accessible dans ce navigateur."],
  FAILED: ["Échec local", "La dernière opération canonique a échoué sans modifier les données d’apprentissage existantes."],
} as const;

const RECOVERY_COPY = {
  UNRESTORED: "Aucune copie de restauration n’a été vérifiée pendant cette session.",
  RESTORING: "Validation et restauration dans une nouvelle base locale vide…",
  RESTORED: "La copie locale a été restaurée et vérifiée sans remplacer la base active.",
  FAILED: "La restauration a échoué. La base active n’a pas été modifiée.",
} as const;

function recoveryErrorMessage(error: unknown): string {
  if (error instanceof RecoveryError) {
    if (error.code === "CHECKSUM_MISMATCH") return "Le fichier a été modifié ou endommagé.";
    if (error.code === "UNSUPPORTED_EXPORT_VERSION") return "Cette version de sauvegarde n’est pas prise en charge.";
    if (error.code === "TARGET_CONFLICT") return "La cible contient déjà d’autres données.";
    return "Le fichier de restauration est incomplet ou invalide.";
  }
  if (error instanceof CanonicalStorageError) return "Le stockage local n’est pas disponible pour cette restauration.";
  return "La restauration locale n’a pas pu être vérifiée.";
}

async function deleteFreshDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

export function CanonicalDataWorkspace() {
  const status = useSyncExternalStore(
    canonicalOperationsStatus.subscribe,
    canonicalOperationsStatus.getSnapshot,
    canonicalOperationsStatus.getServerSnapshot,
  );
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"EXPORT" | "RESTORE" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const health = HEALTH_COPY[status.health];

  async function download(): Promise<void> {
    setBusy("EXPORT"); setError(null); setMessage(null);
    const repository = new IndexedDbCanonicalLearningRepository();
    try {
      const createdAt = Date.now();
      const bundle = await exportCanonicalHistory(repository, {
        exportId: createEventId(),
        createdAt,
        sourceDatabaseVersion: CANONICAL_DATABASE_VERSION,
        containsPersonalMetadata: true,
        containsCompanyRestrictedMetadata: false,
      });
      const url = URL.createObjectURL(new Blob([encodeBrowserRecoveryFile(bundle)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url; anchor.download = recoveryFilename(createdAt);
      document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setMessage("Sauvegarde locale créée. Conserve ce fichier dans un emplacement privé.");
      localOperationalTelemetry.record(createOperationalTelemetry({ code: "BACKUP_EXPORT_SUCCEEDED", component: "BACKUP", timestamp: Date.now(), durationMs: Date.now() - createdAt, deviceId: null, queueDepth: status.outboxCount, backupStatus: "UNRESTORED", jobState: null, latencyMs: null, route: "/data" }));
    } catch (cause) {
      setError(recoveryErrorMessage(cause));
      localOperationalTelemetry.record(createOperationalTelemetry({ code: "BACKUP_EXPORT_FAILED", component: "BACKUP", timestamp: Date.now(), durationMs: null, deviceId: null, queueDepth: status.outboxCount, backupStatus: "FAILED", jobState: null, latencyMs: null, route: "/data" }));
    } finally {
      repository.close(); setBusy(null);
    }
  }

  async function restore(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy("RESTORE"); setError(null); setMessage(null);
    canonicalOperationsStatus.restoring();
    let targetName: string | null = null;
    let repository: IndexedDbCanonicalLearningRepository | null = null;
    try {
      if (file.size > MAX_RECOVERY_FILE_BYTES) throw new RecoveryError("INVALID_ARCHIVE");
      const bundle = decodeBrowserRecoveryFile(await file.text());
      targetName = "elos-canonical-recovery-" + crypto.randomUUID();
      repository = new IndexedDbCanonicalLearningRepository({ databaseName: targetName });
      const result = await importCanonicalHistory(bundle, repository);
      canonicalOperationsStatus.restored(result.manifest.canonicalEventCount, result.references.length);
      setMessage("Restauration vérifiée dans une nouvelle copie locale vide.");
      localOperationalTelemetry.record(createOperationalTelemetry({ code: "RESTORE_SUCCEEDED", component: "RESTORE", timestamp: Date.now(), durationMs: null, deviceId: null, queueDepth: null, backupStatus: "TRUSTED", jobState: null, latencyMs: null, route: "/data" }));
    } catch (cause) {
      repository?.close();
      if (targetName) await deleteFreshDatabase(targetName);
      canonicalOperationsStatus.recoveryFailed();
      setError(recoveryErrorMessage(cause));
      localOperationalTelemetry.record(createOperationalTelemetry({ code: "RESTORE_FAILURE", component: "RESTORE", timestamp: Date.now(), durationMs: null, deviceId: null, queueDepth: null, backupStatus: "FAILED", jobState: null, latencyMs: null, route: "/data" }));
    } finally {
      repository?.close(); setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Données locales</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Sauvegarde et état du système</h1>
        <p className="mt-2 max-w-3xl text-slate-600">Exporte l’historique canonique, vérifie une restauration ou protège les métadonnées autorisées avec une session distante.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><HardDrive className="size-5 text-emerald-700" aria-hidden="true" />Stockage canonique</CardTitle>
            <CardDescription>État observé sur cet appareil, sans lire le contenu des réponses.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div aria-live="polite" className="rounded-xl border bg-slate-50 p-4">
              <p className="font-semibold">{health[0]}</p>
              <p className="mt-1 text-sm text-slate-600">{health[1]}</p>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3"><dt className="text-slate-500">Événements</dt><dd className="mt-1 text-xl font-semibold">{status.eventCount ?? "—"}</dd></div>
              <div className="rounded-lg border p-3"><dt className="text-slate-500">File locale</dt><dd className="mt-1 text-xl font-semibold">{status.outboxCount ?? "—"}</dd></div>
            </dl>
            <p className="flex gap-2 text-sm text-slate-600"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />IndexedDB reste l’autorité locale. La file distante accepte uniquement les métadonnées classées SYNC_ALLOWED.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DatabaseBackup className="size-5 text-emerald-700" aria-hidden="true" />Restauration</CardTitle>
            <CardDescription>{RECOVERY_COPY[status.recovery]}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status.recovery === "RESTORED" && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <p className="flex items-center gap-2 font-semibold"><CheckCircle2 className="size-4" aria-hidden="true" />Copie vérifiée</p>
                <p className="mt-1">{status.restoredEventCount ?? 0} événement(s) · {status.referencesToRelink ?? 0} référence(s) locale(s) à relier.</p>
              </div>
            )}
            <p className="text-sm text-slate-600">Les fichiers, captures et audios référencés ne sont pas intégrés à la sauvegarde. Ils devront être reliés séparément.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions de récupération</CardTitle>
          <CardDescription>Le fichier contient des métadonnées pédagogiques sensibles. Garde-le privé.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={download} disabled={busy !== null}><Download aria-hidden="true" />{busy === "EXPORT" ? "Préparation…" : "Exporter la sauvegarde"}</Button>
          <Button variant="outline" onClick={() => input.current?.click()} disabled={busy !== null}><Upload aria-hidden="true" />{busy === "RESTORE" ? "Vérification…" : "Valider et restaurer une copie"}</Button>
          <input ref={input} className="sr-only" type="file" accept=".json,application/json" onChange={restore} aria-label="Choisir un fichier de restauration" />
        </CardContent>
      </Card>

      <RemoteSyncPanel />

      <OperationalHistoryPanel />

      {message && <Alert className="border-emerald-200 bg-emerald-50"><CheckCircle2 /><AlertTitle>Opération terminée</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
      {error && <Alert variant="destructive"><AlertCircle /><AlertTitle>Opération interrompue</AlertTitle><AlertDescription>{error} Aucune donnée active n’a été écrasée.</AlertDescription></Alert>}
      {busy && <p className="flex items-center gap-2 text-sm text-slate-600" aria-live="polite"><RefreshCw className="size-4 animate-spin" aria-hidden="true" />Opération locale en cours.</p>}
    </div>
  );
}
