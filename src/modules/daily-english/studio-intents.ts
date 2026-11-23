/**
 * Entry choices of the Daily English studio.
 *
 * Instead of dropping the learner on a fixed screen, the studio asks
 * "what do you want to do, and how much time do you have?" and recommends
 * one activity from the learner's real local state. Pure and deterministic.
 */

export type StudioIntentId = "continue_path" | "speak" | "story" | "blitz" | "grammar" | "review";

/** Minutes the learner says they have right now. */
export type TimeBudget = 2 | 5 | 15;

export const TIME_BUDGETS: readonly TimeBudget[] = [2, 5, 15];

export type StudioIntent = Readonly<{
  id: StudioIntentId;
  title: string;
  description: string;
  /** Typical duration in minutes. */
  minutes: number;
}>;

export const STUDIO_INTENTS: readonly StudioIntent[] = [
  {
    id: "continue_path",
    title: "Avancer mon parcours",
    description: "La prochaine leçon de ton parcours, avec les mots du jour.",
    minutes: 4,
  },
  {
    id: "speak",
    title: "Parler à l'oral",
    description: "Oral guidé en 6 étapes : mots, phrases, prise de parole, correction.",
    minutes: 12,
  },
  {
    id: "story",
    title: "Lire une histoire",
    description: "Un dialogue d'ingénieur avec audio et questions de compréhension.",
    minutes: 3,
  },
  {
    id: "blitz",
    title: "Jouer 60 secondes",
    description: "Traduis un maximum de termes techniques avant la fin du chrono.",
    minutes: 1,
  },
  {
    id: "grammar",
    title: "Chasser mes pièges",
    description: "Les erreurs typiques des francophones, corrigées une par une.",
    minutes: 4,
  },
  {
    id: "review",
    title: "Révision éclair",
    description: "Un mélange d'exercices sur tout le vocabulaire déjà vu.",
    minutes: 5,
  },
];

export type IntentContext = Readonly<{
  timeBudget: TimeBudget;
  lessonsCompletedToday: number;
  missionCompletedToday: boolean;
  storiesCompleted: number;
  storiesTotal: number;
  hearts: number;
  /** Title of the next lesson on the path, or null when the path is finished. */
  nextLessonTitle: string | null;
}>;

export type RankedIntent = Readonly<{
  intent: StudioIntent;
  /** Fits in the time the learner has. */
  fits: boolean;
  recommended: boolean;
  /** Why this one is recommended (only set on the recommended intent). */
  reason: string | null;
}>;

function available(id: StudioIntentId, ctx: IntentContext): boolean {
  if (id === "continue_path") return ctx.nextLessonTitle !== null && ctx.hearts > 0;
  if (id === "story") return ctx.storiesCompleted < ctx.storiesTotal;
  if (id === "speak") return !ctx.missionCompletedToday;
  return true;
}

function pickRecommendation(ctx: IntentContext): { id: StudioIntentId; reason: string } {
  if (ctx.timeBudget === 2) {
    return { id: "blitz", reason: "Deux minutes suffisent pour une partie chrono." };
  }
  if (ctx.lessonsCompletedToday === 0 && available("continue_path", ctx)) {
    return { id: "continue_path", reason: "Tu n'as pas encore fait de leçon aujourd'hui." };
  }
  if (ctx.hearts === 0) {
    return {
      id: "story",
      reason: "Plus de cœurs pour les leçons : une histoire n'en consomme aucun.",
    };
  }
  if (ctx.timeBudget === 15 && available("speak", ctx)) {
    return { id: "speak", reason: "Tu as le temps : l'oral est ce qui fait le plus progresser." };
  }
  if (available("story", ctx)) {
    return { id: "story", reason: "Une histoire change du vocabulaire isolé." };
  }
  if (available("continue_path", ctx)) {
    return { id: "continue_path", reason: "Ton parcours t'attend." };
  }
  return { id: "review", reason: "Tout est fait : consolide ce que tu as vu." };
}

/** Rank the entry choices: the recommended one first, then those that fit the time budget. */
export function rankStudioIntents(ctx: IntentContext): RankedIntent[] {
  const rec = pickRecommendation(ctx);
  // A story is recommended when hearts are empty even if all are read: fall back to review.
  const recommendedId = available(rec.id, ctx) ? rec.id : "review";
  const reason = recommendedId === rec.id ? rec.reason : "Consolide ce que tu as déjà vu.";

  const ranked = STUDIO_INTENTS.filter((intent) => available(intent.id, ctx) || intent.id === recommendedId).map(
    (intent): RankedIntent => ({
      intent,
      fits: intent.minutes <= ctx.timeBudget,
      recommended: intent.id === recommendedId,
      reason: intent.id === recommendedId ? reason : null,
    }),
  );

  return ranked.sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    if (a.fits !== b.fits) return a.fits ? -1 : 1;
    return 0;
  });
}
