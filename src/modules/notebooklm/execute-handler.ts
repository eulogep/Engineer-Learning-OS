import { evaluateNotebookLMAutomationRequest } from "./automation-gate";
import type { LegacyNotebookLMOperation } from "./legacy-provider";
import { runControlledLegacyProvider, validateControlledPilotPlan, type ControlledRunnerDeps } from "./server-runner";

export type ExecuteHandlerDeps = {
  env?: Readonly<Record<string, string | undefined>>;
  runner?: Partial<ControlledRunnerDeps>;
};

/**
 * Body of POST /api/notebooklm/execute, kept out of the route file so it can be tested.
 * Order matters: the gate runs first, so a disabled or untrusted request is refused before its body
 * is read, its plan is validated or anything is spawned. The existing controlled path (plan
 * validation, manifest hashing, file-boundary checks, operation allowlist) is unchanged after it.
 */
export async function handleNotebookLMExecute(request: Request, deps: ExecuteHandlerDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const gate = evaluateNotebookLMAutomationRequest(request, env);
  if (!gate.allowed) return Response.json({ status: "AUTOMATION_FAILED", detailCode: gate.detailCode }, { status: gate.status });

  try {
    const body = await request.json() as { plan?: unknown; operation?: LegacyNotebookLMOperation };
    const plan = validateControlledPilotPlan(body.plan);
    const result = await runControlledLegacyProvider(plan, body.operation ?? "EXECUTE", { ...deps.runner, env: env as NodeJS.ProcessEnv });
    const status = !Array.isArray(result) && result.status === "HUMAN_LOGIN_REQUIRED" ? 401 : 200;
    return Response.json(result, { status });
  } catch (error) {
    const detailCode = error instanceof Error ? error.message : "CONTROLLED_EXECUTION_REJECTED";
    return Response.json({ status: "AUTOMATION_FAILED", detailCode }, { status: 400 });
  }
}
