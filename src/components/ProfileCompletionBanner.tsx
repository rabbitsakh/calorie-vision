"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { withBasePath } from "@/lib/paths";

const DISMISS_KEY = "cv-profile-banner-dismissed";
const SHOW_COUNT_KEY = "cv-profile-banner-shows";
const MAX_SHOWS = 2;

type AccountSnippet = {
  sex: string | null;
  heightCm: number | null;
  birthYear: number | null;
};

function isIncomplete(data: AccountSnippet): boolean {
  return !data.sex || !data.heightCm || !data.birthYear;
}

function isDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
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

function bumpShowCount(): void {
  try {
    const next = showCount() + 1;
    localStorage.setItem(SHOW_COUNT_KEY, String(next));
    if (next >= MAX_SHOWS) {
      localStorage.setItem(DISMISS_KEY, "1");
    }
  } catch {
    // ignore
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // ignore
  }
}

/** Soft nudge when sex / height / birth year are missing — at most twice, then gone. */
export function ProfileCompletionBanner() {
  const day = useOptionalRationDay();
  const [missing, setMissing] = useState(false);
  const [visible, setVisible] = useState(false);
  const countedRef = useRef(false);

  useEffect(() => {
    if (isDismissed() || showCount() >= MAX_SHOWS) {
      setVisible(false);
      return;
    }

    function reveal() {
      if (!countedRef.current) {
        countedRef.current = true;
        bumpShowCount();
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
        if (incomplete && !isDismissed() && showCount() < MAX_SHOWS) {
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
            markDismissed();
            setVisible(false);
          }}
        >
          Скрыть
        </button>
      </div>
    </div>
  );
}
