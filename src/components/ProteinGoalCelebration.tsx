"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import { isWeightGoal, type WeightGoal } from "@/lib/diet";
import { withBasePath } from "@/lib/paths";
import {
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";

type ProteinGoalCelebrationProps = {
  today: string;
  selectedDate: string;
  refreshKey: number;
};

type MealsDayPayload = {
  totalProtein?: number;
  goal?: WeightGoal | null;
  target?: { protein: number } | null;
};

const PROTEIN_HIT_RATIO = 0.92;

/** Fires once when daily protein first reaches ~92% of the goal-aware target. */
export function ProteinGoalCelebration({
  today,
  selectedDate,
  refreshKey,
}: ProteinGoalCelebrationProps) {
  const [open, setOpen] = useState(false);
  const [subtitle, setSubtitle] = useState("");
  const prevHit = useRef<boolean | null>(null);
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
        const actual = data.totalProtein ?? 0;
        const target = data.target?.protein ?? 0;
        const goal = isWeightGoal(data.goal) ? data.goal : null;

        if (!target || !goal || actual <= 0) {
          prevHit.current = false;
          return;
        }

        const hit = actual >= target * PROTEIN_HIT_RATIO;

        if (
          prevHit.current === false &&
          hit &&
          !isSoftCelebrationSeen("protein-goal", today)
        ) {
          markSoftCelebrationSeen("protein-goal", today);
          setSubtitle(`${actual} / ${target} г белка — цель по макросам близко.`);
          setOpen(true);
        }

        prevHit.current = hit;
      } catch {
        // non-critical
      }
    })();
  }, [today, selectedDate, refreshKey]);

  return (
    <SoftCelebration
      open={open}
      title="Белок в норме"
      subtitle={subtitle}
      pose="goal"
      onClose={close}
    />
  );
}
