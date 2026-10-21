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
 * Soft ration chip: quest chest bar + meta progress (R1–R3, R10).
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

  const pct =
    model.per > 0 ? Math.min(100, Math.round((model.filled / model.per) * 100)) : 0;

  return (
    <div className="pt-2">
      <Link
        href={href}
        className="inline-flex max-w-full flex-col gap-1 rounded-lg border border-[var(--accent)]/35 bg-[var(--accent-soft)] px-2.5 py-1.5 text-xs font-semibold text-[var(--accent-ink)] shadow-[0_1px_0_rgba(13,115,119,0.08)] hover:border-[var(--accent)]/55"
        title="Прогресс к сундуку за сегодня · привычки"
      >
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span aria-hidden className="text-[var(--accent)]">
            ✦
          </span>
          <span className="truncate">{model.label}</span>
          {model.metaLabel ? (
            <span className="shrink-0 font-medium text-[var(--accent-ink)]/70">
              · {model.metaLabel}
            </span>
          ) : null}
        </span>
        <span
          className="block h-1.5 w-full min-w-[7.5rem] overflow-hidden rounded-full bg-white/70"
          aria-hidden
        >
          <span
            className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </span>
        <span className="sr-only">
          {model.filled} из {model.per} дней к сундуку
        </span>
      </Link>
    </div>
  );
}
