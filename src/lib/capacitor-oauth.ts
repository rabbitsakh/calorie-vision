/**
 * Google blocks OAuth inside Android WebViews (HTTP 400 / disallowed_useragent).
 * Custom Tabs do not share cookies with the WebView, so CSRF from a WebView signIn
 * cannot validate a callback that lands in Chrome.
 *
 * Flow:
 * 1) Open /auth/native-oauth?provider=… in Custom Tabs (CSRF + Google/VK entirely there)
 * 2) Callback → /auth/native-bridge → intent:// / calorievision://native-bridge?token=
 * 3) App opens → WebView consumes token and sets session cookie
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

/** Listen once for OAuth handoff deep links. */
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

    // Cold start / already-open with pending intent
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
 * Start Google/VK/Yandex OAuth. Capacitor → Custom Tabs bootstrap; web → normal redirect.
 */
export type CapacitorOAuthProvider = "google" | "vk" | "yandex";

export async function startCapacitorOAuth(
  provider: CapacitorOAuthProvider,
  callbackUrl = withBasePath("/ration/"),
): Promise<void> {
  if (!isCapacitorNative()) {
    await signIn(provider, { callbackUrl });
    return;
  }

  await ensureCapacitorOAuthDeepLink();

  const origin = publicBrowserOrigin(window.location.origin);
  const startUrl = `${origin}${withBasePath(`/auth/native-oauth?provider=${provider}`)}`;
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: startUrl });
}
