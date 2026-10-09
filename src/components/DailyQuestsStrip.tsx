"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FullscreenCelebration } from "@/components/FullscreenCelebration";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { flushPendingMetaChests, openChest } from "@/lib/chest-client";
import type { RewardRarity } from "@/lib/rewards";
import { computeDailyQuests } from "@/lib/daily-quests";
import { QUEST_DAYS_PER_CHEST } from "@/lib/rewards";
import { shouldDeferQuestChestForPostWorkout } from "@/lib/post-workout-nudge";
import {
  isSoftCelebrationQuietBlocked,
  isSoftCelebrationSeen,
  isSoftCelebrationsMutedToday,
  markSoftCelebrationSeen,
  muteSoftCelebrationsToday,
} from "@/lib/soft-celebration";
import { toDateKey } from "@/lib/dates";
import { isFirstWeekQuiet } from "@/lib/first-hour-trust";
import { withBasePath } from "@/lib/paths";
import { withDateQuery } from "@/lib/use-selected-date";
import Link from "next/link";

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
  const [loot, setLoot] = useState<{
    key?: string;
    title: string;
    description: string;
    rarity?: RewardRarity;
    rarityLabel?: string;
  } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const claimedRef = useRef<string | null>(null);
  const todayKey = toDateKey(new Date());

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
          sessions?: Array<{ endedAt?: string | null; setCount?: number; elapsedSec?: number }>;
        };
        const count = (payload.sessions ?? []).filter(
          (s) =>
            Boolean(s.endedAt) ||
            (Number(s.elapsedSec) || 0) > 0 ||
            (Number(s.setCount) || 0) > 0,
        ).length;
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

  const tryClaim = useCallback(async () => {
    if (selectedDate !== today) return;
    if (!progress?.allDone) return;
    if (claimedRef.current === today) return;
    if (isSoftCelebrationsMutedToday(todayKey)) return;
    if (isSoftCelebrationQuietBlocked()) return;
    if (isSoftCelebrationSeen("quest-chest", today)) return;
    // Let NextStepBar own «после зала — белок» before stacking a chest.
    if (
      shouldDeferQuestChestForPostWorkout({
        protein: day?.data?.meals?.totalProtein ?? 0,
        proteinTarget: day?.data?.meals?.target?.protein ?? 0,
      })
    ) {
      return;
    }

    claimedRef.current = today;
    const result = await openChest({ source: "quest", date: today });
    if (!result) return;

    if (result.reward) {
      markSoftCelebrationSeen("quest-chest", today);
      setLoot({
        key: result.reward.key,
        title: result.reward.title,
        description: result.reward.description,
        rarity: result.reward.rarity,
        rarityLabel: result.reward.rarityLabel,
      });
      setCelebrate(true);
      setHint(null);
      return;
    }

    flushPendingMetaChests();
    const nextIn = result.nextChestIn ?? QUEST_DAYS_PER_CHEST;
    setHint(
      nextIn <= 0
        ? null
        : `Ещё ${nextIn} лёгких дня до сундука`,
    );
    markSoftCelebrationSeen("quest-chest", today);
  }, [
    progress?.allDone,
    selectedDate,
    today,
    todayKey,
    day?.data?.meals?.totalProtein,
    day?.data?.meals?.target?.protein,
  ]);

  useEffect(() => {
    void tryClaim();
  }, [tryClaim, refreshKey]);

  if (!progress || selectedDate !== today) return null;

  const requiredQuests = progress.quests.filter((q) => !q.bonus);
  const doneCount = requiredQuests.filter((q) => q.done).length;

  return (
    <>
      <div className="rounded-xl border border-[rgba(13,115,119,0.14)] bg-white px-3 py-2.5">
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
                q.done ? "text-teal-800" : "text-[var(--muted-strong)]"
              }`}
            >
              <span className="truncate">
                {q.done ? "✓ " : "○ "}
                {q.title}
                {q.bonus && !q.done ? (
                  <span className="ml-1 text-[10px] font-medium text-[var(--muted)]">бонус</span>
                ) : null}
              </span>
              {q.done ? (
                <span className="shrink-0 text-[10px] font-medium text-teal-600">{q.doneHint}</span>
              ) : q.id === "gym_today" && isFirstWeekQuiet() ? (
                <Link
                  href={withBasePath(withDateQuery("/workouts", selectedDate))}
                  className="shrink-0 text-[10px] font-semibold text-teal-700 underline-offset-2 hover:underline"
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
        {hint ? <p className="mt-1.5 text-xs text-[var(--muted)]">{hint}</p> : null}
        {progress.allDone && !hint && !celebrate ? (
          <p className="mt-1.5 text-xs text-teal-700">День закрыт мягко — так и надо.</p>
        ) : null}
      </div>

      <FullscreenCelebration
        open={celebrate}
        variant="chest"
        pose="cheer"
        title={loot?.title ?? "Сундук за ритм!"}
        subtitle={
          loot ? loot.description : "Несколько спокойных дней — и вот награда."
        }
        lootKey={loot?.key}
        lootRarity={loot?.rarity}
        lootRarityLabel={loot?.rarityLabel}
        badge="✦"
        durationMs={0}
        ctaLabel="Круто!"
        onMuteToday={() => muteSoftCelebrationsToday(todayKey)}
        onClose={() => {
          setCelebrate(false);
          setLoot(null);
          flushPendingMetaChests();
        }}
      />
    </>
  );
}
