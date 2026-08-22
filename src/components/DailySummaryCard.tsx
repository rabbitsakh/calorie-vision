"use client";

import { useEffect, useState } from "react";
import { formatDateShort } from "@/lib/dates";
import { formatCalorieVsTargetLabel } from "@/lib/diet";
import { withBasePath } from "@/lib/paths";

const SEEN_KEY_PREFIX = "summary-seen-";

type DailySummaryData = {
  date: string;
  today: string;
  mealCount: number;
  entryCount?: number;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalFiber?: number;
  totalSugar?: number;
  totalWaterMl: number;
  goal?: "LOSE" | "GAIN" | "MAINTAIN" | null;
  target: { calories: number } | null;
  comparison: { calories: { kind: "deficit" | "surplus" | "even" } } | null;
  tip: string;
  hasData: boolean;
};

function isSummarySeen(today: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(`${SEEN_KEY_PREFIX}${today}`) === "1";
  } catch {
    return true;
  }
}

function markSummarySeen(today: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${SEEN_KEY_PREFIX}${today}`, "1");
  } catch {
    // ignore
  }
}

type DailySummaryCardProps = {
  today: string;
};

export function DailySummaryCard({ today }: DailySummaryCardProps) {
  const [data, setData] = useState<DailySummaryData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isSummarySeen(today)) return;

    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/daily-summary"));
        if (!resp.ok) return;
        const json = (await resp.json()) as DailySummaryData;
        if (json.today !== today) return;
        setData(json);
        setVisible(true);
      } catch {
        // non-critical
      }
    })();
  }, [today]);

  if (!visible || !data) return null;

  function dismiss() {
    markSummarySeen(today);
    setVisible(false);
  }

  const entryCount = data.entryCount ?? data.mealCount;

  const calorieLabel =
    data.totalCalories > 0
      ? `${data.totalCalories} ккал`
      : "нет записей";

  const vsTarget =
    data.target && data.totalCalories > 0
      ? formatCalorieVsTargetLabel(data.totalCalories, data.target.calories, data.goal)
      : "";

  return (
    <div className="rounded-2xl border border-teal-100 bg-[var(--accent-summary-soft)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
            Итоги вчера
          </p>
          <p className="mt-0.5 font-semibold text-teal-950">
            {formatDateShort(data.date)}
          </p>
        </div>
        <button
          type="button"
          className="btn-quiet shrink-0 text-xs text-teal-700 hover:bg-teal-100"
          onClick={dismiss}
          aria-label="Закрыть"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white/70 px-3 py-2">
          <p className="text-xs text-slate-500">Калории</p>
          <p className="font-semibold text-slate-800">
            {calorieLabel}
            <span className="block text-xs font-normal text-slate-500">{vsTarget}</span>
          </p>
        </div>
        <div className="rounded-xl bg-white/70 px-3 py-2">
          <p className="text-xs text-slate-500">БЖУ / Кл / Сах</p>
          <p className="text-sm font-semibold text-slate-800">
            {entryCount > 0
              ? `${data.totalProtein}/${data.totalFat}/${data.totalCarbs} г`
              : "—"}
            {entryCount > 0 && ((data.totalFiber ?? 0) > 0 || (data.totalSugar ?? 0) > 0) ? (
              <span className="block text-xs font-normal text-slate-500">
                Кл {data.totalFiber ?? 0} · Сах {data.totalSugar ?? 0}
              </span>
            ) : null}
          </p>
        </div>
        <div className="rounded-xl bg-white/70 px-3 py-2">
          <p className="text-xs text-slate-500">Записей</p>
          <p className="font-semibold text-slate-800">{entryCount}</p>
        </div>
        <div className="rounded-xl bg-white/70 px-3 py-2">
          <p className="text-xs text-slate-500">Вода</p>
          <p className="font-semibold text-slate-800">
            {data.totalWaterMl > 0 ? `${data.totalWaterMl} мл` : "—"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-teal-900">{data.tip}</p>

      <button
        type="button"
        className="mt-3 text-sm font-medium text-teal-800 hover:text-teal-950"
        onClick={dismiss}
      >
        Понятно, спасибо
      </button>
    </div>
  );
}
