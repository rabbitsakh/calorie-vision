"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { findUnseenMilestone } from "@/components/MilestoneCelebration";
import type { MascotPose } from "@/components/Mascot";
import { SoftCelebration } from "@/components/SoftCelebration";
import { withBasePath } from "@/lib/paths";
import { pluralDays } from "@/lib/russian-text";
import {
  isSoftCelebrationSeen,
  isSoftCelebrationsMutedToday,
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
  badge?: string;
  pose: MascotPose;
};

const RETRY_DELAYS_MS = [0, 450, 1200];

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
    subtitle: "Первая запись сегодня",
    pose: "cheer",
  });
  const prevLogged = useRef<boolean | null>(null);
  const openedRef = useRef(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (selectedDate !== today) return;

    let cancelled = false;
    const timers: number[] = [];

    async function pollStreak() {
      try {
        const resp = await fetch(withBasePath(`/api/streak?today=${encodeURIComponent(today)}`));
        if (!resp.ok || cancelled || openedRef.current) return;
        const data = (await resp.json()) as StreakPayload;
        const logged = Boolean(data.loggedToday);
        const streak = data.streak ?? 0;

        if (prevLogged.current === false && logged) {
          const milestonePending = findUnseenMilestone(streak) != null;

          if (milestonePending) {
            markSoftCelebrationSeen("day-opened", today);
            markSoftCelebrationSeen("streak-saved", today);
          } else if (streak > 0 && !isSoftCelebrationsMutedToday(today) &&
          !isSoftCelebrationSeen("streak-saved", today)) {
            markSoftCelebrationSeen("day-opened", today);
            markSoftCelebrationSeen("streak-saved", today);
            openedRef.current = true;
            setCopy({
              title: "Серия сохранена",
              subtitle: `${streak} ${pluralDays(streak)} подряд — отличный ход.`,
              badge: String(streak > 99 ? "99+" : streak),
              pose: "streak",
            });
            setOpen(true);
          } else if (!isSoftCelebrationsMutedToday(today) &&
          !isSoftCelebrationSeen("day-opened", today)) {
            markSoftCelebrationSeen("day-opened", today);
            openedRef.current = true;
            setCopy({
              title: "День открыт",
              subtitle: "Первая запись сегодня",
              pose: "cheer",
            });
            setOpen(true);
          }
        }

        prevLogged.current = logged;
      } catch {
        // non-critical
      }
    }

    for (const delay of RETRY_DELAYS_MS) {
      timers.push(window.setTimeout(() => void pollStreak(), delay));
    }

    return () => {
      cancelled = true;
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [today, selectedDate, refreshKey]);

  return (
    <SoftCelebration
      muteDate={today}
      open={open}
      title={copy.title}
      subtitle={copy.subtitle}
      pose={copy.pose}
      badge={copy.badge}
      onClose={close}
    />
  );
}
