"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { buildChestProgressChip } from "@/lib/chest-progress-chip";
import { withBasePath } from "@/lib/paths";
import { withDateQuery } from "@/lib/use-selected-date";

type ChestProgressChipProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
};

/**
 * Soft ration chip: quest chest + meta progress (R1–R3).
 */
export function ChestProgressChip({
  selectedDate,
  today,
  refreshKey,
}: ChestProgressChipProps) {
  const [model, setModel] = useState<ReturnType<typeof buildChestProgressChip> | null>(
    null,
  );

  useEffect(() => {
    if (selectedDate !== today) {
      setModel(null);
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
          ownedCount?: number;
        };
        if (!cancelled) {
          setModel(
            buildChestProgressChip({
              questDayCount: data.questDayCount ?? 0,
              questDaysPerChest: data.questDaysPerChest,
              ownedCount: data.ownedCount,
            }),
          );
        }
      } catch {
        if (!cancelled) setModel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, today, refreshKey]);

  if (!model || selectedDate !== today) return null;

  const href =
    model.href === "habits"
      ? `${withBasePath(withDateQuery("/ration", selectedDate))}#habits-panel`
      : withBasePath("/profile#rewards");

  const label = model.metaLabel
    ? `${model.label} · ${model.metaLabel}`
    : model.label;

  return (
    <div className="pt-2">
      <Link
        href={href}
        className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[rgba(13,115,119,0.12)] bg-white/80 px-2.5 py-1 text-xs font-semibold text-teal-900 hover:border-teal-300"
        title="Прогресс к сундуку и мета-коллекции"
      >
        <span aria-hidden>✦</span>
        <span className="truncate">{label}</span>
      </Link>
    </div>
  );
}
