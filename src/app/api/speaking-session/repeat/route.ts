import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, durationSeconds } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId is required" },
        { status: 400 }
      );
    }

    // Verify the session exists
    const session = await db.speakingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session introuvable" },
        { status: 404 }
      );
    }

    // Mark the session as repeated (user completed the repeat step).
    // Note: the repeat recording's duration is stored in repeatDurationSeconds,
    // NOT in durationSeconds — that field holds the ORIGINAL recording's duration
    // (ticket 4) and must not be overwritten, since DoneStep's stats read it.
    const updated = await db.speakingSession.update({
      where: { id: sessionId },
      data: {
        repeated: true,
        ...(durationSeconds != null
          ? { repeatDurationSeconds: durationSeconds }
          : {}),
      },
    });

    return NextResponse.json({
      session: updated,
      success: true,
    });
  } catch (error) {
    console.error("Repeat session error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erreur lors de la répétition",
      },
      { status: 500 }
    );
  }
}