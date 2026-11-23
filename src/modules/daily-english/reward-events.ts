/**
 * Reward moments of the Daily English studio.
 *
 * The studio is calm by default; colour and motion are reserved for the
 * moments when the learner earns something. This pure function compares two
 * gamification states and lists those moments.
 */
import { buildDailyQuests, type GamificationState } from "./gamification";

export type RewardEvent =
  | Readonly<{ kind: "quest"; questId: string; title: string; gems: number }>
  | Readonly<{ kind: "daily_goal"; goalXp: number }>
  | Readonly<{ kind: "streak"; days: number }>;

export function detectRewardEvents(
  previous: GamificationState,
  next: GamificationState,
  missionCompletedToday: boolean,
): RewardEvent[] {
  // A new day resets counters: comparing across the rollover would only produce noise.
  if (previous.lastActiveDay !== null && next.lastActiveDay !== previous.lastActiveDay) {
    return next.streak > previous.streak ? [{ kind: "streak", days: next.streak }] : [];
  }

  const events: RewardEvent[] = [];
  const alreadyClaimed = new Set(previous.claimedQuestIds);
  const quests = buildDailyQuests(next, missionCompletedToday);
  for (const questId of next.claimedQuestIds) {
    if (alreadyClaimed.has(questId)) continue;
    const quest = quests.find((candidate) => candidate.id === questId);
    if (quest) events.push({ kind: "quest", questId, title: quest.title, gems: quest.rewardGems });
  }

  const goal = next.onboarding.dailyGoalXp;
  if (previous.todayXp < goal && next.todayXp >= goal) {
    events.push({ kind: "daily_goal", goalXp: goal });
  }

  if (next.streak > previous.streak) {
    events.push({ kind: "streak", days: next.streak });
  }

  return events;
}
