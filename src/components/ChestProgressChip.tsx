"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { withBasePath } from "@/lib/paths";
import { QUEST_DAYS_PER_CHEST } from "@/lib/rewards";

type ChestProgressChipProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
};

type RewardsProgress = {
  questDayCount: number;
  questDaysPerChest: number;
  nextIn: number;
};

/**
 * Soft ration chip: progress toward the next quest chest (R1d).
 * Visible outside «Ещё» so quiet users still see the loop.
 */
export function ChestProgressChip({
  selectedDate,
  today,
  refreshKey,
}: ChestProgressChipProps) {
  const [progress, setProgress] = useState<RewardsProgress | null>(null);

  useEffect(() => {
    if (selectedDate !== today) {
      setProgress(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/rewards"), { cache: "no-store" });
        if (!resp.ok || cancelled) return;
        const data = (await resp.json()) as {
          questDayCount?: number;
          questDaysPerChest?: number;
        };
        const per = data.questDaysPerChest ?? QUEST_DAYS_PER_CHEST;
        const count = Math.max(0, Number(data.questDayCount) || 0);
        const remainder = count % per;
        const nextIn = remainder === 0 && count > 0 ? per : per - remainder;
        if (!cancelled) {
          setProgress({
            questDayCount: count,
            questDaysPerChest: per,
            nextIn,
          });
        }
      } catch {
        if (!cancelled) setProgress(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, today, refreshKey]);

  if (!progress || selectedDate !== today) return null;

  const filled =
    progress.questDayCount > 0 && progress.nextIn === progress.questDaysPerChest
      ? progress.questDaysPerChest
      : progress.questDaysPerChest - progress.nextIn;
  const label =
    progress.questDayCount === 0
      ? `Сундук · 0/${progress.questDaysPerChest}`
      : filled === progress.questDaysPerChest
        ? "Сундук · готов при закрытии дня"
        : `Сундук · ${filled}/${progress.questDaysPerChest}`;

  return (
    <div className="pt-2">
      <Link
        href={withBasePath("/profile#rewards")}
        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[rgba(13,115,119,0.12)] bg-white/80 px-2.5 py-1 text-xs font-semibold text-teal-900 hover:border-teal-300"
        title="Прогресс к сундуку за спокойные дни"
      >
        <span aria-hidden>✦</span>
        <span className="truncate">{label}</span>
      </Link>
    </div>
  );
}
