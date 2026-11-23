"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, ShieldAlert, Terminal, Volume2, XCircle } from "lucide-react";
import {
  LINUX_MISSIONS,
  SOC_TRIAGE_CASES,
  runVirtualLinuxCommand,
  type VirtualOsState,
} from "@/modules/cs-labs/linux-cyber-lab";
import { TactileButton } from "@/components/daily-mission/studio/StudioPrimitives";
import { speakEnglish } from "@/components/daily-mission/studio/sound-effects";

interface LinuxCyberLabPanelProps {
  linuxSolvedIds: readonly string[];
  socSolvedIds: readonly string[];
  onLinuxSolved: (id: string) => void;
  onSocSolved: (id: string) => void;
}

interface LogEntry {
  command: string;
  stdout: string;
  isError: boolean;
}

export function LinuxCyberLabPanel({
  linuxSolvedIds,
  socSolvedIds,
  onLinuxSolved,
  onSocSolved,
}: LinuxCyberLabPanelProps) {
  const [subTab, setSubTab] = useState<"linux" | "soc">("linux");
  const [missionIdx, setMissionIdx] = useState(0);
  const activeMission = LINUX_MISSIONS[missionIdx];

  const [osState, setOsState] = useState<VirtualOsState>(activeMission.initialState);
  const [history, setHistory] = useState<LogEntry[]>([]);
  const [commandInput, setCommandInput] = useState("");
  const [socAnswers, setSocAnswers] = useState<Record<string, string>>({});

  const selectMission = (idx: number) => {
    setMissionIdx(idx);
    setOsState(LINUX_MISSIONS[idx].initialState);
    setHistory([]);
    setCommandInput("");
  };

  const execute = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === "clear") {
      setHistory([]);
      setCommandInput("");
      return;
    }
    const res = runVirtualLinuxCommand(osState, trimmed);
    setOsState(res.nextState);
    setHistory((prev) => [...prev, { command: trimmed, stdout: res.stdout, isError: res.isError }]);
    setCommandInput("");
    if (activeMission.isSolved(res.nextState)) {
      onLinuxSolved(activeMission.id);
    }
  };

  const missionSolved =
    activeMission.isSolved(osState) || linuxSolvedIds.includes(activeMission.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab("linux")}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 py-2 text-xs font-black uppercase tracking-wider ${
            subTab === "linux"
              ? "border-[#7E22CE] bg-[#A855F7] text-white"
              : "border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]"
          }`}
        >
          <Terminal className="h-4 w-4" />
          Sandbox Linux ({linuxSolvedIds.length}/{LINUX_MISSIONS.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("soc")}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 py-2 text-xs font-black uppercase tracking-wider ${
            subTab === "soc"
              ? "border-[#7E22CE] bg-[#A855F7] text-white"
              : "border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Triage SOC &amp; Pare-feu ({socSolvedIds.length}/{SOC_TRIAGE_CASES.length})
        </button>
      </div>

      {/* 1. VIRTUAL LINUX SANDBOX */}
      {subTab === "linux" && (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          {/* Mission selector */}
          <div className="space-y-2">
            {LINUX_MISSIONS.map((m, idx) => {
              const done = linuxSolvedIds.includes(m.id);
              const selected = idx === missionIdx;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMission(idx)}
                  className={`flex w-full cursor-pointer items-start justify-between gap-2 rounded-2xl border-2 p-3.5 text-left transition-all ${
                    selected
                      ? "border-[#A855F7] bg-[#FAF5FF] shadow-[0_3px_0_#A855F7]"
                      : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                  }`}
                >
                  <div>
                    <p className="text-xs font-black text-[#1E293B]">{m.title}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-[#64748B]">{m.ueTag}</p>
                  </div>
                  {done && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669]" />}
                </button>
              );
            })}
          </div>

          {/* Active Mission Terminal */}
          <div className="space-y-4 rounded-3xl border-2 border-[#E2E8F0] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="rounded-lg bg-[#F3E8FF] px-2.5 py-0.5 text-[11px] font-black text-[#7E22CE]">
                  {activeMission.ueTag} · Sandbox 100 % simulée
                </span>
                <h3 className="mt-1 text-lg font-black text-[#1E293B]">{activeMission.title}</h3>
                <p className="mt-1 text-sm text-[#475569]">{activeMission.briefing}</p>
              </div>
              <button
                type="button"
                onClick={() => selectMission(missionIdx)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#E2E8F0] px-2.5 py-1.5 text-xs font-bold text-[#64748B] hover:bg-[#F8FAFC]"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </button>
            </div>

            {missionSolved && (
              <div className="flex items-center gap-2 rounded-2xl border-2 border-[#A7F3D0] bg-[#D1FAE5] px-4 py-3 text-sm font-extrabold text-[#047857]">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>{activeMission.successSummary}</span>
              </div>
            )}

            {/* Terminal Window */}
            <div className="overflow-hidden rounded-2xl border-2 border-[#1E293B] bg-[#0F172A] text-[#E2E8F0]">
              <div className="flex items-center justify-between border-b border-[#1E293B] bg-[#1E293B] px-4 py-2 text-[11px] font-mono text-[#94A3B8]">
                <span>apprentice@{osState.hostname}:~ (sandbox mémoire)</span>
                <span>Tapez &quot;help&quot; pour la liste</span>
              </div>
              <div className="max-h-64 min-h-[160px] space-y-2.5 overflow-y-auto p-4 font-mono text-xs">
                {history.length === 0 && (
                  <p className="text-[#64748B]">
                    # Prêt. Inspectez le système ou cliquez sur une commande rapide ci-dessous.
                  </p>
                )}
                {history.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="text-[#34D399]">
                      <span className="text-[#94A3B8]">apprentice@{osState.hostname}:~$</span>{" "}
                      {item.command}
                    </p>
                    {item.stdout && (
                      <pre
                        className={`whitespace-pre-wrap pl-2 ${
                          item.isError ? "text-[#FB7185]" : "text-[#E2E8F0]"
                        }`}
                      >
                        {item.stdout}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  execute(commandInput);
                }}
                className="flex items-center gap-2 border-t border-[#1E293B] bg-[#020617] px-4 py-2.5"
              >
                <span className="font-mono text-xs font-bold text-[#34D399]">$</span>
                <input
                  type="text"
                  value={commandInput}
                  onChange={(e) => setCommandInput(e.target.value)}
                  placeholder="ex: ls -la ~/.ssh"
                  className="flex-1 bg-transparent font-mono text-xs text-white outline-none placeholder:text-[#475569]"
                />
                <TactileButton variant="primary" size="sm" type="submit">
                  Exécuter
                </TactileButton>
              </form>
            </div>

            {/* Quick command chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-extrabold uppercase text-[#94A3B8]">
                Commandes rapides :
              </span>
              {activeMission.suggestedCommands.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => execute(cmd)}
                  className="cursor-pointer rounded-xl border border-[#CBD5E1] bg-[#F8FAFC] px-2.5 py-1 font-mono text-xs font-bold text-[#334155] hover:border-[#A855F7] hover:bg-[#FAF5FF]"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. SOC & FIREWALL TRIAGE */}
      {subTab === "soc" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {SOC_TRIAGE_CASES.map((item) => {
            const picked = socAnswers[item.id];
            const isRight = picked === item.correctAnswer;
            return (
              <div key={item.id} className="rounded-3xl border-2 border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-lg bg-[#F3E8FF] px-2.5 py-0.5 text-[11px] font-black text-[#7E22CE]">
                    {item.ueTag}
                  </span>
                  <span className="rounded-lg bg-[#FFE4E6] px-2.5 py-0.5 text-[11px] font-black text-[#E11D48]">
                    Sévérité : {item.severity}
                  </span>
                </div>

                <h3 className="text-base font-black text-[#1E293B]">{item.title}</h3>

                <div className="rounded-2xl bg-[#0F172A] p-3.5">
                  <p className="mb-1.5 text-[10px] font-black uppercase tracking-wider text-[#94A3B8]">
                    {item.artifactTitle}
                  </p>
                  <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-[#E2E8F0]">
                    {item.artifactSnippet}
                  </pre>
                </div>

                <p className="text-sm font-extrabold text-[#1E293B]">{item.question}</p>

                <div className="space-y-2">
                  {item.choices.map((choice) => {
                    const selected = picked === choice;
                    const right = selected && choice === item.correctAnswer;
                    const wrong = selected && choice !== item.correctAnswer;
                    return (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => {
                          setSocAnswers((prev) => ({ ...prev, [item.id]: choice }));
                          if (choice === item.correctAnswer) onSocSolved(item.id);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl border-2 px-3.5 py-3 text-left text-xs font-extrabold transition-all ${
                          right
                            ? "border-[#059669] bg-[#D1FAE5] text-[#047857]"
                            : wrong
                              ? "border-[#F43F5E] bg-[#FFE4E6] text-[#E11D48]"
                              : "border-[#E2E8F0] bg-white text-[#334155] hover:border-[#A855F7] hover:bg-[#FAF5FF]"
                        }`}
                      >
                        <span>{choice}</span>
                        {right && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669]" />}
                        {wrong && <XCircle className="h-4 w-4 shrink-0 text-[#F43F5E]" />}
                      </button>
                    );
                  })}
                </div>

                {picked && (
                  <div className="space-y-2 rounded-2xl bg-[#F8FAFC] p-3.5 text-xs">
                    <p className={`font-bold ${isRight ? "text-[#047857]" : "text-[#E11D48]"}`}>
                      {isRight ? `✓ ${item.explanation}` : "✗ Réessaie en observant attentivement la cause technique dans l'extrait."}
                    </p>
                    {isRight && (
                      <div className="flex items-center justify-between gap-2 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-2">
                        <p className="font-semibold text-[#312E81]">
                          <strong className="font-black">En anglais pro :</strong> “{item.englishReportLine}”
                        </p>
                        <button
                          type="button"
                          onClick={() => speakEnglish(item.englishReportLine)}
                          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg bg-[#6366F1] text-white"
                          aria-label="Écouter la phrase en anglais"
                        >
                          <Volume2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
