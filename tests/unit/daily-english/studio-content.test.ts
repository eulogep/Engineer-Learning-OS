import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_STUDIO_VOCABULARY,
  BONUS_VOCABULARY,
  BONUS_VOCABULARY_PACKS,
  ENGINEERING_STORIES,
  GRAMMAR_TRAPS,
  STUDIO_SHOP_ITEMS,
  computeStudioAchievements,
} from "../../../src/modules/daily-english/studio-content.ts";
import { VOCABULARY } from "../../../src/modules/daily-english/vocabulary.ts";
import { wordUsagePattern } from "../../../src/modules/daily-english/local-mission.ts";
import {
  DEFAULT_GAMIFICATION_STATE,
  buildBonusPathUnits,
  equipMascotAccessory,
  purchaseShopItem,
  recordBlitzRun,
  recordLessonCompletion,
  recordStoryCompletion,
  syncGamificationDay,
  wordsForPathNode,
} from "../../../src/modules/daily-english/gamification.ts";
import {
  editDistance,
  evaluateExerciseAnswer,
  generateGrammarDrillExercises,
} from "../../../src/modules/daily-english/exercise-generator.ts";

test("bonus vocabulary adds 90 unique engineering words with valid examples", () => {
  assert.equal(BONUS_VOCABULARY_PACKS.length, 3);
  assert.equal(BONUS_VOCABULARY.length, 90);
  assert.equal(ALL_STUDIO_VOCABULARY.length, 240);

  const allLower = ALL_STUDIO_VOCABULARY.map((w) => w.word.toLowerCase());
  assert.equal(new Set(allLower).size, allLower.length, "no duplicate words across core + bonus packs");

  const missingExample = BONUS_VOCABULARY.filter(
    (entry) => !wordUsagePattern(entry.word).test(entry.example),
  ).map((entry) => entry.word);
  assert.deepEqual(missingExample, []);
});

test("engineering stories and grammar traps are well-formed with valid answers", () => {
  assert.equal(ENGINEERING_STORIES.length, 6);
  for (const story of ENGINEERING_STORIES) {
    const checkpoints = story.steps.filter((s) => s.kind === "checkpoint");
    assert.ok(checkpoints.length >= 2, `${story.id} should have >= 2 checkpoints`);
    for (const cp of checkpoints) {
      assert.ok(cp.choices.includes(cp.correctAnswer), `${cp.id} answer must be in choices`);
    }
  }

  assert.equal(GRAMMAR_TRAPS.length, 16);
  for (const trap of GRAMMAR_TRAPS) {
    assert.notEqual(trap.wrongExample, trap.rightExample);
    assert.equal(trap.distractors.length, 2);
  }
});

test("grammar drill generates deterministic spot_error and type_answer exercises with typo tolerance", () => {
  const first = generateGrammarDrillExercises("seed-grammar-1");
  const second = generateGrammarDrillExercises("seed-grammar-1");
  assert.deepEqual(first, second);
  assert.equal(first.length, 8);

  const spotErrors = first.filter((e) => e.kind === "spot_error");
  const typeAnswers = first.filter((e) => e.kind === "type_answer");
  assert.equal(spotErrors.length, 6);
  assert.equal(typeAnswers.length, 2);

  for (const ex of spotErrors) {
    assert.equal(evaluateExerciseAnswer(ex, ex.correctAnswer).correct, true);
    assert.equal(evaluateExerciseAnswer(ex, ex.wrongSentence).correct, false);
  }

  const typed = typeAnswers[0];
  assert.equal(evaluateExerciseAnswer(typed, typed.correctAnswer).correct, true);
  // Single-char typo on 5+ letter words is accepted with almostCorrect flag
  if (typed.correctAnswer.length >= 5) {
    const typo = `${typed.correctAnswer.slice(0, -1)}${typed.correctAnswer.endsWith("a") ? "b" : "a"}`;
    const evaluated = evaluateExerciseAnswer(typed, typo);
    assert.equal(evaluated.correct, true);
    assert.equal(evaluated.almostCorrect, true);
  }
  assert.equal(editDistance("pipeline", "pipelime"), 1);
  assert.equal(editDistance("pipeline", "completely-different"), 3);
});

