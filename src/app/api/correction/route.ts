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

const SYSTEM_PROMPT = `You are an English teacher helping a French speaker improve their spoken English.

The user recorded themselves speaking in English for 2 minutes, trying to use specific vocabulary words in personal sentences. Their speech was automatically transcribed.

Your job:
1. Correct any grammar, vocabulary, or expression errors in the transcription. Produce a clean, natural-sounding corrected version.
2. Identify the 2 or 3 most important errors (grammar mistakes, wrong word usage, unnatural phrasing). For each error, provide the original fragment, the corrected version, and a brief explanation in FRENCH.

Respond ONLY with valid JSON in this exact format, no extra text:
{
  "correctedText": "The full corrected version of the transcription...",
  "errors": [
    {
      "original": "the exact wrong fragment from the transcription",
      "corrected": "the correct version",
      "explanation": "Explication en français de l'erreur"
    }
  ]
}

Rules:
- Keep the user's voice and meaning intact. Only fix actual errors.
- If the transcription is already good English, still produce the correctedText (it may be identical) and explain that the English was very good, with 1-2 minor tips.
- errors array must have exactly 2 or 3 items.
- All explanations must be in French.
- Return ONLY the JSON object, nothing else.`;

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

  let sessionId: string | undefined;
  let correctedTextToSave: string | undefined;
  let feedbackToSave: string | undefined;

  try {
    const body = await request.json();
    const { transcription, personalSentences, words } = body;
    sessionId = body.sessionId;

    if (!transcription) {
      return NextResponse.json(
        { error: "transcription is required" },
        { status: 400 }
      );
    }

    // Build context with the words and their sentences
    let context = "";
    if (words && personalSentences) {
      const lines = words.map(
        (w: { word: string; id: string }) =>
          `- ${w.word}: ${personalSentences[w.id] || "(no sentence)"}`
      );
      context = `\n\nThe user was trying to use these words in personal sentences:\n${lines.join("\n")}`;
    }

    const zai = await getZAI();

    const completion = await zai.chat.completions.create({
      model: "glm-4.7-flash",
      messages: [
        { role: "assistant", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Here is the transcription of the user's speech:\n\n"${transcription}"${context}`,
        },
      ],
      thinking: { type: "disabled" },
    });

    const raw = completion.choices[0]?.message?.content || "";

    // Parse JSON from the response (handle possible markdown wrapping)
    let jsonStr = raw.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr) as {
      correctedText: string;
      errors: { original: string; corrected: string; explanation: string }[];
    };

    if (!parsed.correctedText || !Array.isArray(parsed.errors)) {
      throw new Error("Invalid LLM response structure");
    }

    const errors = parsed.errors.slice(0, 3);

    // Prepare DB save values
    correctedTextToSave = parsed.correctedText;
    feedbackToSave = JSON.stringify({ errors });

    return NextResponse.json({
      correctedText: parsed.correctedText,
      feedback: { errors },
    });
  } catch (error) {
    console.error("Correction error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erreur lors de la correction",
      },
      { status: 500 }
    );
  } finally {
    // Persist correction to the speaking session in DB
    if (sessionId && correctedTextToSave) {
      try {
        await db.speakingSession.update({
          where: { id: sessionId },
          data: {
            correctedText: correctedTextToSave,
            feedback: feedbackToSave,
          },
        });
      } catch (dbErr) {
        console.error("Failed to persist correction:", dbErr);
      }
    }
  }
}
