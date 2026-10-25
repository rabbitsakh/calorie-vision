"use client";

import { useEffect, useRef } from "react";
import { notifyChestQueueRefresh } from "@/lib/chest-queue-refresh";
import { CELEBRATION_STREAK_MILESTONES } from "@/lib/streak-chest";

function seenKey(milestone: number): string {
  return `milestone-seen-${milestone}`;
}

function isMilestoneSeen(milestone: number): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(seenKey(milestone)) === "1";
  } catch {
    return true;
  }
}

function markMilestoneSeen(milestone: number): void {
  try {
    localStorage.setItem(seenKey(milestone), "1");
  } catch {
    // ignore
  }
}

/** Highest reached celebration milestone that hasn't been nudged yet. */
export function findUnseenMilestone(streak: number): number | null {
  const reached = CELEBRATION_STREAK_MILESTONES.filter((m) => streak >= m);
  for (let i = reached.length - 1; i >= 0; i--) {
    const m = reached[i]!;
    if (!isMilestoneSeen(m)) return m;
  }
  return null;
}

type MilestoneCelebrationProps = {
  streak: number;
};

/**
 * C3 — streak milestone no longer auto-opens a chest.
 * Nudges ChestDock ready queue once per milestone.
 */
export function MilestoneCelebration({ streak }: MilestoneCelebrationProps) {
  const nudged = useRef<number | null>(null);

  useEffect(() => {
    const next = findUnseenMilestone(streak);
    if (next == null || nudged.current === next) return;
    nudged.current = next;
    markMilestoneSeen(next);
    notifyChestQueueRefresh();
  }, [streak]);

  return null;
}
