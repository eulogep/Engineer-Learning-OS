import assert from "node:assert/strict";
import test from "node:test";
import {
  STUDIO_INTENTS,
  rankStudioIntents,
  type IntentContext,
} from "../../../src/modules/daily-english/studio-intents.ts";
import { detectRewardEvents } from "../../../src/modules/daily-english/reward-events.ts";
import {
  DEFAULT_GAMIFICATION_STATE,
  type GamificationState,
} from "../../../src/modules/daily-english/gamification.ts";

const baseContext: IntentContext = {
  timeBudget: 5,
  lessonsCompletedToday: 0,
  missionCompletedToday: false,
  storiesCompleted: 0,
  storiesTotal: 6,
  hearts: 5,
  nextLessonTitle: "Échauffement du jour",
};

function recommended(ctx: IntentContext) {
  const ranked = rankStudioIntents(ctx);
  const picks = ranked.filter((entry) => entry.recommended);
  assert.equal(picks.length, 1, "exactly one recommendation");
  assert.equal(ranked[0], picks[0], "recommendation comes first");
  assert.ok(picks[0].reason);
  return picks[0].intent.id;
}

test("first visit of the day recommends the next lesson", () => {
  assert.equal(recommended(baseContext), "continue_path");
});

test("two minutes recommends the 60-second blitz", () => {
  assert.equal(recommended({ ...baseContext, timeBudget: 2 }), "blitz");
});

test("fifteen minutes after a lesson recommends speaking", () => {
  assert.equal(recommended({ ...baseContext, timeBudget: 15, lessonsCompletedToday: 1 }), "speak");
});

test("empty hearts never recommends a lesson and hides the path choice", () => {
  const ctx = { ...baseContext, hearts: 0 };
  assert.equal(recommended(ctx), "story");
  assert.ok(!rankStudioIntents(ctx).some((entry) => entry.intent.id === "continue_path"));
});

test("everything done falls back to review", () => {
  const ctx: IntentContext = {
    ...baseContext,
    hearts: 0,
    lessonsCompletedToday: 3,
    missionCompletedToday: true,
    storiesCompleted: 6,
    nextLessonTitle: null,
  };
  assert.equal(recommended(ctx), "review");
  const ids = rankStudioIntents(ctx).map((entry) => entry.intent.id);
  assert.ok(!ids.includes("speak") && !ids.includes("story") && !ids.includes("continue_path"));
});

test("choices that fit the time budget come before the others", () => {
  const ranked = rankStudioIntents(baseContext).slice(1);
  const firstMisfit = ranked.findIndex((entry) => !entry.fits);
  assert.ok(firstMisfit > 0);
  assert.ok(ranked.slice(firstMisfit).every((entry) => !entry.fits));
  assert.equal(new Set(STUDIO_INTENTS.map((intent) => intent.id)).size, STUDIO_INTENTS.length);
});

function state(overrides: Partial<GamificationState>): GamificationState {
  return { ...DEFAULT_GAMIFICATION_STATE, lastActiveDay: "2026-11-23", ...overrides };
}

test("reward events: quest claimed, daily goal reached and streak increased", () => {
  const before = state({ todayXp: 40, streak: 2, claimedQuestIds: [] });
  const after = state({ todayXp: 60, streak: 3, claimedQuestIds: ["quest-xp"] });
  const events = detectRewardEvents(before, after, false);
  assert.deepEqual(
    events.map((event) => event.kind),
    ["quest", "daily_goal", "streak"],
  );
  const quest = events[0];
  assert.equal(quest.kind === "quest" && quest.gems, 15);
});

test("reward events: nothing new means no celebration", () => {
  const same = state({ todayXp: 80, streak: 3, claimedQuestIds: ["quest-xp"] });
  assert.deepEqual(detectRewardEvents(same, { ...same, gems: same.gems + 5 }, false), []);
});

test("reward events: a day rollover only reports a streak gain", () => {
  const yesterday = state({ lastActiveDay: "2026-11-22", todayXp: 90, streak: 2, claimedQuestIds: ["quest-xp"] });
  const today = state({ lastActiveDay: "2026-11-23", todayXp: 10, streak: 3, claimedQuestIds: [] });
  assert.deepEqual(detectRewardEvents(yesterday, today, false), [{ kind: "streak", days: 3 }]);
});
