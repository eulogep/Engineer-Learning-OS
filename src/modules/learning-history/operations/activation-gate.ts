export const HYBRID_ACTIVATION_SCENARIOS = [
  "CANONICAL_EXPORT",
  "FRESH_RESTORE",
  "PROJECTION_REBUILD",
  "LOCAL_ROLLBACK",
  "ADDITIVE_MIGRATION",
  "SHADOW_COMPARISON",
  "OFFLINE",
  "RECONNECT",
  "DUPLICATE_DELIVERY",
  "LOST_ACK",
  "MULTI_DEVICE",
  "STALE_DEVICE",
  "REVOCATION",
  "DELETION",
  "TOMBSTONE",
  "AUTH_FAILURE",
  "PROVIDER_OUTAGE",
  "REMOTE_CORRUPTION",
  "SCHEMA_VERSION_MISMATCH",
  "BACKUP_RESTORE",
  "DEVICE_REPLACEMENT",
  "INDEPENDENT_QA",
  "SECURITY_REVIEW",
] as const;

export type HybridActivationScenario = typeof HYBRID_ACTIVATION_SCENARIOS[number];
export type ActivationEnvironment = "LOCAL_SYNTHETIC" | "HOSTED_SUPABASE";

export const HOSTED_CONFIRMATION_SCENARIOS: ReadonlySet<HybridActivationScenario> = new Set([
  "ADDITIVE_MIGRATION",
  "SHADOW_COMPARISON",
  "AUTH_FAILURE",
  "PROVIDER_OUTAGE",
  "REMOTE_CORRUPTION",
  "SCHEMA_VERSION_MISMATCH",
  "BACKUP_RESTORE",
  "DEVICE_REPLACEMENT",
]);

export type ActivationEvidence = Readonly<{
  scenario: HybridActivationScenario;
  environment: ActivationEnvironment;
  result: "PASS" | "FAIL";
  deterministic: boolean;
  expectedOutcome: string;
  actualOutcome: string;
  evidenceRef: string;
}>;

export type HybridActivationGate = Readonly<{
  status: "FAIL" | "WAITING_FOR_HOSTED_EVIDENCE" | "READY_FOR_HUMAN_DECISION";
  localSyntheticComplete: boolean;
  hostedConfirmationComplete: boolean;
  productionActivationAllowed: false;
  failed: readonly string[];
  missing: readonly string[];
}>;

function evidenceKey(evidence: Pick<ActivationEvidence, "scenario" | "environment">): string {
  return `${evidence.environment}:${evidence.scenario}`;
}

export function evaluateHybridActivationGate(evidence: readonly ActivationEvidence[]): HybridActivationGate {
  const known = new Set<string>(HYBRID_ACTIVATION_SCENARIOS);
  const seen = new Set<string>();
  const failed: string[] = [];

  for (const item of evidence) {
    if (!known.has(item.scenario)) throw new Error("Unknown activation scenario.");
    const key = evidenceKey(item);
    if (seen.has(key)) throw new Error("Duplicate activation evidence.");
    seen.add(key);
    if (!item.deterministic || !item.expectedOutcome.trim() || !item.actualOutcome.trim()
      || !item.evidenceRef.trim() || item.result === "FAIL") failed.push(key);
  }

  const requiredLocal = HYBRID_ACTIVATION_SCENARIOS.map(
    (scenario) => evidenceKey({ scenario, environment: "LOCAL_SYNTHETIC" }),
  );
  const requiredHosted = [...HOSTED_CONFIRMATION_SCENARIOS].map(
    (scenario) => evidenceKey({ scenario, environment: "HOSTED_SUPABASE" }),
  );
  const missing = [...requiredLocal, ...requiredHosted].filter((key) => !seen.has(key));
  const localSyntheticComplete = requiredLocal.every((key) => seen.has(key) && !failed.includes(key));
  const hostedConfirmationComplete = requiredHosted.every((key) => seen.has(key) && !failed.includes(key));

  return Object.freeze({
    status: failed.length || !localSyntheticComplete
      ? "FAIL"
      : hostedConfirmationComplete ? "READY_FOR_HUMAN_DECISION" : "WAITING_FOR_HOSTED_EVIDENCE",
    localSyntheticComplete,
    hostedConfirmationComplete,
    productionActivationAllowed: false,
    failed: Object.freeze(failed.sort()),
    missing: Object.freeze(missing.sort()),
  });
}

export type HybridActivationDecision = "APPROVED" | "REJECTED";

export type AuthorizedHybridActivation = Readonly<{
  status: "ACTIVE" | "BLOCKED";
  productionActivationAllowed: boolean;
}>;

export function authorizeHybridActivation(
  gate: HybridActivationGate,
  decision: HybridActivationDecision,
): AuthorizedHybridActivation {
  const allowed = gate.status === "READY_FOR_HUMAN_DECISION"
    && gate.localSyntheticComplete
    && gate.hostedConfirmationComplete
    && gate.failed.length === 0
    && gate.missing.length === 0
    && decision === "APPROVED";
  return Object.freeze({
    status: allowed ? "ACTIVE" : "BLOCKED",
    productionActivationAllowed: allowed,
  });
}
