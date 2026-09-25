"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect, type ReactNode } from "react";
import { MetrikaFunnel } from "@/components/MetrikaFunnel";
import { detectCapacitorShell, markCapacitorShell } from "@/lib/capacitor-bridge";
import { markCapacitorLoggedIn } from "@/lib/capacitor-login-flag";
import { refreshCapacitorResumeToken } from "@/lib/capacitor-resume";
import { ensureCapacitorOAuthDeepLink } from "@/lib/capacitor-oauth";
import { withBasePath } from "@/lib/paths";

function CapacitorOAuthDeepLink() {
  useEffect(() => {
    void ensureCapacitorOAuthDeepLink();
  }, []);
  return null;
}

/**
 * Remember login across APK process death.
 * Preferences holds a resume token — cold start re-mints WebView session cookies
 * (cookies alone often vanish when the process is killed).
 */
function CapacitorSessionPersist() {
  const { status } = useSession();
  useEffect(() => {
    if (status !== "authenticated") return;
    void (async () => {
      await markCapacitorLoggedIn();
      await refreshCapacitorResumeToken();
    })();
  }, [status]);
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
      const native = await detectCapacitorShell(2500);
      if (cancelled || !native) return;
      markCapacitorShell();
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
      <CapacitorSessionPersist />
      <CapacitorNativeViewport />
      <MetrikaFunnel />
      {children}
    </SessionProvider>
  );
}
