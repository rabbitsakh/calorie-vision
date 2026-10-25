"use client";

import { useEffect, useRef } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { notifyChestQueueRefresh } from "@/lib/chest-queue-refresh";
import { withBasePath } from "@/lib/paths";
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
 * C3 — soft week no longer auto-opens; refreshes ChestDock ready queue.
 */
export function WeekPerfectCelebration({
  today,
  selectedDate,
  refreshKey,
}: WeekPerfectCelebrationProps) {
  const day = useOptionalRationDay();
  const prevPerfect = useRef<boolean | null>(null);

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
        !isSoftCelebrationSeen("week-perfect", weekStart)
      ) {
        markSoftCelebrationSeen("week-perfect", weekStart);
        notifyChestQueueRefresh();
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

  return null;
}
