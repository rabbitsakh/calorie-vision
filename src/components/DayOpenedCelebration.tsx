"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import { withBasePath } from "@/lib/paths";
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
};

/**
 * Fires once when the user goes from “no meals today” → “at least one”,
 * after a save that bumps refreshKey on the ration page.
 */
export function DayOpenedCelebration({
  today,
  selectedDate,
  refreshKey,
}: DayOpenedCelebrationProps) {
  const [open, setOpen] = useState(false);
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

        if (
          prevLogged.current === false &&
          logged &&
          !isSoftCelebrationSeen("day-opened", today)
        ) {
          markSoftCelebrationSeen("day-opened", today);
          setOpen(true);
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
      title="День открыт"
      subtitle="Первая запись сегодня — привычка снова в деле."
      onClose={close}
    />
  );
}
