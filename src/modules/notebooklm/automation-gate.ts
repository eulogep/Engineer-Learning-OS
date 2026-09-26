// Gate for the local NotebookLM automation bridge.
//
// The bridge starts a local browser-automation process from an HTTP route. It is a developer
// facility for one trusted machine, never a feature of a deployed application, so it is:
//   - OFF by default, and enabled only by a server-side environment variable (no NEXT_PUBLIC_);
//   - refused on hosted platforms and behind a proxy;
//   - restricted to same-origin JSON requests addressed to a loopback host (this also blocks
//     cross-site form posts and DNS-rebinding pages when the flag is on).
// When the gate refuses a request nothing is parsed, validated or spawned.

export const NOTEBOOKLM_AUTOMATION_FLAG = "ELOS_NOTEBOOKLM_AUTOMATION";

type Env = Readonly<Record<string, string | undefined>>;

export type AutomationGateResult =
  | { allowed: true }
  | { allowed: false; status: 403 | 404 | 415; detailCode: string };

const HOSTED_PLATFORM_MARKERS = [
  "VERCEL", "VERCEL_ENV", "NETLIFY", "AWS_LAMBDA_FUNCTION_NAME", "AWS_EXECUTION_ENV", "K_SERVICE", "RENDER",
  "FLY_APP_NAME", "CF_PAGES", "RAILWAY_ENVIRONMENT", "WEBSITE_SITE_NAME", "DYNO",
] as const;
// Headers only a real proxy or CDN adds. The Next.js server itself always adds x-forwarded-for,
// x-forwarded-host, x-forwarded-proto and x-forwarded-port to the request it hands to a route (with the
// socket address and the Host it received), so those four are judged by value below, not by presence.
const PROXY_ONLY_HEADERS = ["x-real-ip", "forwarded", "cf-connecting-ip", "true-client-ip", "via"] as const;
const LOOPBACK_ADDRESSES = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1", "[::1]"]);
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Exact match: "true", "1" or "enabled" (any other case) do not enable anything. */
export function isNotebookLMAutomationEnabled(env: Env = process.env): boolean {
  return env[NOTEBOOKLM_AUTOMATION_FLAG] === "ENABLED";
}

function hostnameOf(hostHeader: string): string | null {
  try {
    return new URL(`http://${hostHeader}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function evaluateNotebookLMAutomationRequest(request: Request, env: Env = process.env): AutomationGateResult {
  // Disabled looks like a route that does not exist: it reveals nothing about the bridge.
  if (!isNotebookLMAutomationEnabled(env)) return { allowed: false, status: 404, detailCode: "AUTOMATION_DISABLED" };

  if (HOSTED_PLATFORM_MARKERS.some((name) => Boolean(env[name]))) return { allowed: false, status: 403, detailCode: "AUTOMATION_NOT_LOCAL" };
  if (PROXY_ONLY_HEADERS.some((name) => request.headers.has(name))) return { allowed: false, status: 403, detailCode: "AUTOMATION_NOT_LOCAL" };
  // Every hop recorded in x-forwarded-for must be this machine.
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor && !forwardedFor.split(",").every((entry) => LOOPBACK_ADDRESSES.has(entry.trim().toLowerCase()))) {
    return { allowed: false, status: 403, detailCode: "AUTOMATION_NOT_LOCAL" };
  }

  const host = request.headers.get("host");
  const hostname = host ? hostnameOf(host) : null;
  if (!host || !hostname || !LOOPBACK_HOSTNAMES.has(hostname)) return { allowed: false, status: 403, detailCode: "AUTOMATION_NOT_LOCAL" };
  // A forwarded host that differs from the Host header means the request was rewritten by something in front.
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost && forwardedHost.toLowerCase() !== host.toLowerCase()) return { allowed: false, status: 403, detailCode: "AUTOMATION_NOT_LOCAL" };

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string | null = null;
    try { originHost = new URL(origin).host.toLowerCase(); } catch { originHost = null; }
    if (originHost !== host.toLowerCase()) return { allowed: false, status: 403, detailCode: "CROSS_ORIGIN_BLOCKED" };
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return { allowed: false, status: 403, detailCode: "CROSS_ORIGIN_BLOCKED" };

  // A JSON content type forces a CORS preflight for any cross-origin caller.
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return { allowed: false, status: 415, detailCode: "JSON_REQUIRED" };
  }
  return { allowed: true };
}
