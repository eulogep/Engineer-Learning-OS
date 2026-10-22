import assert from "node:assert/strict";
import test from "node:test";
import { ROLEPLAY_SCENARIOS, evaluateTurn, scenarioScore } from "../../../src/modules/daily-english/roleplay.ts";

const standup = ROLEPLAY_SCENARIOS.find((scenario) => scenario.id === "standup")!;

test("scenarios are hand-written, complete and their model answers meet every goal", () => {
  assert.equal(ROLEPLAY_SCENARIOS.length, 3);
  for (const scenario of ROLEPLAY_SCENARIOS) {
    assert.ok(scenario.turns.length >= 3, scenario.id);
    for (const turn of scenario.turns) {
      const feedback = evaluateTurn(turn, turn.modelAnswer);
      assert.ok(feedback.goals.every((goal) => goal.met), `${turn.id}: ${JSON.stringify(feedback.goals)}`);
      assert.ok(feedback.score >= 85, `${turn.id} model answer scored ${feedback.score}`);
    }
  }
});

test("an off-task answer misses the communicative goals", () => {
  const feedback = evaluateTurn(standup.turns[0], "I like pizza and football very much indeed.");
  assert.ok(feedback.goals.every((goal) => !goal.met));
  assert.ok(feedback.score < 40);
});

test("goals match whole words only", () => {
  const feedback = evaluateTurn(standup.turns[1], "Tomorrow I will deploy the update.");
  assert.equal(feedback.goals.find((goal) => goal.label === "aujourd’hui")?.met, false);
  assert.equal(feedback.goals.find((goal) => goal.label === "futur")?.met, true);
});

test("frequent errors are corrected with French explanations", () => {
  const feedback = evaluateTurn(standup.turns[2], "Yes i am blocked since 2 days, i am agree it depend of the access.");
  assert.ok(feedback.corrections.length >= 3);
  assert.match(feedback.correctedText, /for 2 days/);
  assert.match(feedback.correctedText, /depend on/);
});

test("empty answers score zero; scenario score is the mean", () => {
  assert.equal(evaluateTurn(standup.turns[0], "   ").score, 0);
  assert.equal(scenarioScore([]), 0);
  assert.equal(scenarioScore([evaluateTurn(standup.turns[0], standup.turns[0].modelAnswer), evaluateTurn(standup.turns[1], "")]), Math.round(evaluateTurn(standup.turns[0], standup.turns[0].modelAnswer).score / 2));
});
