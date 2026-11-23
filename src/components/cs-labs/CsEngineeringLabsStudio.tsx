"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Briefcase, Cpu, Network, Shield, Sparkles } from "lucide-react";
import {
  CS_LABS_STORAGE_KEY,
  CYU_SAE_SCENARIOS,
  DEFAULT_CS_LABS_PROGRESS,
  incrementSubnetSolved,
  markCsItemSolved,
  readCsLabsProgress,
  writeCsLabsProgress,
  type CsLabsProgress,
  type CsProgressBucket,
} from "@/modules/cs-labs/sae-scenarios";
import { PROTOCOL_SEQUENCES, ROUTING_CHALLENGES } from "@/modules/cs-labs/networking-lab";
import { LINUX_MISSIONS, SOC_TRIAGE_CASES } from "@/modules/cs-labs/linux-cyber-lab";
import { CS_DRILL_QUESTIONS, SQL_CHALLENGES } from "@/modules/cs-labs/sql-algo-lab";
import { GlossyProgressBar } from "@/components/daily-mission/studio/StudioPrimitives";
import { NetworkingLabPanel } from "./NetworkingLabPanel";
import { LinuxCyberLabPanel } from "./LinuxCyberLabPanel";
import { SqlAlgoLabPanel } from "./SqlAlgoLabPanel";
import { SaeScenariosPanel } from "./SaeScenariosPanel";

export type CsLabTab = "networking" | "linux" | "sql" | "sae";

function safeStorage() {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
let cachedProgress: CsLabsProgress | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== CS_LABS_STORAGE_KEY) return;
  cachedProgress = null;
  notify();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getSnapshot(): CsLabsProgress {
  if (!cachedProgress) {
    cachedProgress = readCsLabsProgress(safeStorage());
  }
  return cachedProgress;
}

function getServerSnapshot(): CsLabsProgress {
  return DEFAULT_CS_LABS_PROGRESS;
}

function commitProgress(next: CsLabsProgress) {
  cachedProgress = next;
  writeCsLabsProgress(safeStorage(), next);
  notify();
}

interface CsEngineeringLabsStudioProps {
  initialTab?: CsLabTab;
}

