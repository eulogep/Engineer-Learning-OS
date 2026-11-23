import assert from "node:assert/strict";
import test from "node:test";
import {
  LAB_SKILLS,
  SUBNET_TARGET,
  computeLabSkillMap,
  labSkillTotals,
  resumeLabSkill,
  skillForBucket,
  withLastLabSkill,
} from "../../../src/modules/cs-labs/skill-map.ts";
import {
  CS_LABS_STORAGE_KEY,
  DEFAULT_CS_LABS_PROGRESS,
  readCsLabsProgress,
  type CsLabsProgress,
} from "../../../src/modules/cs-labs/sae-scenarios.ts";
import { LINUX_MISSIONS } from "../../../src/modules/cs-labs/linux-cyber-lab.ts";

function progress(overrides: Partial<CsLabsProgress> = {}): CsLabsProgress {
  return { ...DEFAULT_CS_LABS_PROGRESS, ...overrides };
}

function statusOf(p: CsLabsProgress, id: string) {
  return computeLabSkillMap(p).find((view) => view.skill.id === id)?.status;
}

test("skill graph: unique ids, known prerequisites, prerequisites in an earlier tier", () => {
  const ids = new Set(LAB_SKILLS.map((skill) => skill.id));
  assert.equal(ids.size, LAB_SKILLS.length);
  for (const skill of LAB_SKILLS) {
    for (const pre of skill.prerequisites) {
      const preSkill = LAB_SKILLS.find((candidate) => candidate.id === pre);
      assert.ok(preSkill, `${skill.id} -> ${pre}`);
      assert.ok(preSkill.tier < skill.tier, `${pre} must come before ${skill.id}`);
    }
  }
});

test("fresh progress: foundations are ready, later skills are advised after their prerequisites", () => {
  const fresh = progress();
  assert.equal(statusOf(fresh, "subnet"), "ready");
  assert.equal(statusOf(fresh, "routing"), "later");
  assert.equal(statusOf(fresh, "sae"), "later");
  assert.equal(resumeLabSkill(fresh)?.skill.id, "subnet");
  assert.deepEqual(labSkillTotals(fresh).solved, 0);
});

test("half of the prerequisites done makes a skill ready; all done marks it done", () => {
  const half = progress({ subnetSolvedCount: Math.ceil(SUBNET_TARGET / 2) });
  assert.equal(statusOf(half, "subnet"), "in_progress");
  assert.equal(statusOf(half, "routing"), "ready");
  const done = progress({ subnetSolvedCount: SUBNET_TARGET + 10 });
  assert.equal(statusOf(done, "subnet"), "done");
  assert.equal(labSkillTotals(done).solved, SUBNET_TARGET, "subnet counter is capped");
});

test("resume prefers the last skill worked on, then a started one", () => {
  const started = progress({ linuxSolvedIds: [LINUX_MISSIONS[0].id] });
  assert.equal(resumeLabSkill(started)?.skill.id, "linux");
  assert.equal(resumeLabSkill(withLastLabSkill(started, "sql"))?.skill.id, "sql");
  assert.equal(skillForBucket("linuxSolvedIds"), "linux");
});

test("resume ignores a finished or unknown last skill and returns null when all is done", () => {
  const linuxDone = progress({ linuxSolvedIds: LINUX_MISSIONS.map((mission) => mission.id), lastSkillId: "linux" });
  assert.notEqual(resumeLabSkill(linuxDone)?.skill.id, "linux");
  assert.equal(resumeLabSkill(progress({ lastSkillId: "nope" }))?.skill.id, "subnet");

  let everything = progress({ subnetSolvedCount: SUBNET_TARGET });
  for (const skill of LAB_SKILLS) {
    if (skill.bucket) {
      everything = { ...everything, [skill.bucket]: Array.from({ length: skill.total }, (_, i) => `${skill.id}-${i}`) };
    }
  }
  assert.equal(resumeLabSkill(everything), null);
});

test("stored last skill is sanitized when read back", () => {
  const storage = (value: unknown) => ({
    getItem: (key: string) => (key === CS_LABS_STORAGE_KEY ? JSON.stringify(value) : null),
    setItem: () => {},
  });
  assert.equal(readCsLabsProgress(storage({ version: 1, lastSkillId: "soc" })).lastSkillId, "soc");
  assert.equal(readCsLabsProgress(storage({ version: 1, lastSkillId: "<script>" })).lastSkillId, null);
  assert.equal(readCsLabsProgress(storage({ version: 1 })).lastSkillId, null);
});
