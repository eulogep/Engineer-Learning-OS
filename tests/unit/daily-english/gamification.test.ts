import assert from "node:assert/strict";
import test from "node:test";
import {
  DAILY_NODE_RETENTION_DAYS,
  DEFAULT_GAMIFICATION_STATE,
  GAMIFICATION_STATE_KEY,
  MAX_HEARTS,
  buildDailyQuests,
  claimCompletedQuests,
  buildLearningPathUnits,
  consumeHeart,
  readGamificationState,
  recordLessonCompletion,
  refillHearts,
  sanitizeCompletedNodes,
  syncGamificationDay,
  updateOnboardingPreferences,
  wordsForPathNode,
  writeGamificationState,
} from "../../../src/modules/daily-english/gamification.ts";
import {
  evaluateExerciseAnswer,
  generateLessonExercises,
  normalizeAnswer,
} from "../../../src/modules/daily-english/exercise-generator.ts";
import { VOCABULARY, type VocabularyWord } from "../../../src/modules/daily-english/vocabulary.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

test("gamification records XP, combo & perfect bonuses, gems, and streak", () => {
  const result = recordLessonCompletion(DEFAULT_GAMIFICATION_STATE, {
    nodeId: "daily:2026-11-22:warmup",
    correctCount: 7,
    totalCount: 7,
    maxCombo: 7,
    baseXp: 20,
    today: "2026-11-22",
  });

  assert.equal(result.accuracy, 100);
  assert.equal(result.stars, 3);
  assert.equal(result.perfectBonus, 10);
  assert.equal(result.comboBonus, 12);
  assert.equal(result.xpEarned, 42);
  assert.equal(result.gemsEarned, 20);
  assert.equal(result.state.streak, 1);
  assert.equal(result.state.todayXp, 42);
  assert.equal(result.state.lessonsCompletedToday, 1);
  assert.equal(result.state.completedNodes["daily:2026-11-22:warmup"]?.stars, 3);
});

test("gamification streak continues on consecutive day and resets after a gap", () => {
  const day1 = recordLessonCompletion(DEFAULT_GAMIFICATION_STATE, {
    nodeId: "daily:2026-11-22:warmup",
    correctCount: 6,
    totalCount: 7,
    maxCombo: 4,
    today: "2026-11-22",
  }).state;

  const day2Synced = syncGamificationDay(day1, "2026-11-23");
  assert.equal(day2Synced.streak, 1);
  assert.equal(day2Synced.todayXp, 0);
  assert.equal(day2Synced.hearts, MAX_HEARTS);

  const day2Done = recordLessonCompletion(day2Synced, {
    nodeId: "daily:2026-11-23:warmup",
    correctCount: 7,
    totalCount: 7,
    maxCombo: 7,
    today: "2026-11-23",
  }).state;
  assert.equal(day2Done.streak, 2);

  const afterGap = syncGamificationDay(day2Done, "2026-11-26");
  assert.equal(afterGap.streak, 0);
});

test("hearts decrement cleanly to zero and refill up to MAX_HEARTS", () => {
  let state = DEFAULT_GAMIFICATION_STATE;
  for (let i = 0; i < 8; i += 1) state = consumeHeart(state);
  assert.equal(state.hearts, 0);

  state = refillHearts(state);
  assert.equal(state.hearts, MAX_HEARTS);
});

test("gamification state round-trips through storage and degrades on corruption", () => {
  const storage = memoryStorage();
  const customized = updateOnboardingPreferences(DEFAULT_GAMIFICATION_STATE, {
    completed: true,
    focusTrack: "cybersecurity",
    dailyGoalXp: 100,
    soundEnabled: false,
  });
  writeGamificationState(storage, customized);

  const restored = readGamificationState(storage, "2026-11-22");
  assert.equal(restored.onboarding.completed, true);
  assert.equal(restored.onboarding.focusTrack, "cybersecurity");
  assert.equal(restored.onboarding.dailyGoalXp, 100);
  assert.equal(restored.onboarding.soundEnabled, false);

  const corrupted = readGamificationState(memoryStorage({ [GAMIFICATION_STATE_KEY]: "{" }), "2026-11-22");
  assert.deepEqual(corrupted, DEFAULT_GAMIFICATION_STATE);
  assert.equal(readGamificationState(null, "2026-11-22"), DEFAULT_GAMIFICATION_STATE);
});

