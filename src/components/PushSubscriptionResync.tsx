"use client";

import { useEffect } from "react";
import { isStandalonePwa } from "@/lib/push-client";
import { withBasePath } from "@/lib/paths";
import { subscribeBrowserPush } from "@/lib/push-subscribe";

const RESYNC_ONCE_KEY = "cv-push-resync-attempted";

/**
 * Standalone PWA: if the browser already granted Notification permission but
 * the server has no subscription, silently re-subscribe once (no modal).
 */
export function PushSubscriptionResync() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isStandalonePwa()) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    try {
      if (sessionStorage.getItem(RESYNC_ONCE_KEY) === "1") return;
      sessionStorage.setItem(RESYNC_ONCE_KEY, "1");
    } catch {
      // continue without session guard
    }

    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/push/subscribe"), { cache: "no-store" });
        if (!resp.ok || cancelled) return;
        const data = (await resp.json()) as { subscribed?: boolean };
        if (data.subscribed) return;
        await subscribeBrowserPush();
      } catch {
        // non-critical
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
