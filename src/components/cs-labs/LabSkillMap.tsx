"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Circle, CircleDot, Clock3 } from "lucide-react";
import {
  LAB_SKILL_TIER_LABELS,
  type LabSkillId,
  type LabSkillStatus,
  type LabSkillTier,
  type LabSkillView,
} from "@/modules/cs-labs/skill-map";

const STATUS_LABEL: Record<LabSkillStatus, string> = {
  done: "Acquis",
  in_progress: "En cours",
  ready: "À commencer",
  later: "Plus tard",
};

function StatusIcon({ status }: { status: LabSkillStatus }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-[#059669]" aria-hidden="true" />;
  if (status === "in_progress") return <CircleDot className="h-4 w-4 text-[#059669]" aria-hidden="true" />;
  if (status === "later") return <Clock3 className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />;
  return <Circle className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />;
}

interface LabSkillMapProps {
  views: readonly LabSkillView[];
  resumeId: LabSkillId | null;
  onOpen: (id: LabSkillId) => void;
}

/**
 * Skills in three columns (foundations → deeper practice → project).
 * Prerequisites are advice: every node can be opened.
 */
export function LabSkillMap({ views, resumeId, onOpen }: LabSkillMapProps) {
  const tiers: LabSkillTier[] = [0, 1, 2];
  return (
    <div className="grid gap-4 md:grid-cols-3" role="list" aria-label="Carte des compétences">
      {tiers.map((tier) => (
        <div key={tier} className="space-y-2" role="listitem">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#64748B]">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[#F1F5F9] text-[10px] text-[#475569]">
              {tier + 1}
            </span>
            {LAB_SKILL_TIER_LABELS[tier]}
            {tier < 2 && <ArrowRight className="hidden h-3.5 w-3.5 text-[#CBD5E1] md:block" aria-hidden="true" />}
          </p>
          <ul className="space-y-2">
            {views
              .filter((view) => view.skill.tier === tier)
              .map((view, index) => {
                const pct = Math.round((view.solved / Math.max(1, view.skill.total)) * 100);
                const isResume = view.skill.id === resumeId;
                return (
                  <motion.li
                    key={view.skill.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: tier * 0.08 + index * 0.04 }}
                  >
                    <button
                      type="button"
                      onClick={() => onOpen(view.skill.id)}
                      className={`w-full cursor-pointer rounded-xl border bg-white p-3 text-left transition-colors hover:border-[#94A3B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#059669] focus-visible:ring-offset-2 ${
                        isResume ? "border-[#059669] ring-1 ring-[#059669]" : "border-[#E2E8F0]"
                      } ${view.status === "later" ? "opacity-75" : ""}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2">
                          <StatusIcon status={view.status} />
                          <span className="truncate text-sm font-semibold text-[#0F172A]">{view.skill.label}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-[#64748B]">
                          {view.solved}/{view.skill.total}
                        </span>
                      </span>
                      <span className="mt-2 block h-1 overflow-hidden rounded-full bg-[#F1F5F9]" aria-hidden="true">
                        <span className="block h-full rounded-full bg-[#059669]" style={{ width: `${pct}%` }} />
                      </span>
                      <span className="mt-1.5 block text-xs text-[#64748B]">
                        {isResume ? "▶ Là où tu en es" : STATUS_LABEL[view.status]}
                        {view.status === "later" && view.missingPrerequisites.length > 0 && (
                          <> · conseillé après {view.missingPrerequisites.join(", ")}</>
                        )}
                      </span>
                    </button>
                  </motion.li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
