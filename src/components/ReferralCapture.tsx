"use client";

import { useEffect, useState } from "react";
import {
  capturePendingReferralCode,
  clearPendingReferralCode,
  peekPendingReferralCode,
} from "@/lib/referral-pending";
import { withBasePath } from "@/lib/paths";

/**
 * Captures ?ref= into localStorage and claims it once the user is signed in.
 */
export function ReferralCapture({ signedIn }: { signedIn?: boolean }) {
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get("ref")?.trim();
      if (ref) {
        capturePendingReferralCode(ref);
        params.delete("ref");
        const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}${window.location.hash}`;
        window.history.replaceState({}, "", next);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    const code = peekPendingReferralCode();
    if (!code) return;

    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/referral/claim"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        const data = (await resp.json().catch(() => ({}))) as {
          ok?: boolean;
          alreadyClaimed?: boolean;
          error?: string;
        };
        if (cancelled) return;
        clearPendingReferralCode();
        if (resp.ok && data.ok && !data.alreadyClaimed) {
          setStatus("Приглашение учтено — спасибо!");
        }
      } catch {
        // keep pending for next visit
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  if (!status) return null;
  return (
    <p className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-900">
      {status}
    </p>
  );
}
