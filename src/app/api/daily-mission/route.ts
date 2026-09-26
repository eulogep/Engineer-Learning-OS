import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { startOfDay, subDays } from "date-fns";

/** GET /api/daily-mission — fetch or create today's mission with 10 words */
export async function GET() {
  try {
    const today = startOfDay(new Date());

    // Check if a mission already exists for today
    const existing = await db.dailyMission.findFirst({
      where: {
        date: {
          gte: new Date(today.getTime() - 24 * 60 * 60 * 1000),
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (existing) {
      const wordIds: string[] = JSON.parse(existing.wordIdsJson);
      const words = await db.word.findMany({
        where: { id: { in: wordIds } },
      });
      return NextResponse.json({ words, mission: existing });
    }

    // Select 10 words for rotation: prioritize words never used (lastUsedAt
    // null) or least-recently-used, so a fixed pool of N words naturally
    // cycles through everyone every ceil(N/10) days instead of always
    // returning the same first 10 by createdAt (the previous behavior —
    // status was never advanced past "nouveau" anywhere, so that filter
    // alone never rotated anything).
    // Tie-break by createdAt for determinism when lastUsedAt is equal (e.g.
    // multiple nulls on day one).
    const candidates = await db.word.findMany({
      where: {
        status: { in: ["nouveau", "actif"] },
      },
      orderBy: [{ lastUsedAt: "asc" }, { createdAt: "asc" }],
    });

    if (candidates.length < 10) {
      // Fallback: include maitrise words if not enough
      const more = await db.word.findMany({
        where: { id: { notIn: candidates.map((w) => w.id) } },
        orderBy: [{ lastUsedAt: "asc" }, { createdAt: "asc" }],
        take: 10 - candidates.length,
      });
      candidates.push(...more);
    }

    // Pick 10 (or all if fewer)
    const selected = candidates.slice(0, 10);
    const wordIds = selected.map((w) => w.id);

    // Create the daily mission, and mark the selected words as used today
    // (lastUsedAt) + advance "nouveau" -> "actif" so they drop out of the
    // front of the rotation queue for the next few days.
    const [mission] = await db.$transaction([
      db.dailyMission.create({
        data: {
          date: today,
          wordIdsJson: JSON.stringify(wordIds),
          personalSentencesJson: JSON.stringify({}),
        },
      }),
      db.word.updateMany({
        where: { id: { in: wordIds } },
        data: { lastUsedAt: today },
      }),
      db.word.updateMany({
        where: { id: { in: wordIds }, status: "nouveau" },
        data: { status: "actif" },
      }),
    ]);

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
    const { missionId, personalSentences, speakingSessionId, completed } = body;

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

    const mission = await db.dailyMission.update({
      where: { id: missionId },
      data: updateData,
    });

    return NextResponse.json({ mission });
  } catch (error) {
    console.error("Failed to update daily mission:", error);
    return NextResponse.json(
      { error: "Failed to update daily mission" },
      { status: 500 }
    );
  }
}