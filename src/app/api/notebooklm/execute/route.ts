import { handleNotebookLMExecute } from "@/modules/notebooklm/execute-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local-only bridge, disabled unless ELOS_NOTEBOOKLM_AUTOMATION=ENABLED is set on the server
// (see src/modules/notebooklm/automation-gate.ts). Only POST is exposed.
export async function POST(request: Request) {
  return handleNotebookLMExecute(request);
}
