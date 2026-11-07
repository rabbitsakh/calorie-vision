"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { withBasePath } from "@/lib/paths";
import {
  attributionFromSearch,
  mergeFirstTouch,
  readStoredAttribution,
  writeStoredAttribution,
} from "@/lib/signup-attribution";

/** Запоминает utm с адреса и один раз отдаёт их аккаунту после входа. */
export function AttributionCapture() {
  const { data: session, status } = useSession();

  useEffect(() => {
    const incoming = attributionFromSearch(window.location.search);
    const stored = readStoredAttribution(window.localStorage);
    const merged = mergeFirstTouch(stored, incoming);
    if (merged && merged !== stored) writeStoredAttribution(window.localStorage, merged);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const stored = readStoredAttribution(window.localStorage);
    if (!stored) return;
    const sentKey = `cv-attr-sent:${session.user.id}`;
    try {
      if (window.localStorage.getItem(sentKey) === "1") return;
    } catch {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(withBasePath("/api/me/attribution"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(stored),
        });
        if (!response.ok || cancelled) return;
        window.localStorage.setItem(sentKey, "1");
      } catch {
        // останется в localStorage до следующего захода
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, status]);

  return null;
}
