"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { SoftCelebration } from "@/components/SoftCelebration";
import { withBasePath } from "@/lib/paths";
import { pluralDays } from "@/lib/russian-text";
import {
  isSoftCelebrationSeen,
  isSoftCelebrationsMutedToday,
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
  const day = useOptionalRationDay();
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState({ title: "", subtitle: "", badge: "" });
  const prevPerfect = useRef<boolean | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (selectedDate !== today) return;

    function apply(data: StreakPayload) {
      const logged = data.daysLoggedThisWeek ?? 0;
      const total = data.daysInWeekSoFar ?? 0;
      const weekStart = data.weekStart ?? today;
      const perfect = total >= 5 && logged === total;

      if (
        prevPerfect.current === false &&
        perfect &&
        !isSoftCelebrationsMutedToday(today) &&
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
    }

    if (day?.data?.streak && day.today === today) {
      apply(day.data.streak);
      return;
    }

    if (day && day.today === today && day.loading) {
      return;
    }

    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/streak?today=${encodeURIComponent(today)}`));
        if (!resp.ok) return;
        apply((await resp.json()) as StreakPayload);
      } catch {
        // non-critical
      }
    })();
  }, [today, selectedDate, refreshKey, day]);

  return (
    <SoftCelebration
      muteDate={today}
      open={open}
      title={copy.title}
      subtitle={copy.subtitle}
      pose="streak"
      badge={copy.badge || undefined}
      onClose={close}
    />
  );
}
