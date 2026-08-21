"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import {
  dailyGoalCelebrationCopy,
  isCalorieGoalCorridor,
  isDangerousCalorieUndereat,
  isWeightGoal,
  type WeightGoal,
} from "@/lib/diet";
import { withBasePath } from "@/lib/paths";
import {
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";

type DailyGoalCelebrationProps = {
  today: string;
  selectedDate: string;
  refreshKey: number;
};

type MealsDayPayload = {
  totalCalories?: number;
  goal?: WeightGoal | null;
  target?: { calories: number } | null;
};

/**
 * Fires once when daily calories first enter the ±8% goal corridor.
 * Never celebrates dangerous LOSE undereating (<75% of target).
 */
export function DailyGoalCelebration({
  today,
  selectedDate,
  refreshKey,
}: DailyGoalCelebrationProps) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState(() => dailyGoalCelebrationCopy(null));
  const prevInCorridor = useRef<boolean | null>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (selectedDate !== today) return;

    void (async () => {
      try {
        const resp = await fetch(
          withBasePath(`/api/meals?date=${encodeURIComponent(today)}`),
        );
        if (!resp.ok) return;
        const data = (await resp.json()) as MealsDayPayload;
        const actual = data.totalCalories ?? 0;
        const target = data.target?.calories ?? 0;
        const goal = isWeightGoal(data.goal) ? data.goal : null;

        if (!target || !goal) {
          prevInCorridor.current = false;
          return;
        }

        if (isDangerousCalorieUndereat(actual, target, goal)) {
          prevInCorridor.current = false;
          return;
        }

        const inCorridor = isCalorieGoalCorridor(actual, target);

        if (
          prevInCorridor.current === false &&
          inCorridor &&
          !isSoftCelebrationSeen("daily-goal", today)
        ) {
          markSoftCelebrationSeen("daily-goal", today);
          setCopy(dailyGoalCelebrationCopy(goal));
          setOpen(true);
        }

        prevInCorridor.current = inCorridor;
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
      onClose={close}
    />
  );
}
