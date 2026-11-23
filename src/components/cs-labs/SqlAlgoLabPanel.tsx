"use client";

import { useState } from "react";
import { CheckCircle2, Cpu, Database, XCircle } from "lucide-react";
import {
  CS_DRILL_QUESTIONS,
  SQL_CHALLENGES,
  SYNTHETIC_SQL_SCHEMA,
  evaluateSqlQuery,
  type CsDrillCategory,
} from "@/modules/cs-labs/sql-algo-lab";
import { TactileButton } from "@/components/daily-mission/studio/StudioPrimitives";

interface SqlAlgoLabPanelProps {
  sqlSolvedIds: readonly string[];
  drillSolvedIds: readonly string[];
  onSqlSolved: (id: string) => void;
  onDrillSolved: (id: string) => void;
}

const DRILL_FILTERS: readonly ("Toutes" | CsDrillCategory)[] = [
  "Toutes",
  "Graphes & Algo",
  "Systèmes OS",
  "BDD & Normalisation",
  "Code Review",
];

export function SqlAlgoLabPanel({
  sqlSolvedIds,
  drillSolvedIds,
  onSqlSolved,
  onDrillSolved,
}: SqlAlgoLabPanelProps) {
  const [subTab, setSubTab] = useState<"sql" | "drills">("sql");
  const [sqlIdx, setSqlIdx] = useState(0);
  const [sqlInput, setSqlInput] = useState("");
  const [sqlEval, setSqlEval] = useState<ReturnType<typeof evaluateSqlQuery> | null>(null);

  const [drillFilter, setDrillFilter] = useState<"Toutes" | CsDrillCategory>("Toutes");
  const [drillAnswers, setDrillAnswers] = useState<Record<string, string>>({});

  const activeSql = SQL_CHALLENGES[sqlIdx];
  const filteredDrills =
    drillFilter === "Toutes"
      ? CS_DRILL_QUESTIONS
      : CS_DRILL_QUESTIONS.filter((q) => q.category === drillFilter);

  const switchSql = (idx: number) => {
    setSqlIdx(idx);
    setSqlInput("");
    setSqlEval(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab("sql")}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 py-2 text-xs font-black uppercase tracking-wider ${
            subTab === "sql"
              ? "border-[#0E7490] bg-[#06B6D4] text-white"
              : "border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]"
          }`}
        >
          <Database className="h-4 w-4" />
          Atelier SQL ({sqlSolvedIds.length}/{SQL_CHALLENGES.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("drills")}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-2xl border-2 px-4 py-2 text-xs font-black uppercase tracking-wider ${
            subTab === "drills"
              ? "border-[#0E7490] bg-[#06B6D4] text-white"
              : "border-[#E2E8F0] bg-white text-[#475569] hover:bg-[#F8FAFC]"
          }`}
        >
          <Cpu className="h-4 w-4" />
          Graphes, OS &amp; Code Review ({drillSolvedIds.length}/{CS_DRILL_QUESTIONS.length})
        </button>
      </div>

      {/* 1. SQL LAB */}
      {subTab === "sql" && (
        <div className="space-y-5">
          {/* Synthetic Tables Preview */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-[#E2E8F0] bg-white p-4">
              <p className="mb-2 font-mono text-xs font-black text-[#0E7490]">
                Table : servers(id, hostname, zone, state)
              </p>
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                    <th className="py-1">id</th>
                    <th>hostname</th>
                    <th>zone</th>
                    <th>state</th>
                  </tr>
                </thead>
                <tbody>
                  {SYNTHETIC_SQL_SCHEMA.servers.map((row) => (
                    <tr key={row[0]} className="border-b border-[#F1F5F9] text-[#1E293B]">
                      {row.map((cell, i) => (
                        <td key={i} className="py-1">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border-2 border-[#E2E8F0] bg-white p-4">
              <p className="mb-2 font-mono text-xs font-black text-[#0E7490]">
                Table : incidents(id, server_id, severity, created_at, status)
              </p>
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                    <th className="py-1">id</th>
                    <th>srv</th>
                    <th>severity</th>
                    <th>date</th>
                    <th>status</th>
                  </tr>
                </thead>
                <tbody>
                  {SYNTHETIC_SQL_SCHEMA.incidents.map((row) => (
                    <tr key={row[0]} className="border-b border-[#F1F5F9] text-[#1E293B]">
                      {row.map((cell, i) => (
                        <td key={i} className="py-1">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Challenge selector + Editor */}
          <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
            <div className="space-y-2">
              {SQL_CHALLENGES.map((item, idx) => {
                const done = sqlSolvedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => switchSql(idx)}
                    className={`flex w-full cursor-pointer items-start justify-between gap-2 rounded-2xl border-2 p-3.5 text-left ${
                      idx === sqlIdx
                        ? "border-[#06B6D4] bg-[#ECFEFF] shadow-[0_3px_0_#06B6D4]"
                        : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-black text-[#1E293B]">{item.title}</p>
                      <p className="mt-0.5 text-[11px] font-semibold text-[#64748B]">{item.ueTag}</p>
                    </div>
                    {done && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#059669]" />}
                  </button>
                );
              })}
            </div>

            <div className="rounded-3xl border-2 border-[#E2E8F0] bg-white p-5 shadow-sm space-y-4">
              <div>
                <span className="rounded-lg bg-[#CFFAFE] px-2.5 py-0.5 text-[11px] font-black text-[#0E7490]">
                  {activeSql.ueTag}
                </span>
                <h3 className="mt-1 text-lg font-black text-[#1E293B]">{activeSql.title}</h3>
                <p className="mt-1 text-sm font-medium text-[#475569]">{activeSql.prompt}</p>
              </div>

              {/* Guided SQL Builder Chips */}
              <div className="flex flex-wrap gap-2">
                {activeSql.tokenBank.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() =>
                      setSqlInput((prev) => (prev.trim() ? `${prev.trim()} ${chip}` : chip))
                    }
                    className="cursor-pointer rounded-xl border-2 border-[#E2E8F0] bg-[#F8FAFC] px-3 py-1.5 font-mono text-xs font-bold text-[#1E293B] hover:border-[#06B6D4] hover:bg-[#ECFEFF]"
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              <textarea
                value={sqlInput}
                onChange={(e) => setSqlInput(e.target.value)}
                placeholder="Écris ta requête SQL ou clique sur les blocs ci-dessus…"
                className="min-h-[104px] w-full rounded-2xl border-2 border-[#CBD5E1] bg-[#0F172A] p-4 font-mono text-xs text-[#34D399] outline-none focus:border-[#06B6D4]"
              />

              <div className="flex flex-wrap items-center gap-3">
                <TactileButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const res = evaluateSqlQuery(activeSql, sqlInput);
                    setSqlEval(res);
                    if (res.correct) onSqlSolved(activeSql.id);
                  }}
                >
                  Exécuter &amp; Vérifier
                </TactileButton>
                <TactileButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSqlInput(activeSql.modelQuery);
                    setSqlEval(null);
                  }}
                >
                  Voir la requête modèle
                </TactileButton>
              </div>

              {sqlEval && (
                <div
                  className={`rounded-2xl border-2 p-4 text-xs space-y-3 ${
                    sqlEval.correct
                      ? "border-[#A7F3D0] bg-[#D1FAE5]/60 text-[#047857]"
                      : "border-[#FECDD3] bg-[#FFE4E6]/70 text-[#E11D48]"
                  }`}
                >
                  <p className="font-extrabold">{sqlEval.feedback}</p>
                  {sqlEval.correct && (
                    <div className="rounded-xl bg-white p-3 text-[#1E293B]">
                      <p className="mb-1.5 text-[10px] font-black uppercase text-[#64748B]">
                        Aperçu du résultat attendu
                      </p>
                      <table className="w-full text-left font-mono text-xs">
                        <thead>
                          <tr className="border-b border-[#E2E8F0]">
                            {activeSql.expectedPreviewColumns.map((col) => (
                              <th key={col} className="py-1 font-black">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeSql.expectedPreviewRows.map((row, idx) => (
                            <tr key={idx} className="border-b border-[#F1F5F9]">
                              {row.map((val, cIdx) => (
                                <td key={cIdx} className="py-1">{val}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. ALGO, GRAPHS, OS & CODE REVIEW DRILLS */}
      {subTab === "drills" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DRILL_FILTERS.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setDrillFilter(cat)}
                className={`cursor-pointer rounded-xl border-2 px-3 py-1.5 text-xs font-extrabold ${
                  drillFilter === cat
                    ? "border-[#06B6D4] bg-[#ECFEFF] text-[#0E7490]"
                    : "border-[#E2E8F0] bg-white text-[#64748B]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {filteredDrills.map((q) => {
              const picked = drillAnswers[q.id];
              const isRight = picked === q.correctAnswer;
              return (
                <div key={q.id} className="rounded-3xl border-2 border-[#E2E8F0] bg-white p-5 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-[#ECFEFF] px-2.5 py-0.5 text-[11px] font-black text-[#0E7490]">
                      {q.ueTag}
                    </span>
                    {drillSolvedIds.includes(q.id) && (
                      <CheckCircle2 className="h-4 w-4 text-[#059669]" />
                    )}
                  </div>
                  <h3 className="text-base font-black text-[#1E293B]">{q.title}</h3>
                  {q.snippet && (
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl bg-[#0F172A] p-3.5 font-mono text-xs text-[#E2E8F0]">
                      {q.snippet}
                    </pre>
                  )}
                  <p className="text-sm font-extrabold text-[#334155]">{q.question}</p>
                  <div className="space-y-2">
                    {q.choices.map((choice) => {
                      const selected = picked === choice;
                      const right = selected && choice === q.correctAnswer;
                      const wrong = selected && choice !== q.correctAnswer;
                      return (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => {
                            setDrillAnswers((prev) => ({ ...prev, [q.id]: choice }));
                            if (choice === q.correctAnswer) onDrillSolved(q.id);
                          }}
                          className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-2xl border-2 px-3.5 py-3 text-left text-xs font-extrabold transition-all ${
                            right
                              ? "border-[#059669] bg-[#D1FAE5] text-[#047857]"
                              : wrong
                                ? "border-[#F43F5E] bg-[#FFE4E6] text-[#E11D48]"
                                : "border-[#E2E8F0] bg-white text-[#334155] hover:border-[#06B6D4] hover:bg-[#ECFEFF]/50"
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
                    <p className={`text-xs font-bold ${isRight ? "text-[#047857]" : "text-[#E11D48]"}`}>
                      {isRight ? `✓ ${q.explanation}` : "✗ Réessaie — déroule l'algorithme étape par étape."}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
