import { NextResponse } from "next/server";
import { evaluateHeldOutExcel } from "@/modules/held-out-excel/server-evaluator";
import type { HeldOutExcelAnswers } from "@/modules/held-out-excel/types";

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  const candidate = body as Record<string, unknown>;
  if (typeof candidate.delimiter !== "string" || typeof candidate.anomalyId !== "string" || typeof candidate.explanation !== "string"
    || candidate.delimiter.length > 32 || candidate.anomalyId.length > 64 || candidate.explanation.length > 2_000) {
    return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  }
  const answers: HeldOutExcelAnswers = { delimiter: candidate.delimiter, anomalyId: candidate.anomalyId, explanation: candidate.explanation };
  return NextResponse.json(evaluateHeldOutExcel(answers), { headers: { "Cache-Control": "no-store" } });
}
