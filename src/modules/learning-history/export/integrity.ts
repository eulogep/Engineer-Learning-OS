const encoder = new TextEncoder();

function normalize(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON cannot contain a non-finite number.");
    return value;
  }
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().filter((key) => record[key] !== undefined)
      .map((key) => [key, normalize(record[key])]));
  }
  throw new TypeError("Canonical JSON contains an unsupported value.");
}

/** RFC-8259 JSON with recursively lexicographically sorted object keys. Array order is retained. */
export function stableJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return "sha256:" + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function utf8Length(value: string): number {
  return encoder.encode(value).byteLength;
}
