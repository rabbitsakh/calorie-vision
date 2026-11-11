"use client";

import { useFoodAddUi } from "@/components/FoodAddHost";
import { trackGamReviewDismiss, trackGamReviewRate } from "@/lib/metrika-funnel";
import { withBasePath } from "@/lib/paths";
import {
  REVIEW_MOMENT_EVENT,
  RUSTORE_REVIEW_COPY,
  claimReviewPromptShow,
  disableReviewPrompt,
  getKnownSuccessDays,
  isAndroidAppShell,
  loadReviewPromptRecord,
  openRuStoreReviewCard,
  releaseReviewPromptClaim,
  rememberSuccessDays,
  saveReviewPromptRecord,
  type ReviewMomentDetail,
} from "@/lib/rustore-review-prompt";
import { detectCapacitorShell } from "@/lib/capacitor-bridge";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Bottom card after a chest, a badge, or a closed calm day.
 * Android shell only; the rules live in `shouldShowReviewPrompt`.
 */
export function RuStoreReviewPrompt() {
  const { status } = useSession();
  const food = useFoodAddUi();
  const [androidApp, setAndroidApp] = useState<boolean | null>(null);
  const [pending, setPending] = useState<ReviewMomentDetail | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIndex, setShowIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await detectCapacitorShell(1200);
      if (!cancelled) setAndroidApp(isAndroidAppShell());
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onMoment(event: Event) {
      const detail = (event as CustomEvent<ReviewMomentDetail>).detail;
      if (!detail?.moment) return;
      if (detail.successDays >= 0) rememberSuccessDays(detail.successDays);
      setPending(detail);
    }
    window.addEventListener(REVIEW_MOMENT_EVENT, onMoment);
    return () => window.removeEventListener(REVIEW_MOMENT_EVENT, onMoment);
  }, []);

  useEffect(() => {
    if (androidApp === false || status === "unauthenticated") setPending(null);
  }, [androidApp, status]);

  useEffect(() => {
    if (!pending || visible || androidApp !== true || status !== "authenticated") return;
    if (food.sheetOpen || food.confirmOpen) return;

    let cancelled = false;
    let timer = 0;

    const attempt = () => {
      if (cancelled) return;
      if (document.querySelector(".fs-celeb-root")) {
        timer = window.setTimeout(attempt, 500);
        return;
      }
      void (async () => {
        let days = pending.successDays;
        if (!(days >= 0)) days = getKnownSuccessDays() ?? -1;
        if (!(days >= 0)) {
          try {
            const resp = await fetch(withBasePath("/api/rewards"), { cache: "no-store" });
            if (resp.ok) {
              const data = (await resp.json()) as { questDayCount?: number };
              if (typeof data.questDayCount === "number" && data.questDayCount >= 0) {
                days = data.questDayCount;
                rememberSuccessDays(days);
              }
            }
          } catch {
            days = -1;
          }
        }
        if (cancelled) return;
        if (!(days >= 0)) {
          setPending(null);
          return;
        }
        const index = claimReviewPromptShow(Date.now(), days, pending.moment);
        if (cancelled) return;
        if (index == null) {
          setPending(null);
          return;
        }
        setShowIndex(index);
        setVisible(true);
        setPending(null);
      })();
    };

    attempt();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [pending, visible, androidApp, status, food.sheetOpen, food.confirmOpen]);

  function closeAfter(action: () => void) {
    action();
    releaseReviewPromptClaim();
    setVisible(false);
  }

  if (!mounted || !visible || showIndex == null) return null;

  const card = (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(7.25rem+env(safe-area-inset-bottom))]">
      <section
        role="dialog"
        aria-labelledby="rustore-review-title"
        className="pointer-events-auto w-full max-w-md rounded-2xl border border-[var(--border-quiet)] bg-[var(--surface)] p-4 shadow-[0_12px_32px_rgba(15,23,42,0.16)]"
      >
        <h2 id="rustore-review-title" className="text-base font-semibold text-[var(--foreground)]">
          {RUSTORE_REVIEW_COPY.title}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-strong)]">{RUSTORE_REVIEW_COPY.body}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary text-sm"
            onClick={() =>
              closeAfter(() => {
                trackGamReviewRate(showIndex);
                openRuStoreReviewCard();
              })
            }
          >
            {RUSTORE_REVIEW_COPY.rate}
          </button>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() =>
              closeAfter(() => {
                trackGamReviewDismiss(showIndex, "rated");
                saveReviewPromptRecord(disableReviewPrompt(loadReviewPromptRecord()));
              })
            }
          >
            {RUSTORE_REVIEW_COPY.already}
          </button>
          <button
            type="button"
            className="btn-quiet text-sm"
            onClick={() =>
              closeAfter(() => {
                trackGamReviewDismiss(showIndex, "later");
              })
            }
          >
            {RUSTORE_REVIEW_COPY.later}
          </button>
          <button
            type="button"
            className="btn-quiet text-sm"
            onClick={() =>
              closeAfter(() => {
                trackGamReviewDismiss(showIndex, "never");
                saveReviewPromptRecord(disableReviewPrompt(loadReviewPromptRecord()));
              })
            }
          >
            {RUSTORE_REVIEW_COPY.never}
          </button>
        </div>
      </section>
    </div>
  );

  return createPortal(card, document.body);
}
