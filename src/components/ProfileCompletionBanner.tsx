"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { mondayOfWeek, toDateKey } from "@/lib/dates";
import { withBasePath } from "@/lib/paths";

const WEEK_KEY = "cv-profile-banner-week";
const SHOW_COUNT_KEY = "cv-profile-banner-shows";
/** Soft lifetime cap — roughly a few months of weekly nudges. */
const MAX_SHOWS = 8;

type AccountSnippet = {
  sex: string | null;
  heightCm: number | null;
  birthYear: number | null;
};

function isIncomplete(data: AccountSnippet): boolean {
  return !data.sex || !data.heightCm || !data.birthYear;
}

function currentWeekId(): string {
  return mondayOfWeek(toDateKey(new Date()));
}

function shownThisWeek(): boolean {
  try {
    return localStorage.getItem(WEEK_KEY) === currentWeekId();
  } catch {
    return true;
  }
}

function showCount(): number {
  try {
    return Number(localStorage.getItem(SHOW_COUNT_KEY) ?? "0") || 0;
  } catch {
    return MAX_SHOWS;
  }
}

function markShownThisWeek(): void {
  try {
    const week = currentWeekId();
    if (localStorage.getItem(WEEK_KEY) === week) return;
    localStorage.setItem(WEEK_KEY, week);
    const next = showCount() + 1;
    localStorage.setItem(SHOW_COUNT_KEY, String(next));
  } catch {
    // ignore
  }
}

function hideForThisWeek(): void {
  markShownThisWeek();
}

/** Soft weekly nudge when sex / height / birth year are missing. */
export function ProfileCompletionBanner() {
  const day = useOptionalRationDay();
  const [missing, setMissing] = useState(false);
  const [visible, setVisible] = useState(false);
  const countedRef = useRef(false);

  useEffect(() => {
    if (shownThisWeek() || showCount() >= MAX_SHOWS) {
      setVisible(false);
      return;
    }

    function reveal() {
      if (!countedRef.current) {
        countedRef.current = true;
        markShownThisWeek();
      }
      setVisible(true);
    }

    if (day?.data?.account) {
      const incomplete = isIncomplete(day.data.account);
      setMissing(incomplete);
      if (incomplete) reveal();
      return;
    }

    if (day && day.loading) {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/account"));
        if (!resp.ok) return;
        const data = (await resp.json()) as AccountSnippet;
        if (cancelled) return;
        const incomplete = isIncomplete(data);
        setMissing(incomplete);
        if (incomplete && !shownThisWeek() && showCount() < MAX_SHOWS) {
          reveal();
        }
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  if (!missing || !visible) return null;

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/90 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sky-950">Дополните профиль</p>
          <p className="mt-0.5 text-xs text-sky-800">
            Укажите пол, рост и год рождения — нормы калорий станут точнее.
          </p>
          <Link
            href="/profile"
            className="mt-2 inline-flex text-sm font-semibold text-sky-900 underline-offset-2 hover:underline"
          >
            Открыть профиль
          </Link>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-semibold text-sky-700/80 hover:text-sky-950"
          onClick={() => {
            hideForThisWeek();
            setVisible(false);
          }}
        >
          Скрыть
        </button>
      </div>
    </div>
  );
}
