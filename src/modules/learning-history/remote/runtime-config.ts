export type RemoteSyncConfiguration = Readonly<
  | { status: "DISABLED" }
  | { status: "INVALID" }
  | { status: "READY"; projectUrl: string; publishableKey: string }
>;

export function remoteSyncConfiguration(input: {
  mode?: string;
  projectUrl?: string;
  publishableKey?: string;
}): RemoteSyncConfiguration {
  if (input.mode !== "ACTIVE") return Object.freeze({ status: "DISABLED" });
  if (!input.projectUrl || !input.publishableKey
    || !input.publishableKey.startsWith("sb_publishable_")
    || input.publishableKey.startsWith("sb_secret_")) {
    return Object.freeze({ status: "INVALID" });
  }
  try {
    const url = new URL(input.projectUrl);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if ((!local && url.protocol !== "https:") || (local && !["http:", "https:"].includes(url.protocol))) {
      return Object.freeze({ status: "INVALID" });
    }
    return Object.freeze({
      status: "READY",
      projectUrl: url.toString().replace(/\/$/, ""),
      publishableKey: input.publishableKey,
    });
  } catch {
    return Object.freeze({ status: "INVALID" });
  }
}

export function browserRemoteSyncConfiguration(): RemoteSyncConfiguration {
  return remoteSyncConfiguration({
    mode: process.env.NEXT_PUBLIC_ELOS_REMOTE_SYNC_MODE,
    projectUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
