"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import { isWeightGoal, type WeightGoal } from "@/lib/diet";
import { withBasePath } from "@/lib/paths";
import {
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";

type WeightTargetCelebrationProps = {
  refreshKey: number;
};

type ProfilePayload = {
  goal?: WeightGoal | null;
  targetWeightKg?: number | null;
  currentWeightKg?: number | null;
};

const TARGET_TOLERANCE_KG = 0.5;

function weightGoalReached(
  goal: WeightGoal,
  currentKg: number,
  targetKg: number,
): boolean {
  const diff = currentKg - targetKg;
  if (goal === "LOSE") return diff <= TARGET_TOLERANCE_KG;
  if (goal === "GAIN") return diff >= -TARGET_TOLERANCE_KG;
  return Math.abs(diff) <= TARGET_TOLERANCE_KG;
}

/** Fires once when latest weight enters the goal weight corridor. */
export function WeightTargetCelebration({ refreshKey }: WeightTargetCelebrationProps) {
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState({ title: "", subtitle: "" });
  const prevReached = useRef<boolean | null>(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    void (async () => {
      try {
        const profileResp = await fetch(withBasePath("/api/profile"));
        if (!profileResp.ok) return;

        const profile = (await profileResp.json()) as ProfilePayload;
        const goal = isWeightGoal(profile.goal) ? profile.goal : null;
        const targetKg = profile.targetWeightKg ?? null;
        const currentKg = profile.currentWeightKg ?? null;

        if (!goal || targetKg == null || currentKg == null) {
          prevReached.current = false;
          return;
        }

        const reached = weightGoalReached(goal, currentKg, targetKg);
        const flagKey = `${goal}-${targetKg.toFixed(1)}`;

        if (
          prevReached.current === false &&
          reached &&
          !isSoftCelebrationSeen("weight-target", flagKey)
        ) {
          markSoftCelebrationSeen("weight-target", flagKey);
          setCopy({
            title: "Цель по весу!",
            subtitle: `${currentKg} кг — вы у цели ${targetKg} кг. Это результат регулярности.`,
          });
          setOpen(true);
        }

        prevReached.current = reached;
      } catch {
        // non-critical
      }
    })();
  }, [refreshKey]);

  return (
    <SoftCelebration
      open={open}
      title={copy.title}
      subtitle={copy.subtitle}
      pose="goal"
      badge="⚖"
      durationMs={4200}
      onClose={close}
    />
  );
}
