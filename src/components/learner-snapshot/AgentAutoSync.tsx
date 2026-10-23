"use client";

import { useEffect } from "react";
import { savedFolder, syncSnapshot } from "@/modules/learner-snapshot/browser-bridge";

const INTERVAL_MS = 60_000;

/** Keeps the shared snapshot fresh while the app is open; never prompts for permission. */
export function AgentAutoSync() {
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      const folder = await savedFolder();
      if (!stopped && folder) await syncSnapshot(folder).catch(() => {});
    };
    const onHide = () => { if (document.visibilityState === "hidden") void tick(); };
    void tick();
    const timer = setInterval(() => void tick(), INTERVAL_MS);
    document.addEventListener("visibilitychange", onHide);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", onHide); };
  }, []);
  return null;
}
