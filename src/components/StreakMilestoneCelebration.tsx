"use client";

import { useEffect, useState } from "react";
import { MilestoneCelebration } from "@/components/MilestoneCelebration";
import { withBasePath } from "@/lib/paths";

type StreakMilestoneCelebrationProps = {
  today: string;
  selectedDate: string;
  refreshKey: number;
};

/**
 * Renders streak milestone modals at page root (not inside collapsed streak panel)
 * so fullscreen celebrations are not clipped by parent layout.
 */
export function StreakMilestoneCelebration({
  today,
  selectedDate,
  refreshKey,
}: StreakMilestoneCelebrationProps) {
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (selectedDate !== today) return;

    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/streak?today=${encodeURIComponent(today)}`));
        if (!resp.ok) return;
        const data = (await resp.json()) as { streak?: number };
        setStreak(data.streak ?? 0);
      } catch {
        // non-critical
      }
    })();
  }, [today, selectedDate, refreshKey]);

  return streak > 0 ? <MilestoneCelebration streak={streak} /> : null;
}