export function CsEngineeringLabsStudio({ initialTab = "networking" }: CsEngineeringLabsStudioProps) {
  const [tab, setTab] = useState<CsLabTab>(initialTab);
  const progress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const markSolved = useCallback((bucket: CsProgressBucket, id: string) => {
    commitProgress(markCsItemSolved(getSnapshot(), bucket, id));
  }, []);

  const markSubnet = useCallback(() => {
    commitProgress(incrementSubnetSolved(getSnapshot()));
  }, []);

  const fixedChallengesTotal =
    ROUTING_CHALLENGES.length +
    PROTOCOL_SEQUENCES.length +
    LINUX_MISSIONS.length +
    SOC_TRIAGE_CASES.length +
    SQL_CHALLENGES.length +
    CS_DRILL_QUESTIONS.length +
    CYU_SAE_SCENARIOS.length;

  const fixedSolvedTotal =
    progress.routingSolvedIds.length +
    progress.sequenceSolvedIds.length +
    progress.linuxSolvedIds.length +
    progress.socSolvedIds.length +
    progress.sqlSolvedIds.length +
    progress.drillSolvedIds.length +
    progress.saeSolvedIds.length;

  const overallPct = Math.round((fixedSolvedTotal / Math.max(1, fixedChallengesTotal)) * 100);

  const tabs: ReadonlyArray<{ id: CsLabTab; label: string; count: string; icon: typeof Network }> = [
    {
      id: "networking",
      label: "Réseaux & CIDR",
      count: `${progress.routingSolvedIds.length + progress.sequenceSolvedIds.length}/${ROUTING_CHALLENGES.length + PROTOCOL_SEQUENCES.length}`,
      icon: Network,
    },
    {
      id: "linux",
      label: "Linux & Cyber SOC",
      count: `${progress.linuxSolvedIds.length + progress.socSolvedIds.length}/${LINUX_MISSIONS.length + SOC_TRIAGE_CASES.length}`,
      icon: Shield,
    },
    {
      id: "sql",
      label: "SQL, Graphes & OS",
      count: `${progress.sqlSolvedIds.length + progress.drillSolvedIds.length}/${SQL_CHALLENGES.length + CS_DRILL_QUESTIONS.length}`,
      icon: Cpu,
    },
    {
      id: "sae",
      label: "Scénarios SAE",
      count: `${progress.saeSolvedIds.length}/${CYU_SAE_SCENARIOS.length}`,
      icon: Briefcase,
    },
  ];

  return (
    <div className="elos-studio space-y-6">
      {/* Studio Header */}
      <header className="rounded-3xl border-2 border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#D1FAE5] px-3 py-1 text-xs font-black uppercase tracking-wider text-[#047857]">
              <Sparkles className="h-3.5 w-3.5" /> Entraînement Synthétique · Aligné CYU L3 / Licence Pro
            </span>
            <h1 className="text-2xl font-black tracking-tight text-[#1E293B] sm:text-3xl">
              Labs Ingénieur Informatique
            </h1>
            <p className="max-w-2xl text-sm font-medium leading-6 text-[#64748B]">
              Pratique active 100 % locale (sans shell hôte ni service externe) couvrant Réseaux CCNA1,
              Administration Linux, Cybersécurité SOC/ACL, Bases de données SQL, Graphes, OS et SAE d&apos;alternance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/learn/visual-lab"
              className="inline-flex h-10 items-center rounded-xl border-2 border-[#E2E8F0] bg-white px-3.5 text-xs font-extrabold text-[#334155] hover:bg-[#F8FAFC]"
            >
              Visual Lab OSI →
            </Link>
            <Link
              href="/daily-english"
              className="inline-flex h-10 items-center rounded-xl border-2 border-[#C7D2FE] bg-[#EEF2FF] px-3.5 text-xs font-extrabold text-[#4338CA] hover:bg-[#E0E7FF]"
            >
              Daily English Studio →
            </Link>
          </div>
        </div>

        {/* Real solved progress strip */}
        <div className="rounded-2xl border-2 border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold">
            <span className="text-[#334155]">
              Ateliers validés : <strong className="text-[#047857]">{fixedSolvedTotal}/{fixedChallengesTotal}</strong> ({overallPct} %)
            </span>
            <span className="text-[#4338CA]">
              Calculs Subnetting réussis : {progress.subnetSolvedCount}
            </span>
          </div>
          <GlossyProgressBar value={overallPct} />
        </div>
      </header>

      {/* Domain Navigation Tabs */}
      <nav aria-label="Domaines des Labs Ingénieur" className="flex items-center gap-2 overflow-x-auto pb-1">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
                active
                  ? "border-[#047857] bg-[#059669] text-white shadow-[0_3px_0_#047857]"
                  : "border-[#E2E8F0] bg-white text-[#475569] shadow-[0_3px_0_#E2E8F0] hover:bg-[#F8FAFC] hover:text-[#1E293B]"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              <span
                className={`rounded-lg px-1.5 py-0.5 text-[10px] font-black ${
                  active ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#64748B]"
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Active Domain Panel */}
      {tab === "networking" && (
        <NetworkingLabPanel
          subnetSolvedCount={progress.subnetSolvedCount}
          routingSolvedIds={progress.routingSolvedIds}
          sequenceSolvedIds={progress.sequenceSolvedIds}
          onSubnetSolved={markSubnet}
          onRoutingSolved={(id) => markSolved("routingSolvedIds", id)}
          onSequenceSolved={(id) => markSolved("sequenceSolvedIds", id)}
        />
      )}

      {tab === "linux" && (
        <LinuxCyberLabPanel
          linuxSolvedIds={progress.linuxSolvedIds}
          socSolvedIds={progress.socSolvedIds}
          onLinuxSolved={(id) => markSolved("linuxSolvedIds", id)}
          onSocSolved={(id) => markSolved("socSolvedIds", id)}
        />
      )}

      {tab === "sql" && (
        <SqlAlgoLabPanel
          sqlSolvedIds={progress.sqlSolvedIds}
          drillSolvedIds={progress.drillSolvedIds}
          onSqlSolved={(id) => markSolved("sqlSolvedIds", id)}
          onDrillSolved={(id) => markSolved("drillSolvedIds", id)}
        />
      )}

      {tab === "sae" && (
        <SaeScenariosPanel
          saeSolvedIds={progress.saeSolvedIds}
          onSaeSolved={(id) => markSolved("saeSolvedIds", id)}
        />
      )}
    </div>
  );
}
