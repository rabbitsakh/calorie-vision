/**
 * One-time handoff token: Custom Tabs session → Capacitor WebView session.
 * Used after Google/VK OAuth completes in Chrome (cookies never shared with WebView).
 */

import { decode, encode } from "next-auth/jwt";

export const NATIVE_BRIDGE_SCHEME = "calorievision";
export const NATIVE_BRIDGE_HOST = "native-bridge";
export const NATIVE_BRIDGE_MAX_AGE_SEC = 120;

function authSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim() || process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("NEXTAUTH_SECRET is required for native auth bridge");
  }
  return secret;
}

export async function createNativeBridgeToken(userId: string): Promise<string> {
  return encode({
    token: {
      sub: userId,
      id: userId,
      purpose: "native-bridge",
    },
    secret: authSecret(),
    maxAge: NATIVE_BRIDGE_MAX_AGE_SEC,
  });
}

export async function verifyNativeBridgeToken(token: string): Promise<string | null> {
  try {
    const payload = await decode({
      token,
      secret: authSecret(),
    });
    if (!payload || payload.purpose !== "native-bridge") return null;
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    return userId;
  } catch {
    return null;
  }
}

export function nativeBridgeDeepLink(token: string): string {
  return `${NATIVE_BRIDGE_SCHEME}://${NATIVE_BRIDGE_HOST}?token=${encodeURIComponent(token)}`;
}

export function nativeBridgeConsumeUrl(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/api/auth/native-bridge/consume?token=${encodeURIComponent(token)}`;
}

/** Parse token from calorievision://native-bridge?token=… or https complete URL. */
export function tokenFromNativeBridgeUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const fromQuery = parsed.searchParams.get("token");
    if (fromQuery) return fromQuery;
    return null;
  } catch {
    return null;
  }
}

export function isNativeBridgeUrl(url: string): boolean {
  try {
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
