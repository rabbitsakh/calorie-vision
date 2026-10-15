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
 * K2 — soft strip of current lever hit streaks on the gym History hub.
 */
export function LeverStreakStrip() {
  const [items, setItems] = useState<LeverStreakListItem[]>([]);

  useEffect(() => {
    setItems(listTopLeverHitStreaks(3));
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className="mt-2 flex flex-wrap items-center gap-1.5"
      aria-label="Серии по рычагам"
    >
      {items.map(({ name, streak }) => (
        <span
          key={`${name}-${streak.lever}`}
          className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[rgba(13,115,119,0.12)] bg-white/80 px-2 py-1 text-[11px] font-semibold text-teal-900"
          title={`${name}: ${LEVER_LABEL[streak.lever] ?? streak.lever} ${streak.hitStreak}× подряд`}
        >
          <span className="truncate">{name}</span>
          <span className="shrink-0 text-teal-700">
            {LEVER_LABEL[streak.lever] ?? streak.lever} · {streak.hitStreak}×
          </span>
        </span>
      ))}
    </div>
  );
}
