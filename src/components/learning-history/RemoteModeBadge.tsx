"use client";

import { useSyncExternalStore } from "react";
import { Cloud, CloudOff, ShieldCheck } from "lucide-react";
import { remoteSyncController } from "@/modules/learning-history/remote/browser-runtime";

export function RemoteModeBadge() {
  const state = useSyncExternalStore(
    remoteSyncController.subscribe,
    remoteSyncController.getSnapshot,
    remoteSyncController.getServerSnapshot,
  );
  const remote = state.configuration === "READY" && state.auth === "SIGNED_IN";
  const Icon = remote ? Cloud : state.configuration === "READY" ? CloudOff : ShieldCheck;
  return (
    <div
      title={remote ? "IndexedDB reste la source locale; les métadonnées autorisées sont sauvegardées à distance."
        : "Les données restent dans cet environnement tant qu’aucune session distante n’est ouverte."}
      className="flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white px-3 py-1.5"
    >
      <Icon className="size-3.5 text-emerald-700" aria-hidden="true" />
      <span className="text-xs font-semibold text-emerald-900">{remote ? "Local + distant" : "Local"}</span>
    </div>
  );
}
