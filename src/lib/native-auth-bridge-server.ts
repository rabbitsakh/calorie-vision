/**
 * Server-only HMAC handoff tokens for Capacitor OAuth bridge.
 * Must not be imported from client components (uses node:crypto).
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { NATIVE_BRIDGE_MAX_AGE_SEC } from "@/lib/native-auth-bridge";

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

export async function createNativeBridgeToken(userId: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + NATIVE_BRIDGE_MAX_AGE_SEC;
  const payload = b64url(JSON.stringify({ u: userId, e: exp }));
  const sig = createHmac("sha256", authSecret()).update(payload).digest();
  return `${payload}.${b64url(sig)}`;
}

export async function verifyNativeBridgeToken(token: string): Promise<string | null> {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = createHmac("sha256", authSecret()).update(payload).digest();
    const got = fromB64url(sig);
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const data = JSON.parse(fromB64url(payload).toString("utf8")) as { u?: string; e?: number };
    if (!data.u || typeof data.e !== "number") return null;
    if (data.e < Math.floor(Date.now() / 1000)) return null;
    return data.u;
  } catch {
    return null;
  }
}
