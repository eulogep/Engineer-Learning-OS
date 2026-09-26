import { runControlledLegacyProvider, validateControlledPilotPlan } from "@/modules/notebooklm/server-runner";
import type { LegacyNotebookLMOperation } from "@/modules/notebooklm/legacy-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { plan?: unknown; operation?: LegacyNotebookLMOperation };
    const plan = validateControlledPilotPlan(body.plan);
    const result = await runControlledLegacyProvider(plan, body.operation ?? "EXECUTE");
    const status = !Array.isArray(result) && result.status === "HUMAN_LOGIN_REQUIRED" ? 401 : 200;
    return Response.json(result, { status });
  } catch (error) {
    const detailCode = error instanceof Error ? error.message : "CONTROLLED_EXECUTION_REJECTED";
    return Response.json({ status: "AUTOMATION_FAILED", detailCode }, { status: 400 });
  }
}
