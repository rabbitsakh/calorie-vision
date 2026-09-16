/**
 * Google blocks OAuth inside Android WebViews (HTTP 400 / disallowed_useragent).
 * On Capacitor: start NextAuth in the WebView (sets CSRF cookies), then open the
 * provider URL in Chrome Custom Tabs. App Links return the callback into the WebView.
 */

import { signIn } from "next-auth/react";
import { isCapacitorNative } from "@/lib/capacitor-bridge";
import { withBasePath } from "@/lib/paths";

let deepLinkHooked = false;

function isExternalOAuthUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return (
      host === "accounts.google.com" ||
      host.endsWith(".google.com") ||
      host === "id.vk.com" ||
      host.endsWith(".vk.com") ||
      host.includes("oauth")
    );
  } catch {
    return false;
  }
}

/** Listen once for OAuth callback App Links. */
export async function ensureCapacitorOAuthDeepLink(): Promise<void> {
  if (!isCapacitorNative() || deepLinkHooked || typeof window === "undefined") return;
  deepLinkHooked = true;

  try {
    const { App } = await import("@capacitor/app");
    const { Browser } = await import("@capacitor/browser");

    await App.addListener("appUrlOpen", ({ url }) => {
      try {
        const parsed = new URL(url);
        const path = parsed.pathname;
        const isAuthCallback =
          path.includes("/api/auth/callback") ||
          path.includes("/api/auth/signin") ||
          parsed.searchParams.has("code");
        if (!isAuthCallback) return;
        void Browser.close().catch(() => undefined);
        window.location.assign(url);
      } catch {
        // ignore
      }
    });
  } catch {
    // Plugins missing in plain browser
  }
}

/**
 * Start Google/VK OAuth. Capacitor → Custom Tabs; web → normal redirect.
 */
export async function startCapacitorOAuth(
  provider: "google" | "vk",
  callbackUrl = withBasePath("/ration/"),
): Promise<void> {
  if (!isCapacitorNative()) {
    await signIn(provider, { callbackUrl });
    return;
  }

  await ensureCapacitorOAuthDeepLink();

  const result = await signIn(provider, {
    callbackUrl,
    redirect: false,
  });

  if (result?.error) {
    throw new Error(result.error);
  }

  const target = result?.url;
  if (!target) {
    throw new Error("OAuthSignin");
  }

  // Finished without leaving our origin (already signed in, etc.)
  if (!isExternalOAuthUrl(target)) {
    window.location.assign(target);
    return;
  }

  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: target });
}
