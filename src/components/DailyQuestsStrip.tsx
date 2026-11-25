"use client";

import { useEffect, useMemo, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { computeDailyQuests } from "@/lib/daily-quests";
import { isFirstWeekQuiet } from "@/lib/first-hour-trust";
import { trackQuestDoneGoal } from "@/lib/metrika-funnel";
import { withBasePath } from "@/lib/paths";
import { withDateQuery } from "@/lib/use-selected-date";
import Link from "next/link";

type DailyQuestsStripProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
};

/**
 * Checklist under «Ещё». The day chest lives on the leaf strip, so this list
 * no longer marks a second quest-day chest.
 */
export function DailyQuestsStrip({ selectedDate, today, refreshKey }: DailyQuestsStripProps) {
  const day = useOptionalRationDay();
  const [gymSessionCount, setGymSessionCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(
          withBasePath(`/api/workouts?date=${selectedDate}&limit=20`),
        );
        if (!resp.ok || cancelled) return;
        const payload = (await resp.json()) as {
          sessions?: Array<{
            endedAt?: string | null;
            setCount?: number;
            qualifiesForReward?: boolean;
          }>;
        };
        const count = (payload.sessions ?? []).filter((s) => {
          if (!s.endedAt) return false;
          if (typeof s.qualifiesForReward === "boolean") return s.qualifiesForReward;
          return (Number(s.setCount) || 0) > 0;
        }).length;
        if (!cancelled) setGymSessionCount(count);
      } catch {
        if (!cancelled) setGymSessionCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, refreshKey]);

  const progress = useMemo(() => {
    if (!day?.data || day.date !== selectedDate) return null;
    const mealCount = day.data.meals?.entries?.length ?? 0;
    return computeDailyQuests({
      mealCount,
      waterMl: day.data.water.totalMl,
      waterTarget: day.data.water.target,
      gymSessionCount,
    });
  }, [day, selectedDate, gymSessionCount]);

  useEffect(() => {
    if (selectedDate !== today || !progress) return;
    for (const quest of progress.quests) {
      if (quest.done) trackQuestDoneGoal(today, quest.id);
    }
  }, [selectedDate, today, progress]);

  if (!progress || selectedDate !== today) return null;

  const requiredQuests = progress.quests.filter((q) => !q.bonus);
  const doneCount = requiredQuests.filter((q) => q.done).length;

  return (
    <>
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-mist)]/50 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            На сегодня
          </p>
          <span className="text-xs font-bold tabular-nums text-[var(--muted-strong)]">
            {doneCount}/{requiredQuests.length}
          </span>
        </div>
        <ul className="mt-1.5 flex flex-col gap-1">
          {progress.quests.map((q) => (
            <li
              key={q.id}
              className={`flex items-center justify-between gap-2 text-sm ${
                q.done ? "text-[var(--accent-ink)]" : "text-[var(--muted-strong)]"
              }`}
            >
              <span className="truncate">
                {q.done ? "✓ " : "○ "}
                {q.title}
              </span>
              {q.done ? (
                <span className="shrink-0 text-[10px] font-medium text-[var(--accent)]">{q.doneHint}</span>
              ) : q.id === "gym_today" && isFirstWeekQuiet() ? (
                <Link
                  href={withBasePath(withDateQuery("/workouts", selectedDate))}
                  className="shrink-0 text-[10px] font-semibold text-[var(--accent-ink)] underline-offset-2 hover:underline"
                >
                  В зал
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        {isFirstWeekQuiet() && gymSessionCount === 0 ? (
          <p className="mt-1.5 text-xs text-[var(--muted)]">
            Бонус первой недели: короткая тренировка — и день ощущается полнее.
          </p>
        ) : null}
        {progress.allDone ? (
          <p className="mt-1.5 text-xs text-[var(--accent-ink)]">День закрыт мягко — так и надо.</p>
        ) : null}
      </div>
    </>
  );
}
