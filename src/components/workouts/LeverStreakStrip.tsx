"use client";

import { useEffect, useState } from "react";
import {
  listTopLeverHitStreaks,
  type LeverStreakListItem,
} from "@/lib/workouts/lever-outcome-history";

const LEVER_LABEL: Record<string, string> = {
  weight: "вес",
  volume: "тоннаж",
  reps: "повторы",
};

/**
 * K2 / M — soft strip of current lever hit streaks (History hub + Today).
 */
export function LeverStreakStrip({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<LeverStreakListItem[]>([]);

  useEffect(() => {
    setItems(listTopLeverHitStreaks(3));
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}
      aria-label="Серии по рычагам"
    >
      {items.map(({ name, streak }) => (
        <span
          key={`${name}-${streak.lever}`}
          className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--border-quiet)] bg-white/80 px-2 py-1 text-[11px] font-semibold text-[var(--accent-ink)]"
          title={`${name}: ${LEVER_LABEL[streak.lever] ?? streak.lever} ${streak.hitStreak}× подряд`}
        >
          <span className="truncate">{name}</span>
          <span className="shrink-0 text-[var(--accent-ink)]">
            {LEVER_LABEL[streak.lever] ?? streak.lever} · {streak.hitStreak}×
          </span>
        </span>
      ))}
    </div>
  );
}
