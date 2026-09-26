export const EXTERNAL_ZAI_DISABLED_CODE = "EXTERNAL_ZAI_PROCESSING_DISABLED";

type ExternalAiEnvironment = Readonly<Record<string, string | undefined>>;

export function isExternalZaiServerProcessingEnabled(
  environment: ExternalAiEnvironment = process.env,
): boolean {
  return environment.ELOS_EXTERNAL_ZAI_PROCESSING === "ENABLED";
}

export function isExternalZaiClientProcessingEnabled(
  environment: ExternalAiEnvironment = process.env,
): boolean {
  return environment.NEXT_PUBLIC_ELOS_EXTERNAL_ZAI_PROCESSING === "ENABLED";
}
