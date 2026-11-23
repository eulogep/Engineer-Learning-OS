"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Binary, CheckCircle2, Network, RefreshCw, Route, XCircle } from "lucide-react";
import {
  PROTOCOL_SEQUENCES,
  ROUTING_CHALLENGES,
  evaluateSubnetAnswer,
  generateSubnetChallenge,
  type SubnetDifficulty,
  type SubnetEvaluation,
} from "@/modules/cs-labs/networking-lab";
import { TactileButton } from "@/components/daily-mission/studio/StudioPrimitives";

interface NetworkingLabPanelProps {
  initialSubTab?: "subnet" | "routing" | "sequences";
  subnetSolvedCount: number;
  routingSolvedIds: readonly string[];
  sequenceSolvedIds: readonly string[];
  onSubnetSolved: () => void;
  onRoutingSolved: (id: string) => void;
  onSequenceSolved: (id: string) => void;
}

export function NetworkingLabPanel({
  initialSubTab = "subnet",
  subnetSolvedCount,
  routingSolvedIds,
  sequenceSolvedIds,
  onSubnetSolved,
  onRoutingSolved,
  onSequenceSolved,
}: NetworkingLabPanelProps) {
  const [subTab, setSubTab] = useState<"subnet" | "routing" | "sequences">(initialSubTab);

  // Subnetting state
  const [difficulty, setDifficulty] = useState<SubnetDifficulty>("B1");
  const [seedCounter, setSeedCounter] = useState(1);
  const [challenge, setChallenge] = useState(() => generateSubnetChallenge("1", "B1"));
  const [netInput, setNetInput] = useState("");
  const [bcastInput, setBcastInput] = useState("");
  const [hostsInput, setHostsInput] = useState("");
  const [subnetEval, setSubnetEval] = useState<SubnetEvaluation | null>(null);
  const [showBinary, setShowBinary] = useState(false);

  // Routing state
  const [routeAnswers, setRouteAnswers] = useState<Record<string, string>>({});

  // Protocol sequences state
  const [seqOrders, setSeqOrders] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(PROTOCOL_SEQUENCES.map((seq) => [seq.id, [...seq.initialOrder]])),
  );
  const [seqFeedback, setSeqFeedback] = useState<Record<string, boolean>>({});

  const nextSubnetChallenge = (nextDiff: SubnetDifficulty, nextCount: number) => {
    setDifficulty(nextDiff);
    setSeedCounter(nextCount);
    setChallenge(generateSubnetChallenge(String(nextCount), nextDiff));
    setNetInput("");
    setBcastInput("");
    setHostsInput("");
    setSubnetEval(null);
    setShowBinary(false);
  };

  const verifySubnet = () => {
    const result = evaluateSubnetAnswer(challenge, {
      networkAddress: netInput,
      broadcastAddress: bcastInput,
      usableHosts: hostsInput,
    });
    const wasAlreadyCorrect = subnetEval?.allCorrect === true;
    setSubnetEval(result);
    if (result.allCorrect && !wasAlreadyCorrect) {
      onSubnetSolved();
    }
  };

  const moveSeqItem = (seqId: string, index: number, delta: -1 | 1) => {
    setSeqOrders((prev) => {
      const current = [...(prev[seqId] ?? [])];
      const target = index + delta;
      if (target < 0 || target >= current.length) return prev;
      [current[index], current[target]] = [current[target], current[index]];
      return { ...prev, [seqId]: current };
    });
    setSeqFeedback((prev) => {
      const copy = { ...prev };
      delete copy[seqId];
      return copy;
    });
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab("subnet")}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${
            subTab === "subnet"
              ? "border-[#059669] bg-[#ECFDF5] text-[#047857]"
              : "border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]"
          }`}
        >
          <Binary className="h-4 w-4" />
          Subnetting CIDR ({subnetSolvedCount})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("routing")}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${
            subTab === "routing"
              ? "border-[#059669] bg-[#ECFDF5] text-[#047857]"
              : "border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]"
          }`}
        >
          <Route className="h-4 w-4" />
          Routage LPM ({routingSolvedIds.length}/{ROUTING_CHALLENGES.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("sequences")}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium ${
            subTab === "sequences"
              ? "border-[#059669] bg-[#ECFDF5] text-[#047857]"
              : "border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]"
          }`}
        >
          <Network className="h-4 w-4" />
          Séquences OSI / TCP / DHCP ({sequenceSolvedIds.length}/{PROTOCOL_SEQUENCES.length})
        </button>
      </div>

      {/* 1. INFINITE SUBNETTING LAB */}
      {subTab === "subnet" && (
        <div className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#6366F1]">
                CYU LPRC · NetAcad CCNA1
              </p>
              <h3 className="text-xl font-bold text-[#1E293B]">
                Calcul IPv4 &amp; Masques CIDR
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              {(["B1", "B2", "EXPERT"] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => nextSubnetChallenge(level, seedCounter + 1)}
                  className={`cursor-pointer rounded-xl border px-3 py-1 text-xs font-bold ${
                    difficulty === level
                      ? "border-[#4338CA] bg-[#EEF2FF] text-[#4338CA]"
                      : "border-[#E2E8F0] bg-white text-[#64748B]"
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF]/60 p-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#4338CA]">
              Hôte cible
            </p>
            <p className="mt-1 font-mono text-3xl font-bold text-[#1E293B]">
              {challenge.solution.cidr}
            </p>
            <p className="mt-1 text-xs font-semibold text-[#64748B]">
              Masque décimal : <span className="font-mono font-bold text-[#334155]">{challenge.solution.subnetMask}</span>
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="subnet-net" className="text-xs font-bold uppercase text-[#475569]">
                Adresse réseau
              </label>
              <input
                id="subnet-net"
                type="text"
                value={netInput}
                onChange={(e) => setNetInput(e.target.value)}
                placeholder="ex: 192.168.10.0"
                className="h-12 w-full rounded-xl border border-[#CBD5E1] px-3 font-mono text-sm font-bold text-[#1E293B] outline-none focus:border-[#6366F1]"
              />
              {subnetEval && (
                <p className={`text-xs font-bold ${subnetEval.networkCorrect ? "text-[#047857]" : "text-[#E11D48]"}`}>
                  {subnetEval.networkCorrect ? "✓ Exact" : `Attendu : ${challenge.solution.networkAddress}`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="subnet-bcast" className="text-xs font-bold uppercase text-[#475569]">
                Adresse broadcast
              </label>
              <input
                id="subnet-bcast"
                type="text"
                value={bcastInput}
                onChange={(e) => setBcastInput(e.target.value)}
                placeholder="ex: 192.168.10.63"
                className="h-12 w-full rounded-xl border border-[#CBD5E1] px-3 font-mono text-sm font-bold text-[#1E293B] outline-none focus:border-[#6366F1]"
              />
              {subnetEval && (
                <p className={`text-xs font-bold ${subnetEval.broadcastCorrect ? "text-[#047857]" : "text-[#E11D48]"}`}>
                  {subnetEval.broadcastCorrect ? "✓ Exact" : `Attendu : ${challenge.solution.broadcastAddress}`}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="subnet-hosts" className="text-xs font-bold uppercase text-[#475569]">
                Hôtes utilisables
              </label>
              <input
                id="subnet-hosts"
                type="text"
                inputMode="numeric"
                value={hostsInput}
                onChange={(e) => setHostsInput(e.target.value)}
                placeholder="ex: 62"
                className="h-12 w-full rounded-xl border border-[#CBD5E1] px-3 font-mono text-sm font-bold text-[#1E293B] outline-none focus:border-[#6366F1]"
              />
              {subnetEval && (
                <p className={`text-xs font-bold ${subnetEval.usableHostsCorrect ? "text-[#047857]" : "text-[#E11D48]"}`}>
                  {subnetEval.usableHostsCorrect ? "✓ Exact" : `Attendu : ${challenge.solution.usableHosts}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <TactileButton variant="primary" size="md" onClick={verifySubnet}>
              Vérifier le calcul
            </TactileButton>
            <TactileButton
              variant="outline"
              size="md"
              onClick={() => nextSubnetChallenge(difficulty, seedCounter + 1)}
            >
              <RefreshCw className="h-4 w-4" />
              Nouveau sous-réseau
            </TactileButton>
            <button
              type="button"
              onClick={() => setShowBinary((v) => !v)}
              className="cursor-pointer text-xs font-semibold text-[#6366F1] hover:underline"
            >
              {showBinary ? "Masquer la méthode binaire" : "Voir la décomposition binaire"}
            </button>
          </div>

          {(showBinary || subnetEval) && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#475569]">
                Méthode &amp; décomposition binaire
              </p>
              <div className="overflow-x-auto rounded-xl bg-[#0F172A] p-3 font-mono text-xs text-[#E2E8F0] space-y-1">
                <p>IP      : {challenge.solution.binaryIp}</p>
                <p>Masque  : {challenge.solution.binaryMask}</p>
                <p className="text-[#34D399]">Réseau  : {challenge.solution.binaryNetwork}  ({challenge.solution.networkAddress})</p>
              </div>
              <ul className="list-disc space-y-1 pl-5 text-xs font-semibold text-[#334155]">
                {challenge.stepsExplanation.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 2. ROUTING TABLE LPM */}
      {subTab === "routing" && (
        <div className="space-y-4">
          {ROUTING_CHALLENGES.map((rc) => {
            const picked = routeAnswers[rc.id];
            const isCorrect = picked === rc.expectedRouteId;
            return (
              <div key={rc.id} className="rounded-3xl border border-[#E2E8F0] bg-white p-6 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-[#1E293B]">{rc.title}</h3>
                    <p className="text-xs font-medium text-[#64748B]">{rc.context}</p>
                  </div>
                  <span className="rounded-xl bg-[#EEF2FF] px-3 py-1 font-mono text-sm font-bold text-[#4338CA]">
                    Dest : {rc.destinationIp}
                  </span>
                </div>

                <div className="space-y-2">
                  {rc.routes.map((route) => {
                    const selected = picked === route.id;
                    const right = selected && route.id === rc.expectedRouteId;
                    const wrong = selected && route.id !== rc.expectedRouteId;
                    return (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => {
                          setRouteAnswers((prev) => ({ ...prev, [rc.id]: route.id }));
                          if (route.id === rc.expectedRouteId) onRoutingSolved(rc.id);
                        }}
                        className={`flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3 text-left font-mono text-xs font-bold transition-all ${
                          right
                            ? "border-[#059669] bg-[#D1FAE5] text-[#047857]"
                            : wrong
                              ? "border-[#F43F5E] bg-[#FFE4E6] text-[#E11D48]"
                              : "border-[#E2E8F0] bg-[#F8FAFC] text-[#1E293B] hover:border-[#6366F1] hover:bg-white"
                        }`}
                      >
                        <span>
                          {route.network}/{route.prefix}
                        </span>
                        <span>via {route.nextHop}</span>
                        <span>dev {route.iface}</span>
                        <span className="rounded-lg bg-white/80 px-2 py-0.5 text-[10px] font-sans font-semibold">
                          {route.metric}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {picked && (
                  <p className={`text-xs font-bold ${isCorrect ? "text-[#047857]" : "text-[#E11D48]"}`}>
                    {isCorrect ? `✓ ${rc.explanation}` : "✗ Ce n'est pas le préfixe le plus spécifique — compare la longueur des masques (/prefix) qui englobent l'IP de destination."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. PROTOCOL SEQUENCES (ENCAPSULATION, TCP, DHCP, HTTPS) */}
      {subTab === "sequences" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {PROTOCOL_SEQUENCES.map((seq) => {
            const currentOrder = seqOrders[seq.id] ?? [...seq.initialOrder];
            const byId = new Map(seq.steps.map((s) => [s.id, s]));
            const checked = seqFeedback[seq.id];
            const alreadySolved = sequenceSolvedIds.includes(seq.id);

            return (
              <div key={seq.id} className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-lg bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold uppercase text-[#4338CA]">
                      {seq.ueTag}
                    </span>
                    <h3 className="mt-1 text-base font-bold text-[#1E293B]">{seq.title}</h3>
                    <p className="text-xs text-[#64748B]">{seq.description}</p>
                  </div>
                  {alreadySolved && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#059669]" />}
                </div>

                <div className="space-y-2">
                  {currentOrder.map((stepId, idx) => {
                    const step = byId.get(stepId);
                    if (!step) return null;
                    return (
                      <div
                        key={step.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#1E293B]">{step.label}</p>
                          <p className="text-[11px] font-medium text-[#64748B]">{step.detail}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => moveSeqItem(seq.id, idx, -1)}
                            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] disabled:opacity-30"
                            aria-label="Monter"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === currentOrder.length - 1}
                            onClick={() => moveSeqItem(seq.id, idx, 1)}
                            className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-[#E2E8F0] bg-white text-[#475569] disabled:opacity-30"
                            aria-label="Descendre"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3">
                  <TactileButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      const ok = currentOrder.every((id, idx) => id === seq.expectedOrder[idx]);
                      setSeqFeedback((prev) => ({ ...prev, [seq.id]: ok }));
                      if (ok) onSequenceSolved(seq.id);
                    }}
                  >
                    Vérifier l&apos;ordre
                  </TactileButton>
                  {checked === true && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#047857]">
                      <CheckCircle2 className="h-4 w-4" /> Séquence validée !
                    </span>
                  )}
                  {checked === false && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-[#E11D48]">
                      <XCircle className="h-4 w-4" /> Indice : {seq.hint}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
