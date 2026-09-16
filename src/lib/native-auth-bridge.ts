/**
 * One-time handoff token: Custom Tabs session → Capacitor WebView session.
 * Compact HMAC tokens (not bulky next-auth JWTs) so Android Intent URLs stay short.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const NATIVE_BRIDGE_SCHEME = "calorievision";
export const NATIVE_BRIDGE_HOST = "native-bridge";
export const NATIVE_BRIDGE_PACKAGE = "ru.calorievision.app";
export const NATIVE_BRIDGE_MAX_AGE_SEC = 180;

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

export function nativeBridgeDeepLink(token: string): string {
  return `${NATIVE_BRIDGE_SCHEME}://${NATIVE_BRIDGE_HOST}?token=${encodeURIComponent(token)}`;
}

/** Chrome Custom Tabs reliably opens apps via intent:// + package. */
export function nativeBridgeIntentUrl(token: string): string {
  const query = `token=${encodeURIComponent(token)}`;
  return (
    `intent://${NATIVE_BRIDGE_HOST}?${query}` +
    `#Intent;scheme=${NATIVE_BRIDGE_SCHEME};package=${NATIVE_BRIDGE_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(nativeBridgeConsumeUrl("https://calorievision.ru", token))};end`
  );
}

export function nativeBridgeConsumeUrl(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/api/auth/native-bridge/consume?token=${encodeURIComponent(token)}`;
}

/** Parse token from calorievision://…, intent://…, or https consume URL. */
export function tokenFromNativeBridgeUrl(url: string): string | null {
  try {
    if (url.startsWith("intent:")) {
      const q = url.indexOf("?");
      const hash = url.indexOf("#");
      if (q >= 0) {
        const query = url.slice(q + 1, hash >= 0 ? hash : undefined);
        return new URLSearchParams(query).get("token");
      }
      return null;
    }
    const parsed = new URL(url);
    return parsed.searchParams.get("token");
  } catch {
    return null;
  }
}

export function isNativeBridgeUrl(url: string): boolean {
  try {
    if (url.startsWith("intent://") && url.includes(NATIVE_BRIDGE_HOST)) return true;
    const parsed = new URL(url);
    if (parsed.protocol === `${NATIVE_BRIDGE_SCHEME}:`) {
      return parsed.hostname === NATIVE_BRIDGE_HOST || parsed.host.startsWith(NATIVE_BRIDGE_HOST);
    }
    return (
      parsed.pathname.startsWith("/api/auth/native-bridge/consume") ||
      parsed.pathname.startsWith("/auth/native-bridge")
    );
  } catch {
    return false;
  }
}