test("learning path prioritizes chosen focus track and updates node states", () => {
  const unitsInitial = buildLearningPathUnits({}, {}, "2026-11-22", "cybersecurity", false);
  assert.equal(unitsInitial.length, 6);
  assert.equal(unitsInitial[0].packId, "daily");
  assert.equal(unitsInitial[1].packId, "cybersecurity");
  assert.equal(unitsInitial[0].nodes[0].state, "current");

  const doneNodeId = unitsInitial[0].nodes[0].id;
  const unitsAfter = buildLearningPathUnits(
    {},
    { [doneNodeId]: { completedAt: "2026-11-22T10:00:00Z", xpEarned: 25, accuracy: 100, stars: 3 } },
    "2026-11-22",
    "cybersecurity",
    false,
  );
  assert.equal(unitsAfter[0].nodes[0].state, "completed");
  assert.equal(unitsAfter[0].nodes[1].state, "current");
  assert.equal(unitsAfter[0].completedCount, 1);

  const words = wordsForPathNode(unitsInitial[1].nodes[0], VOCABULARY.slice(0, 10), VOCABULARY);
  assert.ok(words.length >= 4);
  assert.ok(words.every((w) => w.pack === "cybersecurity"));
});

test("daily quests reflect XP goal, lessons completed, and guided mission completion", () => {
  const progressed = recordLessonCompletion(DEFAULT_GAMIFICATION_STATE, {
    nodeId: "daily:2026-11-22:warmup",
    correctCount: 7,
    totalCount: 7,
    maxCombo: 7,
    baseXp: 35,
    today: "2026-11-22",
  }).state;
  const quests = buildDailyQuests(progressed, true);
  assert.equal(quests.length, 3);
  assert.equal(quests[0].completed, true); // 35 + 12 + 10 = 57 >= 50
  assert.equal(quests[1].current, 1);
  assert.equal(quests[2].completed, true);
});

test("exercise generator creates deterministic varied lessons for every node kind", () => {
  const slice = VOCABULARY.slice(0, 10);
  const kinds = ["warmup", "word_bank", "match_pairs", "listening", "checkpoint"] as const;

  for (const kind of kinds) {
    const first = generateLessonExercises(slice, kind, "seed-test-1", VOCABULARY);
    const second = generateLessonExercises(slice, kind, "seed-test-1", VOCABULARY);
    assert.ok(first.length >= 6, `expected >= 6 exercises for ${kind}`);
    assert.deepEqual(first, second, `expected deterministic generation for ${kind}`);

    for (const ex of first) {
      if (ex.kind === "translate_choice" || ex.kind === "listening_choice" || ex.kind === "fill_blank") {
        assert.equal(ex.choices.length, 4);
        assert.ok(ex.choices.includes(ex.correctAnswer));
        assert.equal(evaluateExerciseAnswer(ex, ex.correctAnswer).correct, true);
        assert.equal(evaluateExerciseAnswer(ex, "totally-wrong-answer").correct, false);
      } else if (ex.kind === "word_bank") {
        assert.ok(ex.bankTokens.length >= ex.expectedTokens.length);
        assert.equal(evaluateExerciseAnswer(ex, ex.expectedTokens).correct, true);
        assert.equal(evaluateExerciseAnswer(ex, ["wrong"]).correct, false);
      } else if (ex.kind === "match_pairs") {
        assert.equal(ex.pairs.length, 5);
        assert.equal(ex.shuffledFrench.length, 5);
        assert.equal(evaluateExerciseAnswer(ex, "MATCHED_ALL").correct, true);
      }
    }
  }
});

test("normalizeAnswer tolerates case, spacing, apostrophes, and trailing punctuation", () => {
  assert.equal(normalizeAnswer("  I’m   ready! "), "i'm ready");
  assert.equal(normalizeAnswer("BandWidth."), "bandwidth");
});

const completion = (overrides: Record<string, unknown> = {}) => ({
  completedAt: "2026-11-01T10:00:00Z",
  xpEarned: 30,
  accuracy: 90,
  stars: 2,
  ...overrides,
});

test("stored completions are validated and stale daily nodes are pruned", () => {
  const today = "2026-11-22";
  const cleaned = sanitizeCompletedNodes(
    {
      "daily:2026-11-20:warmup": completion(),
      "daily:2026-09-01:warmup": completion(),
      "core:lesson-1": completion({ completedAt: "2025-01-01T00:00:00Z" }),
      "core:lesson-2": completion({ stars: 7 }),
      "core:lesson-3": completion({ accuracy: 140 }),
      "core:lesson-4": "not-an-object",
    },
    today,
  );
  assert.deepEqual(Object.keys(cleaned).sort(), ["core:lesson-1", "daily:2026-11-20:warmup"]);
  assert.deepEqual(sanitizeCompletedNodes([completion()], today), {});

  const boundary = `daily:2026-10-23:warmup`; // exactly DAILY_NODE_RETENTION_DAYS days old
  assert.equal(DAILY_NODE_RETENTION_DAYS, 30);
  assert.ok(sanitizeCompletedNodes({ [boundary]: completion() }, today)[boundary]);
});

