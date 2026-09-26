import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import {
  EXTERNAL_ZAI_DISABLED_CODE,
  isExternalZaiServerProcessingEnabled,
} from "@/config/external-ai";

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

export async function POST(request: Request) {
  if (!isExternalZaiServerProcessingEnabled()) {
    return NextResponse.json(
      {
        code: EXTERNAL_ZAI_DISABLED_CODE,
        error: "Le traitement externe ZAI est désactivé pour les données réelles.",
      },
      { status: 403 },
    );
  }

  try {
    const body = await request.json();
    const { audioBase64, missionId, durationSeconds } = body;

    if (!audioBase64 || !missionId) {
      return NextResponse.json(
        { error: "audioBase64 and missionId are required" },
        { status: 400 }
      );
    }

    // Transcribe audio via ASR
    const zai = await getZAI();
    const response = await zai.audio.asr.create({
      file_base64: audioBase64,
    });

    const transcription = response.text || "";

    if (!transcription.trim()) {
      return NextResponse.json(
        { error: "Transcription vide — réessayez en parlant plus fort ou plus près du micro." },
        { status: 422 }
      );
    }

    // Save the speaking session to DB
    const session = await db.speakingSession.create({
      data: {
        transcription,
        durationSeconds: durationSeconds || 0,
        repeated: false,
      },
    });

    // Link session to the daily mission
    if (missionId) {
      await db.dailyMission.update({
        where: { id: missionId },
        data: { speakingSessionId: session.id },
      }).catch((err) => {
        // Non-fatal: the DoneStep will also try to link
        console.error("Failed to link session to mission:", err);
      });
    }

    return NextResponse.json({
      session,
      transcription,
    });
  } catch (error) {
    console.error("Speaking session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur de transcription" },
      { status: 500 }
    );
  }
}
