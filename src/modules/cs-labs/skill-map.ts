/**
 * Skill map of the CS engineering labs.
 *
 * Groups the workshops into eight skills linked by recommended prerequisites,
 * derives each skill's status from local progress, and picks the skill to
 * resume. Prerequisites are advice, never locks: every skill stays open.
 */
import { PROTOCOL_SEQUENCES, ROUTING_CHALLENGES } from "./networking-lab";
import { LINUX_MISSIONS, SOC_TRIAGE_CASES } from "./linux-cyber-lab";
import { CS_DRILL_QUESTIONS, SQL_CHALLENGES } from "./sql-algo-lab";
import { CYU_SAE_SCENARIOS, type CsLabsProgress, type CsProgressBucket } from "./sae-scenarios";

export type LabTab = "networking" | "linux" | "sql" | "sae";

export type LabSkillId =
  | "subnet"
  | "sequences"
  | "routing"
  | "linux"
  | "soc"
  | "sql"
  | "drills"
  | "sae";

/** Column of the map: foundations, then deeper practice, then end-to-end projects. */
export type LabSkillTier = 0 | 1 | 2;

export const LAB_SKILL_TIER_LABELS: Readonly<Record<LabSkillTier, string>> = {
  0: "Fondations",
  1: "Approfondissement",
  2: "Projet",
};

/** Successful subnet calculations needed to consider the skill acquired. */
export const SUBNET_TARGET = 5;

export type LabSkill = Readonly<{
  id: LabSkillId;
  label: string;
  tab: LabTab;
  /** Sub-tab inside the domain panel (null when the panel has none). */
  subTab: string | null;
  tier: LabSkillTier;
  prerequisites: readonly LabSkillId[];
  /** Progress bucket, or null for the subnet counter. */
  bucket: CsProgressBucket | null;
  total: number;
}>;

/** Recommended order; also the resume order. */
export const LAB_SKILLS: readonly LabSkill[] = [
  { id: "subnet", label: "Calcul CIDR / VLSM", tab: "networking", subTab: "subnet", tier: 0, prerequisites: [], bucket: null, total: SUBNET_TARGET },
  { id: "sequences", label: "Séquences OSI / TCP / DHCP", tab: "networking", subTab: "sequences", tier: 0, prerequisites: [], bucket: "sequenceSolvedIds", total: PROTOCOL_SEQUENCES.length },
  { id: "linux", label: "Sandbox Linux", tab: "linux", subTab: "linux", tier: 0, prerequisites: [], bucket: "linuxSolvedIds", total: LINUX_MISSIONS.length },
  { id: "sql", label: "Atelier SQL", tab: "sql", subTab: "sql", tier: 0, prerequisites: [], bucket: "sqlSolvedIds", total: SQL_CHALLENGES.length },
  { id: "routing", label: "Routage LPM", tab: "networking", subTab: "routing", tier: 1, prerequisites: ["subnet"], bucket: "routingSolvedIds", total: ROUTING_CHALLENGES.length },
  { id: "soc", label: "Triage SOC & pare-feu", tab: "linux", subTab: "soc", tier: 1, prerequisites: ["linux", "sequences"], bucket: "socSolvedIds", total: SOC_TRIAGE_CASES.length },
  { id: "drills", label: "Graphes, OS & code review", tab: "sql", subTab: "drills", tier: 1, prerequisites: ["sql"], bucket: "drillSolvedIds", total: CS_DRILL_QUESTIONS.length },
  { id: "sae", label: "Scénarios SAE", tab: "sae", subTab: null, tier: 2, prerequisites: ["routing", "soc", "drills"], bucket: "saeSolvedIds", total: CYU_SAE_SCENARIOS.length },
];

const SKILL_BY_ID = new Map(LAB_SKILLS.map((skill) => [skill.id, skill]));

export function labSkill(id: LabSkillId): LabSkill {
  const skill = SKILL_BY_ID.get(id);
  if (!skill) throw new Error(`Unknown lab skill: ${id}`);
  return skill;
}

export function isLabSkillId(value: unknown): value is LabSkillId {
  return typeof value === "string" && SKILL_BY_ID.has(value as LabSkillId);
}

/** The skill a progress bucket belongs to. */
export function skillForBucket(bucket: CsProgressBucket): LabSkillId {
  const skill = LAB_SKILLS.find((candidate) => candidate.bucket === bucket);
  if (!skill) throw new Error(`No skill for bucket: ${bucket}`);
  return skill.id;
}

/**
 * - done: every workshop solved
 * - in_progress: started
 * - ready: not started, prerequisites at least half done (or none)
 * - later: not started, better after its prerequisites (still open)
 */
export type LabSkillStatus = "done" | "in_progress" | "ready" | "later";

export type LabSkillView = Readonly<{
  skill: LabSkill;
  solved: number;
  status: LabSkillStatus;
  /** Prerequisites not yet half done, by label. */
  missingPrerequisites: readonly string[];
}>;

function solvedCount(skill: LabSkill, progress: CsLabsProgress): number {
  const raw = skill.bucket === null ? progress.subnetSolvedCount : progress[skill.bucket].length;
  return Math.min(skill.total, raw);
}

export function computeLabSkillMap(progress: CsLabsProgress): LabSkillView[] {
  const solved = new Map(LAB_SKILLS.map((skill) => [skill.id, solvedCount(skill, progress)]));
  return LAB_SKILLS.map((skill) => {
    const count = solved.get(skill.id) ?? 0;
    const missing = skill.prerequisites
      .map(labSkill)
      .filter((pre) => (solved.get(pre.id) ?? 0) * 2 < pre.total)
      .map((pre) => pre.label);
    const status: LabSkillStatus =
      count >= skill.total ? "done" : count > 0 ? "in_progress" : missing.length === 0 ? "ready" : "later";
    return { skill, solved: count, status, missingPrerequisites: missing };
  });
}

/**
 * The skill to resume: the last one worked on (`lastSkillId`) if unfinished, else the first
 * started one, else the first ready one, else the first unfinished one.
 * Returns null when everything is done.
 */
export function resumeLabSkill(progress: CsLabsProgress): LabSkillView | null {
  const lastSkillId = lastLabSkill(progress);
  const map = computeLabSkillMap(progress);
  const unfinished = map.filter((view) => view.status !== "done");
  if (unfinished.length === 0) return null;
  const last = lastSkillId ? unfinished.find((view) => view.skill.id === lastSkillId) : undefined;
  return (
    last ??
    unfinished.find((view) => view.status === "in_progress") ??
    unfinished.find((view) => view.status === "ready") ??
    unfinished[0]
  );
}

/** Total workshops and solved workshops, subnet counter included. */
export function labSkillTotals(progress: CsLabsProgress): { solved: number; total: number } {
  return computeLabSkillMap(progress).reduce(
    (acc, view) => ({ solved: acc.solved + view.solved, total: acc.total + view.skill.total }),
    { solved: 0, total: 0 },
  );
}

/** Remember the skill being worked on, so the labs can resume there. */
export function withLastLabSkill(progress: CsLabsProgress, skillId: LabSkillId): CsLabsProgress {
  return progress.lastSkillId === skillId ? progress : { ...progress, lastSkillId: skillId };
}

/** The remembered skill, if it is still a known one. */
export function lastLabSkill(progress: CsLabsProgress): LabSkillId | null {
  return isLabSkillId(progress.lastSkillId) ? progress.lastSkillId : null;
}
