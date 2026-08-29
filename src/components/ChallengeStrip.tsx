"use client";

import { useCallback, useEffect, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { withBasePath } from "@/lib/paths";

type ActiveChallenge = {
  title: string;
  progress: number;
  target: number;
  completed: boolean;
};

type ChallengeStripProps = {
  refreshKey: number;
  /** Expand habits accordion to pick / manage challenge. */
  onOpenHabits?: () => void;
};

/**
 * Compact challenge progress under DayHero — visible without opening «Привычки».
 * Prefers ration-day bootstrap; falls back to /api/challenges.
 */
export function ChallengeStrip({ refreshKey, onOpenHabits }: ChallengeStripProps) {
  const day = useOptionalRationDay();
  const bootstrapped = day?.data?.challenges?.active;
  const [active, setActive] = useState<ActiveChallenge | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (bootstrapped !== undefined && day && !day.loading) {
      setActive(bootstrapped);
      return;
    }
    try {
      const resp = await fetch(withBasePath("/api/challenges"));
      if (!resp.ok) return;
      const data = (await resp.json()) as { active: ActiveChallenge | null };
      setActive(data.active);
    } catch {
      // non-critical
    }
  }, [bootstrapped, day]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (bootstrapped !== undefined && day && !day.loading) {
      setActive(bootstrapped);
    }
  }, [bootstrapped, day, day?.loading, day?.refreshKey]);

  if (active === undefined) return null;

  if (!active) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-left"
        onClick={onOpenHabits}
      >
        <span className="text-sm font-medium text-emerald-900">Челлендж недели — выбрать цель</span>
        <span className="text-xs font-semibold text-emerald-700">Выбрать</span>
      </button>
    );
  }

  const pct = Math.min(100, Math.round((active.progress / Math.max(1, active.target)) * 100));

  return (
    <button
      type="button"
      className="flex w-full flex-col gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-left"
      onClick={onOpenHabits}
      aria-label={`Челлендж: ${active.title}, ${active.progress} из ${active.target}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-semibold text-emerald-950">{active.title}</span>
        <span className="shrink-0 text-xs font-bold tabular-nums text-emerald-800">
          {active.completed ? "Готово" : `${active.progress}/${active.target}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-emerald-200/90">
        <div
          className={`h-full rounded-full ${active.completed ? "bg-emerald-600" : "bg-teal-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </button>
  );
}
