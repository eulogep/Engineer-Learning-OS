"use client";

import dynamic from "next/dynamic";

// Client-only: speech synthesis voices, microphone and local transcription.
export const RoleplayLoader = dynamic(() => import("./RoleplayStudio").then((module) => module.RoleplayStudio), {
  ssr: false,
  loading: () => <p className="text-sm text-slate-500">Chargement des jeux de rôle…</p>,
});
