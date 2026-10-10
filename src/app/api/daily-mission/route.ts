import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfDay } from "date-fns";
import { DAILY_WORD_COUNT, calendarDayRange, dayKey, inMissionOrder } from "@/modules/daily-english/local-mission";
import { applyReview, isReviewOutcome, scheduleDailyWords, type ReviewState } from "@/modules/daily-english/spaced-review";
import { vocabularyEntry, vocabularyRank } from "@/modules/daily-english/vocabulary";

function reviewStateOf(word: { lastUsedAt: Date | null; nextReviewDate: Date | null }): ReviewState {
  // Words picked by the former rotation have lastUsedAt but no schedule: treat them as new.
  if (!word.lastUsedAt || !word.nextReviewDate) return { lastReviewedDay: null, nextReviewDay: null };
  return { lastReviewedDay: dayKey(word.lastUsedAt), nextReviewDay: dayKey(word.nextReviewDate) };
}

function dayStart(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

/** GET /api/daily-mission — fetch or create today's mission with 10 words */
export async function GET() {
  try {
    const today = startOfDay(new Date());

    // Check if a mission already exists for today
    const existing = await db.dailyMission.findFirst({
      where: {
        // Today's calendar day only: the former ±24h window also matched
        // yesterday's mission (dated at yesterday's midnight).
        date: { gte: calendarDayRange(today).start, lt: calendarDayRange(today).end },
      },
    });

    if (existing) {
      const wordIds: string[] = JSON.parse(existing.wordIdsJson);
      const rows = await db.word.findMany({
        where: { id: { in: wordIds } },
      });
      // Keep the mission's order so the list is stable across reloads.
      const words = inMissionOrder(wordIds, rows);
      return NextResponse.json({ words, mission: existing });
    }

    // Spaced review: due words first, then new words interleaved across
    // vocabulary packs. lastUsedAt / nextReviewDate are only written when the
    // mission is completed (see PATCH), so an unfinished day is simply retried.
    // Rows inserted by the setup script share one timestamp: follow the
    // curated vocabulary order, then creation order for custom words.
    const all = (await db.word.findMany({ orderBy: [{ createdAt: "asc" }, { id: "asc" }] }))
      .map((word, index) => ({ word, index }))
      .sort((a, b) => vocabularyRank(a.word.word) - vocabularyRank(b.word.word) || a.index - b.index)
      .map(({ word }) => word);
    const wordIds = scheduleDailyWords(
      all.map((word) => ({ id: word.id, group: vocabularyEntry(word.word)?.pack ?? "custom", review: reviewStateOf(word) })),
      dayKey(today),
      DAILY_WORD_COUNT,
    );
    const byId = new Map(all.map((word) => [word.id, word]));
    const selected = wordIds.flatMap((id) => byId.get(id) ?? []);

    // Word status only changes when the mission is completed and reviewed.
    const mission = await db.dailyMission.create({
      data: {
        date: today,
        wordIdsJson: JSON.stringify(wordIds),
        personalSentencesJson: JSON.stringify({}),
      },
    });

    return NextResponse.json({ words: selected, mission });
  } catch (error) {
    console.error("Failed to fetch daily mission:", error);
    return NextResponse.json(
      { error: "Failed to create daily mission" },
      { status: 500 }
    );
  }
}

/** PATCH /api/daily-mission — update mission (save sentences, mark completed, etc.) */
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { missionId, personalSentences, speakingSessionId, completed, reviews } = body;

    if (!missionId) {
      return NextResponse.json(
        { error: "missionId is required" },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (personalSentences !== undefined) {
      updateData.personalSentencesJson = JSON.stringify(personalSentences);
    }
    if (speakingSessionId !== undefined) {
      updateData.speakingSessionId = speakingSessionId;
    }
    if (completed !== undefined) {
      updateData.completed = completed;
    }

    const current = await db.dailyMission.findUnique({ where: { id: missionId } });
    if (!current) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    const mission = await db.dailyMission.update({
      where: { id: missionId },
      data: updateData,
    });

    // Apply spaced-review outcomes once, on first completion, and only to the
    // words that actually belong to this mission.
    if (completed === true && !current.completed && Array.isArray(reviews)) {
      const allowed = new Set<string>(JSON.parse(current.wordIdsJson));
      const valid = reviews.filter((review: unknown): review is { wordId: string; outcome: "SUCCESS" | "PARTIAL" | "FAIL" } =>
        typeof review === "object" && review !== null
        && typeof (review as { wordId?: unknown }).wordId === "string"
        && allowed.has((review as { wordId: string }).wordId)
        && isReviewOutcome((review as { outcome?: unknown }).outcome));
      const words = await db.word.findMany({ where: { id: { in: valid.map((review) => review.wordId) } } });
      const today = dayKey(new Date());
      await db.$transaction(words.map((word) => {
        const outcome = valid.find((review) => review.wordId === word.id)!.outcome;
        const next = applyReview(reviewStateOf(word), outcome, today);
        return db.word.update({
          where: { id: word.id },
          data: { status: next.status, lastUsedAt: dayStart(next.lastReviewedDay), nextReviewDate: dayStart(next.nextReviewDay) },
        });
      }));
    }

    return NextResponse.json({ mission });
  } catch (error) {
    console.error("Failed to update daily mission:", error);
    return NextResponse.json(
      { error: "Failed to update daily mission" },
      { status: 500 }
    );
  }
}