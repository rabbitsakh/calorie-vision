/**
 * Client-safe native OAuth bridge URL helpers (no Node builtins).
 * Token create/verify lives in native-auth-bridge-server.ts (API routes only).
 */

export const NATIVE_BRIDGE_SCHEME = "calorievision";
export const NATIVE_BRIDGE_HOST = "native-bridge";
export const NATIVE_BRIDGE_PACKAGE = "ru.calorievision.app";
export const NATIVE_BRIDGE_MAX_AGE_SEC = 180;

export function nativeBridgeDeepLink(token: string): string {
  return `${NATIVE_BRIDGE_SCHEME}://${NATIVE_BRIDGE_HOST}?token=${encodeURIComponent(token)}`;
}

/**
 * Fallback page for Chrome when intent:// cannot open the APK.
 * Must NOT be the consume URL — that would log the user into the website in Chrome.
 */
export function nativeBridgeAppReturnUrl(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/auth/native-bridge/return?token=${encodeURIComponent(token)}`;
}

/** Chrome Custom Tabs reliably opens apps via intent:// + package. */
export function nativeBridgeIntentUrl(token: string, siteOrigin = "https://calorievision.ru"): string {
  const query = `token=${encodeURIComponent(token)}`;
  const fallback = nativeBridgeAppReturnUrl(siteOrigin, token);
  return (
    `intent://${NATIVE_BRIDGE_HOST}?${query}` +
    `#Intent;scheme=${NATIVE_BRIDGE_SCHEME};package=${NATIVE_BRIDGE_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(fallback)};end`
  );
}

/** WebView-only: set session cookie after Custom Tabs handoff. Never use as Chrome fallback. */
export function nativeBridgeConsumeUrl(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/api/auth/native-bridge/consume?token=${encodeURIComponent(token)}`;
}

/** Parse token from calorievision://…, intent://…, or https consume/return URL. */
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