test("bonus path units resolve bonus vocabulary cleanly", () => {
  const bonusUnits = buildBonusPathUnits({});
  assert.equal(bonusUnits.length, 3);
  assert.equal(bonusUnits[0].unitNumber, 7);
  assert.equal(bonusUnits[0].nodes[0].state, "unlocked");
  assert.equal(bonusUnits[0].nodes[1].state, "locked");

  const words = wordsForPathNode(bonusUnits[0].nodes[0], VOCABULARY.slice(0, 10), VOCABULARY);
  assert.ok(words.length >= 4);
  assert.equal(words[0].packLabel, "Cloud & DevOps");
});

test("shop purchases, streak freeze protection, XP x2 boost, stories, blitz, and achievements work end-to-end", () => {
  let state = { ...DEFAULT_GAMIFICATION_STATE, gems: 200 };

  // Buy Streak Freeze
  const freezeRes = purchaseShopItem(state, "streak_freeze");
  assert.equal(freezeRes.ok, true);
  state = freezeRes.state;
  assert.equal(state.streakFreezes, 1);
  assert.equal(state.gems, 160);

  // Buy XP x2 Boost
  const boostRes = purchaseShopItem(state, "xp_boost");
  assert.equal(boostRes.ok, true);
  state = boostRes.state;
  assert.equal(state.xpBoostActive, true);

  // Complete a lesson -> XP is doubled and boost resets
  const lesson = recordLessonCompletion(state, {
    nodeId: "daily:2026-11-22:warmup",
    correctCount: 7,
    totalCount: 7,
    maxCombo: 7,
    baseXp: 20,
    today: "2026-11-22",
  });
  assert.equal(lesson.boosted, true);
  assert.equal(lesson.xpEarned, 84); // (20 + 12 + 10) * 2
  assert.equal(lesson.state.xpBoostActive, false);
  assert.equal(lesson.state.perfectLessonsCount, 1);
  state = lesson.state;

  // Skip 1 full day (22 -> 24): Streak Freeze auto-consumes and keeps streak = 1!
  const afterMissedDay = syncGamificationDay(state, "2026-11-24");
  assert.equal(afterMissedDay.streak, 1);
  assert.equal(afterMissedDay.streakFreezes, 0);
  state = afterMissedDay;

  // Complete a story on day 24 -> streak becomes 2
  const storyRes = recordStoryCompletion(state, {
    storyId: ENGINEERING_STORIES[0].id,
    xpReward: 30,
    today: "2026-11-24",
  });
  assert.equal(storyRes.state.streak, 2);
  assert.deepEqual(storyRes.state.completedStoryIds, [ENGINEERING_STORIES[0].id]);
  state = storyRes.state;

  // Play Speed Blitz -> personal best updates
  const blitz = recordBlitzRun(state, { score: 12, today: "2026-11-24" });
  assert.equal(blitz.isNewBest, true);
  assert.equal(blitz.state.bestBlitzScore, 12);
  state = blitz.state;

  // Buy and equip a mascot accessory
  const accRes = purchaseShopItem(state, "visor");
  assert.equal(accRes.ok, true);
  state = accRes.state;
  assert.equal(state.equippedAccessory, "visor");
  assert.equal(equipMascotAccessory(state, null).equippedAccessory, null);

  // Achievements reflect real progress
  const achievements = computeStudioAchievements({
    xp: state.xp,
    streak: state.streak,
    completedNodesCount: Object.keys(state.completedNodes).length,
    completedStoriesCount: state.completedStoryIds.length,
    bestBlitzScore: state.bestBlitzScore,
    perfectLessonsCount: state.perfectLessonsCount,
    grammarDrillsCompleted: 0,
    ownedAccessoriesCount: state.ownedAccessories.length,
    missionCompletedToday: false,
  });
  assert.equal(STUDIO_SHOP_ITEMS.length, 7);
  assert.equal(achievements.find((a) => a.id === "ach-first-step")?.unlocked, true);
  assert.equal(achievements.find((a) => a.id === "ach-blitz-10")?.unlocked, true);
  assert.equal(achievements.find((a) => a.id === "ach-style")?.unlocked, true);
});
