"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Cloud, CloudOff, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { remoteSyncController } from "@/modules/learning-history/remote/browser-runtime";

const FAILURE_COPY = {
  AUTH: "La session n’a pas pu être vérifiée. Contrôle l’adresse et le mot de passe.",
  NETWORK: "Le réseau est indisponible. La file locale sera reprise automatiquement.",
  REMOTE: "Le service distant a refusé ou interrompu l’opération. Les données locales restent intactes.",
  LOCAL: "La synchronisation a été interrompue pour protéger l’historique local.",
  IDENTITY: "Ce compte est déjà lié à un autre historique. Exporte ou restaure la copie attendue avant de relancer.",
} as const;

export function RemoteSyncPanel() {
  const state = useSyncExternalStore(
    remoteSyncController.subscribe,
    remoteSyncController.getSnapshot,
    remoteSyncController.getServerSnapshot,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"SIGN_IN" | "SIGN_UP" | "SIGN_OUT" | "SYNC" | null>(null);

  async function authenticate(kind: "SIGN_IN" | "SIGN_UP"): Promise<void> {
    if (!email.trim() || password.length < 8) return;
    setBusy(kind);
    try {
      if (kind === "SIGN_IN") await remoteSyncController.signIn(email, password);
      else await remoteSyncController.signUp(email, password);
      setPassword("");
    } finally {
      setBusy(null);
    }
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    void authenticate("SIGN_IN");
  }

  if (state.configuration !== "READY") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CloudOff className="size-5 text-slate-500" aria-hidden="true" />Sauvegarde distante</CardTitle>
          <CardDescription>
            {state.configuration === "DISABLED"
              ? "Désactivée par configuration. IndexedDB continue de fonctionner seul."
              : "Configuration distante invalide; aucune connexion n’est tentée."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Cloud className="size-5 text-emerald-700" aria-hidden="true" />Sauvegarde distante chiffrée en transit</CardTitle>
        <CardDescription>Seules les métadonnées classées SYNC_ALLOWED sont envoyées. Les réponses, fichiers et contenus bruts restent locaux.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(state.auth === "SIGNED_OUT" || state.auth === "CHECK_EMAIL") && (
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="remote-email">Adresse e-mail</Label>
              <Input id="remote-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="remote-password">Mot de passe</Label>
              <Input id="remote-password" type="password" minLength={8} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy !== null}>{busy === "SIGN_IN" ? "Connexion…" : "Se connecter"}</Button>
              <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void authenticate("SIGN_UP")}>
                {busy === "SIGN_UP" ? "Création…" : "Créer un compte"}
              </Button>
            </div>
          </form>
        )}

        {state.auth === "CHECK_EMAIL" && (
          <Alert className="border-emerald-200 bg-emerald-50">
            <CheckCircle2 />
            <AlertTitle>Vérifie ta messagerie</AlertTitle>
            <AlertDescription>Confirme l’adresse {state.accountEmail ?? ""}, puis connecte-toi ici.</AlertDescription>
          </Alert>
        )}

        {state.auth === "SIGNED_IN" && (
          <div className="space-y-4">
            <div className="rounded-xl border bg-slate-50 p-4 text-sm">
              <p className="font-semibold">{state.accountEmail}</p>
              <p className="mt-1 text-slate-600">
                {state.run === "SYNCING" ? "Synchronisation en cours…"
                  : state.run === "SYNCED" ? `Synchronisé · ${state.uploaded} envoyé(s), ${state.downloaded} reçu(s)`
                    : state.run === "OFFLINE" ? "Hors ligne · reprise automatique"
                      : state.run === "IDENTITY_CONFLICT" ? "Identité locale à rapprocher"
                        : state.run === "FAILED" ? "Dernière synchronisation interrompue" : "Prêt à synchroniser"}
              </p>
              {state.lastSyncedAt && <p className="mt-1 text-xs text-slate-500">Dernière réussite : {new Date(state.lastSyncedAt).toLocaleString("fr-FR")}</p>}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={async () => { setBusy("SYNC"); try { await remoteSyncController.synchronize(); } finally { setBusy(null); } }} disabled={busy !== null || state.run === "SYNCING"}>
                <RefreshCw className={state.run === "SYNCING" ? "animate-spin" : ""} aria-hidden="true" />{busy === "SYNC" ? "Synchronisation…" : "Synchroniser maintenant"}
              </Button>
              <Button type="button" variant="outline" onClick={async () => { setBusy("SIGN_OUT"); try { await remoteSyncController.signOut(); } finally { setBusy(null); } }} disabled={busy !== null}>
                {busy === "SIGN_OUT" ? "Déconnexion…" : "Se déconnecter"}
              </Button>
            </div>
          </div>
        )}

        {state.failure && (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Synchronisation protégée</AlertTitle>
            <AlertDescription>
              {FAILURE_COPY[state.failure]}
              {state.diagnosticCode && (
                <span className="mt-2 block font-mono text-xs">Code diagnostic : {state.diagnosticCode}</span>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
