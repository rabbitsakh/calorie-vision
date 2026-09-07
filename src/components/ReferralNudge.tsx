"use client";

import { useEffect, useState } from "react";
import { MascotCompanionCard } from "@/components/MascotCompanionCard";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";
import { isFirstWeekQuiet } from "@/lib/first-hour-trust";
import { withBasePath } from "@/lib/paths";
import { buildReferralShareUrl, telegramShareUrl, vkShareUrl } from "@/lib/referral";

const PANEL_ID = "referral-nudge";
const SEEN_WEEK_KEY = "cv-referral-nudge-week";

function weekKey(date: string): string {
  // ISO date → Monday of that week (UTC-ish; soft gate only).
  const d = new Date(`${date}T12:00:00`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

type ReferralNudgeProps = {
  today: string;
  selectedDate: string;
  quietHide?: boolean;
};

/** Soft once-per-week invite nudge after the user has logged something today. */
export function ReferralNudge({ today, selectedDate, quietHide = false }: ReferralNudgeProps) {
  const [code, setCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [seenWeek, setSeenWeek] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
    const wk = weekKey(today);
    try {
      setSeenWeek(localStorage.getItem(SEEN_WEEK_KEY) === wk);
    } catch {
      setSeenWeek(true);
    }
  }, [selectedDate, today]);

  useEffect(() => {
    if (selectedDate !== today || seenWeek) return;
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/account"), { cache: "no-store" });
        if (!resp.ok || cancelled) return;
        const data = (await resp.json()) as { referralCode?: string };
        const next = data.referralCode?.trim() || null;
        if (!next || cancelled) return;
        setCode(next);
        const origin = typeof window !== "undefined" ? window.location.origin : undefined;
        setShareUrl(buildReferralShareUrl(next, origin));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, today, seenWeek]);

  if (selectedDate !== today || seenWeek || !code || !shareUrl) return null;
  if (isFirstWeekQuiet(3)) return null;

  if (hidden) {
    if (quietHide) return null;
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-500 hover:border-slate-300"
        onClick={() => {
          showPanelToday(PANEL_ID, selectedDate);
          setHidden(false);
        }}
      >
        <span>Пригласить друга</span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  function markSeen() {
    const wk = weekKey(today);
    try {
      localStorage.setItem(SEEN_WEEK_KEY, wk);
    } catch {
      // ignore
    }
    setSeenWeek(true);
  }

  return (
    <MascotCompanionCard
      pose="cheer"
      tone="teal"
      title="Пригласить друга"
      onHide={() => {
        hidePanelToday(PANEL_ID, selectedDate);
        setHidden(true);
        markSeen();
      }}
    >
      <p className="text-sm leading-relaxed text-slate-700">
        Если дневник помогает — можно тихо поделиться ссылкой. Без давления.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-quiet min-h-9 px-3 text-xs font-semibold"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
              markSeen();
            } catch {
              // ignore
            }
          }}
        >
          {copied ? "Скопировано" : "Скопировать ссылку"}
        </button>
        <a
          className="btn-quiet min-h-9 px-3 text-xs font-semibold"
          href={telegramShareUrl(shareUrl, "Calorie Vision — спокойный дневник калорий")}
          target="_blank"
          rel="noopener noreferrer"
          onClick={markSeen}
        >
          Telegram
        </a>
        <a
          className="btn-quiet min-h-9 px-3 text-xs font-semibold"
          href={vkShareUrl(shareUrl)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={markSeen}
        >
          VK
        </a>
      </div>
    </MascotCompanionCard>
  );
}