test("reading storage drops malformed fields instead of trusting them", () => {
  const storage = memoryStorage({
    [GAMIFICATION_STATE_KEY]: JSON.stringify({
      version: 1,
      xp: -10,
      gems: "lots",
      hearts: 99,
      streak: 4,
      lastActiveDay: "yesterday",
      completedNodes: { "core:lesson-1": { stars: 3 } },
      claimedQuestIds: ["quest-xp", 42],
      onboarding: { completed: true, focusTrack: "rocket-science", dailyGoalXp: 7 },
    }),
  });
  const state = readGamificationState(storage, "2026-11-22");
  assert.equal(state.xp, 0);
  assert.equal(state.gems, 50);
  assert.equal(state.hearts, MAX_HEARTS);
  assert.equal(state.lastActiveDay, null);
  assert.equal(state.streak, 0, "an unknown last active day cannot keep a streak alive");
  assert.deepEqual(state.completedNodes, {});
  assert.deepEqual(state.claimedQuestIds, [], "claims from an unknown day are reset");
  assert.equal(state.onboarding.focusTrack, "all");
  assert.equal(state.onboarding.dailyGoalXp, 50);
});

test("completed quests grant their gems exactly once per day", () => {
  const today = "2026-11-22";
  const afterLessons = [1, 2].reduce(
    (state, n) =>
      recordLessonCompletion(state, {
        nodeId: `core:lesson-${n}`,
        correctCount: 7,
        totalCount: 7,
        maxCombo: 7,
        baseXp: 20,
        today,
      }).state,
    DEFAULT_GAMIFICATION_STATE,
  );
  const gemsBefore = afterLessons.gems;

  const first = claimCompletedQuests(afterLessons, false, today);
  assert.deepEqual(
    first.claimedQuests.map((q) => q.id).sort(),
    ["quest-lessons", "quest-xp"],
  );
  assert.equal(first.gemsAwarded, 15 + 20);
  assert.equal(first.state.gems, gemsBefore + 35);
  assert.ok(buildDailyQuests(first.state, false).filter((q) => q.completed).every((q) => q.claimed));

  const again = claimCompletedQuests(first.state, false, today);
  assert.equal(again.gemsAwarded, 0);
  assert.equal(again.state.gems, first.state.gems);

  const mission = claimCompletedQuests(again.state, true, today);
  assert.deepEqual(mission.claimedQuests.map((q) => q.id), ["quest-mission"]);
  assert.equal(mission.gemsAwarded, 30);

  const nextDay = claimCompletedQuests(mission.state, false, "2026-11-23");
  assert.equal(nextDay.gemsAwarded, 0);
  assert.deepEqual(nextDay.state.claimedQuestIds, []);
  assert.ok(buildDailyQuests(nextDay.state, false).every((q) => !q.claimed && !q.completed));
});

test("match pairs never repeat an English term or a French translation", () => {
  const base = VOCABULARY[0];
  const clashing: VocabularyWord[] = [
    base,
    { ...base, word: `${base.word} again` }, // same translation
    { ...base, translation: `${base.translation} bis` }, // same English term
    ...VOCABULARY.slice(1, 3),
  ];
  for (const kind of ["warmup", "match_pairs", "checkpoint"] as const) {
    const exercises = generateLessonExercises(clashing, kind, "pairs-seed", VOCABULARY);
    const pairSets = exercises.filter((ex) => ex.kind === "match_pairs");
    assert.ok(pairSets.length > 0);
    for (const ex of pairSets) {
      const english = ex.pairs.map((p) => normalizeAnswer(p.english));
      const french = ex.pairs.map((p) => normalizeAnswer(p.french));
      assert.equal(ex.pairs.length, 5, "short target lists are topped up from the pool");
      assert.equal(new Set(english).size, english.length);
      assert.equal(new Set(french).size, french.length);
      assert.deepEqual([...ex.shuffledFrench].sort(), ex.pairs.map((p) => p.french).sort());
    }
  }
});
