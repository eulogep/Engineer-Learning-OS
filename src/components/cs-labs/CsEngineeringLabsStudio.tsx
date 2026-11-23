"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Briefcase, ChevronDown, Cpu, Map as MapIcon, Network, Shield, Trophy } from "lucide-react";
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
import {
  computeLabSkillMap,
  labSkill,
  labSkillTotals,
  resumeLabSkill,
  skillForBucket,
  withLastLabSkill,
  type LabSkillId,
} from "@/modules/cs-labs/skill-map";
import { LabSkillMap } from "./LabSkillMap";
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

export function CsEngineeringLabsStudio({ initialTab }: CsEngineeringLabsStudioProps) {
  // null = not chosen yet: follow the URL tab, else the skill to resume.
  const [selection, setSelection] = useState<{ tab: CsLabTab; subTab: string | null } | null>(
    initialTab ? { tab: initialTab, subTab: null } : null,
  );
  // Remounts the domain panel when a skill is opened from the map or the resume button.
  const [panelNonce, setPanelNonce] = useState(0);
  // null = automatic: the map is open on a first visit, folded afterwards.
  const [mapOpenOverride, setMapOpenOverride] = useState<boolean | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const progress = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const views = useMemo(() => computeLabSkillMap(progress), [progress]);
  const resume = useMemo(() => resumeLabSkill(progress), [progress]);
  const totals = useMemo(() => labSkillTotals(progress), [progress]);
  const isFirstVisit = totals.solved === 0 && progress.lastSkillId === null;
  const mapOpen = mapOpenOverride ?? isFirstVisit;
  const overallPct = Math.round((totals.solved / Math.max(1, totals.total)) * 100);
  const tab: CsLabTab = selection?.tab ?? resume?.skill.tab ?? "networking";
  const subTab = selection ? selection.subTab : (resume?.skill.subTab ?? null);

  // Pin the current view on the first success, so finishing a skill never switches tabs under the learner.
  const pinSkill = useCallback((id: LabSkillId) => {
    const skill = labSkill(id);
    setSelection((current) => current ?? { tab: skill.tab, subTab: skill.subTab });
  }, []);

  const markSolved = useCallback(
    (bucket: CsProgressBucket, id: string) => {
      const skillId = skillForBucket(bucket);
      pinSkill(skillId);
      commitProgress(withLastLabSkill(markCsItemSolved(getSnapshot(), bucket, id), skillId));
    },
    [pinSkill],
  );

  const markSubnet = useCallback(() => {
    pinSkill("subnet");
    commitProgress(withLastLabSkill(incrementSubnetSolved(getSnapshot()), "subnet"));
  }, [pinSkill]);

  const openSkill = useCallback((id: LabSkillId) => {
    const skill = labSkill(id);
    commitProgress(withLastLabSkill(getSnapshot(), id));
    setSelection({ tab: skill.tab, subTab: skill.subTab });
    setPanelNonce((n) => n + 1);
    setMapOpenOverride(false);
    window.requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

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

  const panelKey = `${tab}:${subTab ?? "default"}:${panelNonce}`;

  return (
    <div className="elos-studio space-y-5">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">Labs Ingénieur</h1>
            <p className="text-sm text-[#64748B]">
              Simulateurs 100 % locaux · contenu synthétique aligné L3 / Licence Pro
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/learn/visual-lab" className="rounded-lg px-2.5 py-1.5 text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]">
              Visual Lab OSI →
            </Link>
            <Link href="/daily-english" className="rounded-lg px-2.5 py-1.5 text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]">
              Daily English →
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {resume ? (
              <button
                type="button"
                onClick={() => openSkill(resume.skill.id)}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#059669] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_2px_0_#047857] hover:bg-[#047857] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2"
              >
                {isFirstVisit ? "Commencer" : "Reprendre"} : {resume.skill.label}
                <span className="text-white/80">
                  {resume.solved}/{resume.skill.total}
                </span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#F59E0B] to-[#EC4899] px-4 py-2.5 text-sm font-semibold text-white">
                <Trophy className="h-4 w-4" aria-hidden="true" /> Toutes les compétences sont acquises
              </span>
            )}
            <div className="flex min-w-[10rem] flex-1 items-center gap-3 text-sm text-[#475569]">
              <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-[#E2E8F0]" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 rounded-full bg-[#059669]" style={{ width: `${overallPct}%` }} />
              </span>
              <span className="tabular-nums">
                {totals.solved}/{totals.total} ateliers
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMapOpenOverride(!mapOpen)}
              aria-expanded={mapOpen}
              aria-controls="lab-skill-map"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[#475569] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              <MapIcon className="h-4 w-4" aria-hidden="true" />
              Carte des compétences
              <ChevronDown className={`h-4 w-4 transition-transform ${mapOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          </div>

          {mapOpen && (
            <div id="lab-skill-map" className="mt-4 space-y-3 border-t border-[#F1F5F9] pt-4">
              {isFirstVisit && (
                <p className="text-sm text-[#64748B]">
                  Huit compétences, des fondations au projet. Les flèches sont des conseils, pas des verrous :
                  tout est ouvert. Choisis où commencer.
                </p>
              )}
              <LabSkillMap views={views} resumeId={resume?.skill.id ?? null} onOpen={openSkill} />
            </div>
          )}
        </div>
      </header>

      <div ref={panelRef} className="scroll-mt-4 space-y-5">
        <nav aria-label="Domaines des Labs Ingénieur" className="flex items-center gap-1 overflow-x-auto border-b border-[#E2E8F0]">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelection({ tab: item.id, subTab: null })}
                aria-current={active ? "page" : undefined}
                className={`-mb-px inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-[#059669] font-semibold text-[#047857]"
                    : "border-transparent text-[#64748B] hover:text-[#1E293B]"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{item.label}</span>
                <span className="text-xs tabular-nums text-[#94A3B8]">{item.count}</span>
              </button>
            );
          })}
        </nav>

        {tab === "networking" && (
          <NetworkingLabPanel
            key={panelKey}
            initialSubTab={subTab === "routing" || subTab === "sequences" ? subTab : "subnet"}
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
            key={panelKey}
            initialSubTab={subTab === "soc" ? "soc" : "linux"}
            linuxSolvedIds={progress.linuxSolvedIds}
            socSolvedIds={progress.socSolvedIds}
            onLinuxSolved={(id) => markSolved("linuxSolvedIds", id)}
            onSocSolved={(id) => markSolved("socSolvedIds", id)}
          />
        )}

        {tab === "sql" && (
          <SqlAlgoLabPanel
            key={panelKey}
            initialSubTab={subTab === "drills" ? "drills" : "sql"}
            sqlSolvedIds={progress.sqlSolvedIds}
            drillSolvedIds={progress.drillSolvedIds}
            onSqlSolved={(id) => markSolved("sqlSolvedIds", id)}
            onDrillSolved={(id) => markSolved("drillSolvedIds", id)}
          />
        )}

        {tab === "sae" && (
          <SaeScenariosPanel
            key={panelKey}
            saeSolvedIds={progress.saeSolvedIds}
            onSaeSolved={(id) => markSolved("saeSolvedIds", id)}
          />
        )}
      </div>
    </div>
  );
}
