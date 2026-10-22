"use client";

import dynamic from "next/dynamic";

// Client-only: the Studio reads its review schedule from browser storage.
export const StudioLoader = dynamic(() => import("./LearningStudio").then((module) => module.LearningStudio), {
  ssr: false,
  loading: () => <p className="text-sm text-slate-500">Chargement du Learning Studio…</p>,
});
