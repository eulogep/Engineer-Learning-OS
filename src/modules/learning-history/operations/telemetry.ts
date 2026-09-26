import { z } from "zod";
import { createEventId } from "../ids";
import { UUIDV7_CANONICAL_PATTERN } from "../schemas";

export const OPERATIONAL_SEVERITIES = ["CRITICAL", "WARNING", "INFO"] as const;
export type OperationalSeverity = typeof OPERATIONAL_SEVERITIES[number];

const critical = new Set([
  "CANONICAL_WRITE_LOSS",
  "CANONICAL_CORRUPTION",
  "RESTORE_FAILURE",
  "UNAUTHORIZED_ACCESS",
  "DELETION_FAILURE",
]);
const warning = new Set([
  "STUCK_QUEUE",
  "PERSISTENT_CONFLICT",
  "REMOTE_DIVERGENCE",
  "PROVIDER_DEGRADED",
  "BACKUP_STALE",
  "BACKUP_EXPORT_FAILED",
]);

export function incidentSeverity(code: string): OperationalSeverity {
  if (critical.has(code)) return "CRITICAL";
  if (warning.has(code)) return "WARNING";
  return "INFO";
}

export function requiresImmediateNotification(severity: OperationalSeverity): boolean {
  return severity === "CRITICAL";
}

const telemetrySchema = z.object({
  version: z.literal(1),
  code: z.string().regex(/^[A-Z][A-Z0-9_]{2,63}$/),
  component: z.enum(["LOCAL_STORE", "PROJECTION", "SYNC", "AUTH", "BACKUP", "RESTORE", "DELETION"]),
  severity: z.enum(OPERATIONAL_SEVERITIES),
  timestamp: z.number().int().nonnegative().safe(),
  durationMs: z.number().int().nonnegative().safe().nullable(),
  deviceId: z.string().regex(UUIDV7_CANONICAL_PATTERN).nullable(),
  queueDepth: z.number().int().nonnegative().safe().nullable(),
  backupStatus: z.enum(["TRUSTED", "STALE", "FAILED", "UNRESTORED"]).nullable(),
  jobState: z.enum(["READY", "IN_FLIGHT", "WAITING_FOR_NETWORK", "RETRY", "ACKNOWLEDGED", "POISON"]).nullable(),
  correlationId: z.string().regex(UUIDV7_CANONICAL_PATTERN),
  latencyMs: z.number().int().nonnegative().safe().nullable(),
  route: z.enum(["/data", "/api/sync/health"]).nullable(),
}).strict();

export type OperationalTelemetry = z.infer<typeof telemetrySchema>;

export function parseOperationalTelemetry(value: unknown): OperationalTelemetry {
  const parsed = telemetrySchema.parse(value);
  if (parsed.severity !== incidentSeverity(parsed.code)) {
    throw new Error("Telemetry severity does not match the operational policy.");
  }
  return Object.freeze(parsed);
}


export type OperationalTelemetryInput = Omit<OperationalTelemetry, "version" | "severity" | "correlationId"> & {
  correlationId?: string;
};

export function createOperationalTelemetry(input: OperationalTelemetryInput): OperationalTelemetry {
  return parseOperationalTelemetry({
    ...input,
    version: 1,
    severity: incidentSeverity(input.code),
    correlationId: input.correlationId ?? createEventId(),
  });
}
