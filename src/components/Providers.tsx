"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, type ReactNode } from "react";
import { MetrikaFunnel } from "@/components/MetrikaFunnel";
import { waitForCapacitorNative } from "@/lib/capacitor-bridge";
import { ensureCapacitorOAuthDeepLink } from "@/lib/capacitor-oauth";
import { withBasePath } from "@/lib/paths";

function CapacitorOAuthDeepLink() {
  useEffect(() => {
    void ensureCapacitorOAuthDeepLink();
  }, []);
  return null;
}

/**
 * APK WebView: lock maximum-scale so focusing portion/set inputs cannot
 * auto-zoom the page. Web/PWA keep pinch-zoom; 16px CSS covers those.
 */
function CapacitorNativeViewport() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const native = await waitForCapacitorNative(1200);
      if (cancelled || !native) return;
      document.documentElement.classList.add("capacitor-native");
      const meta =
        document.querySelector('meta[name="viewport"]') ??
        (() => {
          const el = document.createElement("meta");
          el.setAttribute("name", "viewport");
          document.head.appendChild(el);
          return el;
        })();
      meta.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath={withBasePath("/api/auth")}>
      <CapacitorOAuthDeepLink />
      <CapacitorNativeViewport />
      <MetrikaFunnel />
      {children}
    </SessionProvider>
  );
}
