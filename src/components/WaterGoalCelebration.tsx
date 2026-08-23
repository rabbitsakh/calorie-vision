"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import { withBasePath } from "@/lib/paths";
import {
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";
import { WATER_DAILY_TARGET_ML } from "@/lib/water-target";

type WaterGoalCelebrationProps = {
  today: string;
  selectedDate: string;
  refreshKey: number;
};

type WaterPayload = {
  totalMl?: number;
  target?: number;
};

/** Fires once when daily water first reaches the target. */
export function WaterGoalCelebration({
  today,
  selectedDate,
  refreshKey,
}: WaterGoalCelebrationProps) {
  const [open, setOpen] = useState(false);
  const prevDone = useRef<boolean | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (selectedDate !== today) return;

    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/water?date=${encodeURIComponent(today)}`));
        if (!resp.ok) return;
        const data = (await resp.json()) as WaterPayload;
        const total = data.totalMl ?? 0;
        const target = data.target ?? WATER_DAILY_TARGET_ML;
        const done = total >= target && target > 0;

        if (
          prevDone.current === false &&
          done &&
          !isSoftCelebrationSeen("water-goal", today)
        ) {
          markSoftCelebrationSeen("water-goal", today);
          setOpen(true);
        }

        prevDone.current = done;
      } catch {
        // non-critical
      }
    })();
  }, [today, selectedDate, refreshKey]);

  return (
    <SoftCelebration
      open={open}
      title="Норма воды!"
      subtitle="Дневная цель по воде закрыта — отличная привычка."
      pose="cheer"
      onClose={close}
    />
  );
}
