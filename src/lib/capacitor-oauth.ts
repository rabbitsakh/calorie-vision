/**
 * Capacitor APK OAuth — keep the entire login inside the app WebView.
 *
 * Historically we opened Chrome Custom Tabs via @capacitor/browser because
 * Google blocks the stock WebView user-agent. That looked like “login opens
 * in an external browser” (RuStore / users).
 *
 * Now:
 * 1) `capacitor.config` allowNavigation covers IdP hosts (Google / Yandex / VK / Telegram)
 * 2) android.overrideUserAgent spoofs Chrome Mobile
 * 3) signIn() navigates in the same WebView — session cookies stay in-app
 *
 * Deep-link / native-bridge helpers remain for older handoffs and cold starts.
 */

import { signIn } from "next-auth/react";
import { publicBrowserOrigin } from "@/lib/auth-url";
import { isCapacitorNative } from "@/lib/capacitor-bridge";
import {
  isNativeBridgeUrl,
  nativeBridgeConsumeUrl,
  tokenFromNativeBridgeUrl,
} from "@/lib/native-auth-bridge";
import { withBasePath } from "@/lib/paths";

let deepLinkHooked = false;

function adoptNativeBridgeUrl(url: string): void {
  try {
    if (!isNativeBridgeUrl(url) && !url.includes("/api/auth/callback")) {
      return;
    }

    const token = tokenFromNativeBridgeUrl(url);
    if (token) {
      const origin = publicBrowserOrigin(window.location.origin);
      window.location.assign(nativeBridgeConsumeUrl(origin, token));
      return;
    }

    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.location.assign(url);
    }
  } catch {
    // ignore
  }
}

/** Listen once for OAuth handoff deep links (legacy Custom Tabs / cold start). */
export async function ensureCapacitorOAuthDeepLink(): Promise<void> {
  if (!isCapacitorNative() || deepLinkHooked || typeof window === "undefined") return;
  deepLinkHooked = true;

  try {
    const { App } = await import("@capacitor/app");
    const { Browser } = await import("@capacitor/browser");

    const adopt = (url: string) => {
      void Browser.close().catch(() => undefined);
      adoptNativeBridgeUrl(url);
    };

    await App.addListener("appUrlOpen", ({ url }) => {
      adopt(url);
    });

    await App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) return;
      void App.getLaunchUrl()
        .then((launch) => {
          if (launch?.url) adopt(launch.url);
        })
        .catch(() => undefined);
    });

    void App.getLaunchUrl()
      .then((launch) => {
        if (launch?.url) adopt(launch.url);
      })
      .catch(() => undefined);

    await Browser.addListener("browserFinished", () => {
      window.dispatchEvent(new CustomEvent("cv-oauth-browser-finished"));
      void App.getLaunchUrl()
        .then((launch) => {
          if (launch?.url) adopt(launch.url);
        })
        .catch(() => undefined);
    });
  } catch {
    // Plugins missing in plain browser
  }
}

/**
 * Start Google/VK/Yandex OAuth inside the Capacitor WebView (not Custom Tabs).
 */
export type CapacitorOAuthProvider = "google" | "vk" | "yandex";

export async function startCapacitorOAuth(
  provider: CapacitorOAuthProvider,
  callbackUrl = withBasePath("/ration/"),
): Promise<void> {
  if (isCapacitorNative()) {
    await ensureCapacitorOAuthDeepLink();
  }
  // Same-WebView redirect — IdP hosts are allowNavigation allowlisted.
  await signIn(provider, { callbackUrl });
}

/**
 * Absolute https URL for product paths when the WebView may sit on a local asset origin.
 * Prefer public site origin so OAuth redirect_uri matches NextAuth config.
 */
export function capacitorProductUrl(path: string): string {
  const origin =
    typeof window !== "undefined"
      ? publicBrowserOrigin(window.location.origin)
      : "https://calorievision.ru";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${withBasePath(normalized)}`;
}
