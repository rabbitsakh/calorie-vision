/**
 * Server-only HMAC handoff tokens for Capacitor OAuth bridge + APK session resume.
 * Must not be imported from client components (uses node:crypto).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NATIVE_BRIDGE_MAX_AGE_SEC } from "@/lib/native-auth-bridge";

/** Long-lived device resume (Preferences) — re-mint WebView session cookies on cold start. */
export const CAPACITOR_RESUME_MAX_AGE_SEC = 30 * 24 * 60 * 60;

function authSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for native auth bridge");
  }
  return secret;
}

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string): Buffer {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(normalized, "base64");
}

type BridgePayload = {
  u?: string;
  e?: number;
  /** `oauth` (short Custom Tabs handoff) or `resume` (APK cold start). */
  p?: string;
};

function signPayload(data: BridgePayload): string {
  const payload = b64url(JSON.stringify(data));
  const sig = createHmac("sha256", authSecret()).update(payload).digest();
  return `${payload}.${b64url(sig)}`;
}

function verifyPayload(token: string): BridgePayload | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", authSecret()).update(payload).digest();
    const got = fromB64url(sig);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const data = JSON.parse(fromB64url(payload).toString("utf8")) as BridgePayload;
    if (!data.u || typeof data.e !== "number") return null;
    if (data.e < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Short-lived OAuth handoff (Custom Tabs → WebView). */
export async function createNativeBridgeToken(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + NATIVE_BRIDGE_MAX_AGE_SEC;
  return signPayload({ u: userId, e: exp, p: "oauth" });
}

export async function verifyNativeBridgeToken(token: string): Promise<string | null> {
  const data = verifyPayload(token);
  if (!data?.u) return null;
  // Accept legacy tokens without `p` (pre-purpose) as oauth handoff.
  if (data.p && data.p !== "oauth") return null;
  return data.u;
}

/** APK cold-start resume — stored in Capacitor Preferences. */
export async function createCapacitorResumeToken(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + CAPACITOR_RESUME_MAX_AGE_SEC;
  return signPayload({ u: userId, e: exp, p: "resume" });
}

export async function verifyCapacitorResumeToken(token: string): Promise<string | null> {
  const data = verifyPayload(token);
  if (!data?.u || data.p !== "resume") return null;
  return data.u;
}
