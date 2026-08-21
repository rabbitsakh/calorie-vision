"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findUnseenMilestone } from "@/components/MilestoneCelebration";
import { SoftCelebration } from "@/components/SoftCelebration";
import { withBasePath } from "@/lib/paths";
import { pluralDays } from "@/lib/russian-text";
import {
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";

type DayOpenedCelebrationProps = {
  today: string;
  selectedDate: string;
  refreshKey: number;
};

type StreakPayload = {
  loggedToday?: boolean;
  streak?: number;
};

type SoftCopy = {
  title: string;
  subtitle: string;
  badge: string;
};

/**
 * Fires once when the user goes from “no meals today” → “at least one”.
 * If a streak continues (streak > 0) and there is no milestone modal pending,
 * shows “серия сохранена” instead of the generic day-opened copy.
 */
export function DayOpenedCelebration({
  today,
  selectedDate,
  refreshKey,
}: DayOpenedCelebrationProps) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<SoftCopy>({
    title: "День открыт",
    subtitle: "Первая запись сегодня — привычка снова в деле.",
    badge: "✓",
  });
  const prevLogged = useRef<boolean | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (selectedDate !== today) return;

    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/streak?today=${encodeURIComponent(today)}`));
        if (!resp.ok) return;
        const data = (await resp.json()) as StreakPayload;
        const logged = Boolean(data.loggedToday);
        const streak = data.streak ?? 0;

        if (prevLogged.current === false && logged) {
          const milestonePending = findUnseenMilestone(streak) != null;

          if (milestonePending) {
            // Milestone modal will celebrate — skip soft overlay this time.
            markSoftCelebrationSeen("day-opened", today);
            markSoftCelebrationSeen("streak-saved", today);
          } else if (
            streak > 0 &&
            !isSoftCelebrationSeen("streak-saved", today)
          ) {
            markSoftCelebrationSeen("day-opened", today);
            markSoftCelebrationSeen("streak-saved", today);
            setCopy({
              title: "Серия сохранена",
              subtitle: `${streak} ${pluralDays(streak)} подряд — отличный ход.`,
              badge: String(streak > 99 ? "99+" : streak),
            });
            setOpen(true);
          } else if (!isSoftCelebrationSeen("day-opened", today)) {
            markSoftCelebrationSeen("day-opened", today);
            setCopy({
              title: "День открыт",
              subtitle: "Первая запись сегодня — привычка снова в деле.",
              badge: "✓",
            });
            setOpen(true);
          }
        }

        prevLogged.current = logged;
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
      badge={copy.badge}
      onClose={close}
    />
  );
}
