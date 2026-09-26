"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Activity, ShieldCheck, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { localOperationalTelemetry } from "@/modules/learning-history/operations/telemetry-journal";

const COMPONENT_LABELS = {
  LOCAL_STORE: "Stockage local", PROJECTION: "Projection", SYNC: "Synchronisation", AUTH: "Accès",
  BACKUP: "Sauvegarde", RESTORE: "Restauration", DELETION: "Suppression",
} as const;

export function OperationalHistoryPanel() {
  const history = useSyncExternalStore(
    localOperationalTelemetry.subscribe,
    localOperationalTelemetry.getSnapshot,
    localOperationalTelemetry.getServerSnapshot,
  );
  useEffect(() => { localOperationalTelemetry.hydrate(); }, []);
  const records = [...history.records].reverse();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="size-5 text-emerald-700" aria-hidden="true" />Historique opérationnel</CardTitle>
        <CardDescription>Codes techniques locaux conservés au maximum 90 jours, sans contenu d’apprentissage.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex gap-2 text-sm text-slate-600"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700" aria-hidden="true" />{history.persistence === "PERSISTED" ? "Journal local disponible." : "Le navigateur ne permet pas de conserver ce journal."}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => localOperationalTelemetry.prune()}>Purger les entrées expirées</Button>
            <Button variant="outline" size="sm" onClick={() => localOperationalTelemetry.clear()} disabled={records.length === 0}><Trash2 aria-hidden="true" />Effacer le journal</Button>
          </div>
        </div>
        {history.hydrated && records.length === 0 ? (
          <p className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">Aucun événement opérationnel conservé.</p>
        ) : (
          <ul className="space-y-2" aria-label="Événements opérationnels locaux">
            {records.map((record) => (
              <li key={record.correlationId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm">
                <div><p className="font-medium">{record.code.replaceAll("_", " ")}</p><p className="text-slate-500">{COMPONENT_LABELS[record.component]} · {new Date(record.timestamp).toLocaleString("fr-FR")}</p></div>
                <div className="flex items-center gap-2"><Badge variant="outline">{record.severity}</Badge>{record.durationMs !== null && <span className="text-xs text-slate-500">{record.durationMs} ms</span>}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
