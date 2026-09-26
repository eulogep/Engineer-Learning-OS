import { createDeviceId, createLearnerRef } from "../ids";
import { UUIDV7_CANONICAL_PATTERN } from "../schemas";
import type { DeviceId, LearnerRef } from "../types";

export const CANONICAL_IDENTITY_KEY = "engineer-learning-os:canonical-identity:v1";
const DEVICE_CREDENTIAL_KEY = "engineer-learning-os:remote-device-credential:v1";

export type BrowserCanonicalIdentity = Readonly<{
  learnerRef: LearnerRef;
  deviceRef: DeviceId;
}>;

function isIdentity(value: unknown): value is BrowserCanonicalIdentity {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<BrowserCanonicalIdentity>;
  return UUIDV7_CANONICAL_PATTERN.test(candidate.learnerRef ?? "")
    && UUIDV7_CANONICAL_PATTERN.test(candidate.deviceRef ?? "");
}

export function browserCanonicalIdentity(): BrowserCanonicalIdentity {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(CANONICAL_IDENTITY_KEY) ?? "null");
    if (isIdentity(parsed)) return Object.freeze(parsed);
  } catch { /* Replace malformed local identity metadata. */ }
  const identity = Object.freeze({ learnerRef: createLearnerRef(), deviceRef: createDeviceId() });
  localStorage.setItem(CANONICAL_IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export function adoptRemoteLearnerRef(
  identity: BrowserCanonicalIdentity,
  learnerRef: LearnerRef,
): BrowserCanonicalIdentity {
  const next = Object.freeze({ learnerRef, deviceRef: identity.deviceRef });
  localStorage.setItem(CANONICAL_IDENTITY_KEY, JSON.stringify(next));
  return next;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function browserDeviceCredential(): string {
  const existing = localStorage.getItem(DEVICE_CREDENTIAL_KEY);
  if (existing && existing.length >= 43 && existing.length <= 512 && !/\s/.test(existing)) return existing;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const credential = base64Url(bytes);
  localStorage.setItem(DEVICE_CREDENTIAL_KEY, credential);
  return credential;
}
