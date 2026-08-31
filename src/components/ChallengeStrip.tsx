"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { withBasePath } from "@/lib/paths";

const WeeklyChallenge = dynamic(
  () => import("@/components/WeeklyChallenge").then((m) => m.WeeklyChallenge),
  { ssr: false },
);

type ActiveChallenge = {
  title: string;
  progress: number;
  target: number;
  completed: boolean;
};

type ChallengeStripProps = {
  selectedDate: string;
  refreshKey: number;
  /** Expand habits accordion to manage challenge (when one is already active). */
  onOpenHabits?: () => void;
};

/**
 * Compact challenge progress under DayHero — visible without opening «Привычки».
 * Empty state opens the goal picker inline (not buried in the habits accordion).
 */
export function ChallengeStrip({ selectedDate, refreshKey, onOpenHabits }: ChallengeStripProps) {
  const day = useOptionalRationDay();
  const bootstrapped = day?.data?.challenges?.active;
  const [active, setActive] = useState<ActiveChallenge | null | undefined>(undefined);
  const [picking, setPicking] = useState(false);

  const load = useCallback(async () => {
    if (bootstrapped !== undefined && day && !day.loading) {
      setActive(bootstrapped);
      if (bootstrapped) setPicking(false);
      return;
    }
    try {
      const resp = await fetch(withBasePath("/api/challenges"));
      if (!resp.ok) return;
      const data = (await resp.json()) as { active: ActiveChallenge | null };
      setActive(data.active);
      if (data.active) setPicking(false);
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
      if (bootstrapped) setPicking(false);
    }
  }, [bootstrapped, day, day?.loading, day?.refreshKey]);

  if (active === undefined) return null;

  if (!active && picking) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <p className="text-sm font-semibold text-emerald-900">Выберите цель на неделю</p>
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:text-slate-700"
            onClick={() => setPicking(false)}
          >
            Свернуть
          </button>
        </div>
        <WeeklyChallenge
          selectedDate={selectedDate}
          refreshKey={refreshKey}
          onStarted={() => {
            setPicking(false);
            void load();
            day?.bump();
          }}
        />
      </div>
    );
  }

  if (!active) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-left"
        onClick={() => setPicking(true)}
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
