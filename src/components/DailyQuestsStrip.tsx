"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { openChest } from "@/lib/chest-client";
import { computeDailyQuests } from "@/lib/daily-quests";
import { QUEST_DAYS_PER_CHEST } from "@/lib/rewards";
import {
  isSoftCelebrationSeen,
  isSoftCelebrationsMutedToday,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";
import { toDateKey } from "@/lib/dates";

type DailyQuestsStripProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
};

/**
 * Soft daily micro-quests on ration. Chest every N completed quest-days (wave 4).
 */
export function DailyQuestsStrip({ selectedDate, today, refreshKey }: DailyQuestsStripProps) {
  const day = useOptionalRationDay();
  const [celebrate, setCelebrate] = useState(false);
  const [loot, setLoot] = useState<{ title: string; description: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const claimedRef = useRef<string | null>(null);
  const todayKey = toDateKey(new Date());

  const progress = useMemo(() => {
    if (!day?.data || day.date !== selectedDate) return null;
    const mealCount = day.data.meals?.entries?.length ?? 0;
    return computeDailyQuests({
      mealCount,
      waterMl: day.data.water.totalMl,
      waterTarget: day.data.water.target,
    });
  }, [day, selectedDate]);

  const tryClaim = useCallback(async () => {
    if (selectedDate !== today) return;
    if (!progress?.allDone) return;
    if (claimedRef.current === today) return;
    if (isSoftCelebrationsMutedToday(todayKey)) return;
    if (isSoftCelebrationSeen("quest-chest", today)) return;

    claimedRef.current = today;
    const result = await openChest({ source: "quest", date: today });
    if (!result) return;

    if (result.reward) {
      markSoftCelebrationSeen("quest-chest", today);
      setLoot({ title: result.reward.title, description: result.reward.description });
      setCelebrate(true);
      setHint(null);
      return;
    }

    const nextIn = result.nextChestIn ?? QUEST_DAYS_PER_CHEST;
    setHint(
      nextIn <= 0
        ? null
        : `Ещё ${nextIn} лёгких дня до сундука`,
    );
    markSoftCelebrationSeen("quest-chest", today);
  }, [progress?.allDone, selectedDate, today, todayKey]);

  useEffect(() => {
    void tryClaim();
  }, [tryClaim, refreshKey]);

  if (!progress || selectedDate !== today) return null;

  const doneCount = progress.quests.filter((q) => q.done).length;

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            На сегодня
          </p>
          <span className="text-xs font-bold tabular-nums text-slate-600">
            {doneCount}/{progress.quests.length}
          </span>
        </div>
        <ul className="mt-1.5 flex flex-col gap-1">
          {progress.quests.map((q) => (
            <li
              key={q.id}
              className={`flex items-center justify-between gap-2 text-sm ${
                q.done ? "text-teal-800" : "text-slate-600"
              }`}
            >
              <span className="truncate">
                {q.done ? "✓ " : "○ "}
                {q.title}
              </span>
              {q.done ? (
                <span className="shrink-0 text-[10px] font-medium text-teal-600">{q.doneHint}</span>
              ) : null}
            </li>
          ))}
        </ul>
        {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
        {progress.allDone && !hint && !celebrate ? (
          <p className="mt-1.5 text-xs text-teal-700">День закрыт мягко — так и надо.</p>
        ) : null}
      </div>

      <SoftCelebration
        open={celebrate}
        variant="chest"
        pose="cheer"
        title="Сундук за ритм!"
        subtitle={
          loot
            ? `${loot.title}. ${loot.description}`
            : "Несколько спокойных дней — и вот награда."
        }
        badge="✦"
        durationMs={0}
        ctaLabel="Круто!"
        muteDate={todayKey}
        onClose={() => {
          setCelebrate(false);
          setLoot(null);
        }}
      />
    </>
  );
}
