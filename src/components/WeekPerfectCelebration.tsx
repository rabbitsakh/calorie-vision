"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import { withBasePath } from "@/lib/paths";
import { pluralDays } from "@/lib/russian-text";
import {
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";

type WeekPerfectCelebrationProps = {
  today: string;
  selectedDate: string;
  refreshKey: number;
};

type StreakPayload = {
  daysLoggedThisWeek?: number;
  daysInWeekSoFar?: number;
  weekStart?: string;
};

/**
 * Fires once per week when every day Mon..today has at least one meal logged
 * (minimum 5 days in the week so far — i.e. from Friday onward if perfect).
 */
export function WeekPerfectCelebration({
  today,
  selectedDate,
  refreshKey,
}: WeekPerfectCelebrationProps) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState({ title: "", subtitle: "", badge: "" });
  const prevPerfect = useRef<boolean | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (selectedDate !== today) return;

    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/streak?today=${encodeURIComponent(today)}`));
        if (!resp.ok) return;
        const data = (await resp.json()) as StreakPayload;
        const logged = data.daysLoggedThisWeek ?? 0;
        const total = data.daysInWeekSoFar ?? 0;
        const weekStart = data.weekStart ?? today;
        const perfect = total >= 5 && logged === total;

        if (
          prevPerfect.current === false &&
          perfect &&
          !isSoftCelebrationSeen("week-perfect", weekStart)
        ) {
          markSoftCelebrationSeen("week-perfect", weekStart);
          setCopy({
            title: total >= 7 ? "Идеальная неделя!" : "Отличная неделя!",
            subtitle: `${logged} ${pluralDays(logged)} подряд с записями — регулярность на высоте.`,
            badge: String(logged),
          });
          setOpen(true);
        }

        prevPerfect.current = perfect;
      } catch {
        // non-critical
      }
    })();
  }, [today, selectedDate, refreshKey]);

  return (
    <SoftCelebration
      open={open}
      title={copy.title}
      subtitle={copy.subtitle}
      pose="streak"
      badge={copy.badge || undefined}
      onClose={close}
    />
  );
}
