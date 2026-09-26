import { ELOS_PROGRAM, EXPORT_PATHS, RecoveryError, type RecoveryBundle } from "./export-format";

const FILE_KIND = "ELOS_CANONICAL_RECOVERY_FILE";
const FILE_VERSION = 1;
export const MAX_RECOVERY_FILE_BYTES = 50 * 1024 * 1024;
const REQUIRED_PATHS = Object.freeze(Object.values(EXPORT_PATHS).sort());

type BrowserRecoveryEnvelope = Readonly<{
  kind: typeof FILE_KIND;
  version: typeof FILE_VERSION;
  program: typeof ELOS_PROGRAM;
  files: RecoveryBundle;
}>;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RecoveryError("INVALID_ARCHIVE");
  return value as Record<string, unknown>;
}

export function encodeBrowserRecoveryFile(bundle: RecoveryBundle): string {
  return JSON.stringify({ kind: FILE_KIND, version: FILE_VERSION, program: ELOS_PROGRAM, files: bundle } satisfies BrowserRecoveryEnvelope);
}

export function decodeBrowserRecoveryFile(content: string): RecoveryBundle {
  if (new TextEncoder().encode(content).byteLength > MAX_RECOVERY_FILE_BYTES) {
    throw new RecoveryError("INVALID_ARCHIVE");
  }
  let parsed: Record<string, unknown>;
  try { parsed = record(JSON.parse(content)); }
  catch (error) {
    if (error instanceof RecoveryError) throw error;
    throw new RecoveryError("INVALID_ARCHIVE");
  }
  if (parsed.kind !== FILE_KIND || parsed.version !== FILE_VERSION || parsed.program !== ELOS_PROGRAM
    || Object.keys(parsed).sort().join("|") !== "files|kind|program|version") {
    throw new RecoveryError("INVALID_ARCHIVE");
  }
  const files = record(parsed.files);
  const paths = Object.keys(files).sort();
  if (paths.join("|") !== REQUIRED_PATHS.join("|")
    || paths.some((path) => typeof files[path] !== "string")) {
    throw new RecoveryError("MISSING_REQUIRED_FILE");
  }
  return Object.freeze(Object.fromEntries(paths.map((path) => [path, files[path] as string])));
}

export function recoveryFilename(createdAt: number): string {
  const date = new Date(createdAt);
  if (!Number.isSafeInteger(createdAt) || Number.isNaN(date.valueOf())) throw new RecoveryError("INVALID_ARCHIVE");
  return "engineer-learning-os-recovery-" + date.toISOString().slice(0, 10) + ".json";
}
