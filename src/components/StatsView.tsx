"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateShort } from "@/lib/dates";
import { withBasePath } from "@/lib/paths";

type StatsDay = {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  weightKg: number | null;
};

type StatsResponse = {
  period: "week" | "month";
  days: StatsDay[];
  summary: {
    avgCalories: number;
    totalMealDays: number;
    weightChangeKg: number | null;
    firstWeightKg: number | null;
    lastWeightKg: number | null;
    daysWithWeight: number;
  };
  error?: string;
};

type StatsViewProps = {
  endDate: string;
};

function chartRange(values: number[], paddingRatio = 0.1): { min: number; max: number } {
  const filtered = values.filter((value) => value > 0);
  if (filtered.length === 0) {
    return { min: 0, max: 1 };
  }

  const rawMin = Math.min(...filtered);
  const rawMax = Math.max(...filtered);

  if (rawMin === rawMax) {
    const pad = Math.max(rawMin * 0.05, 1);
    return { min: Math.max(0, rawMin - pad), max: rawMax + pad };
  }

  const span = rawMax - rawMin;
  const pad = span * paddingRatio;
  return { min: Math.max(0, rawMin - pad), max: rawMax + pad };
}

function shouldShowDateLabel(index: number, total: number, period: "week" | "month"): boolean {
  if (period === "week") {
    return true;
  }

  if (index === 0 || index === total - 1) {
    return true;
  }

  return index % 7 === 0;
}

function formatChartValue(value: number, valueKey: "calories" | "weightKg"): string {
  if (valueKey === "weightKg") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  return String(Math.round(value));
}

function yAxisTicks(min: number, max: number, count = 4): number[] {
  if (count < 2) {
    return [max, min];
  }

  const span = max - min;
  const ticks: number[] = [];
  for (let index = 0; index < count; index += 1) {
    ticks.push(min + (span * index) / (count - 1));
  }

  return ticks.reverse();
}

function BarChart({
  days,
  valueKey,
  unit,
  period,
}: {
  days: StatsDay[];
  valueKey: "calories" | "weightKg";
  unit: string;
  period: "week" | "month";
}) {
  const values = days.map((day) => {
    if (valueKey === "weightKg") {
      return day.weightKg ?? 0;
    }
    return day.calories;
  });

  const presentValues = values.filter((value) => value > 0);
  const { min, max } = chartRange(presentValues);
  const span = Math.max(max - min, 1);
  const ticks = yAxisTicks(min, max);
  const plotHeight = 144;
  // label area reserved above the bar area so labels never overlap bars
  const labelAreaHeight = period === "month" ? 28 : 24;

  function barHeightPx(value: number | null | undefined): number {
    if (!value || value <= 0) {
      return 0;
    }

    return Math.max(Math.round(((value - min) / span) * plotHeight), 6);
  }

  const valueLabelClass =
    period === "month" ? "text-[8px] sm:text-[9px]" : "text-[9px] sm:text-[10px]";

  return (
    <div className="flex gap-2 sm:gap-3">
      <div
        className="relative shrink-0 text-right text-[10px] font-medium text-slate-400 sm:text-xs"
        style={{ height: plotHeight + labelAreaHeight, width: "2.75rem" }}
        aria-hidden="true"
      >
        {ticks.map((tick, index) => (
          <span
            key={`${tick}-${index}`}
            className="absolute right-0 -translate-y-1/2 leading-none"
            style={{ top: `${labelAreaHeight + (index / (ticks.length - 1)) * plotHeight}px` }}
          >
            {formatChartValue(tick, valueKey)}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1 border-l border-slate-200 pl-2 sm:pl-3">
        {/* label row above chart */}
        <div className="flex gap-0.5 sm:gap-1" style={{ height: labelAreaHeight }}>
          {days.map((day) => {
            const value = valueKey === "weightKg" ? day.weightKg : day[valueKey];
            return (
              <div key={`lbl-${day.date}`} className="flex min-w-0 flex-1 items-end justify-center">
                {value && value > 0 ? (
                  <span
                    className={`block whitespace-nowrap font-semibold leading-none text-slate-700 ${valueLabelClass}`}
                    style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
                  >
                    {formatChartValue(value, valueKey)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* bar plot area */}
        <div className="relative" style={{ height: plotHeight }}>
          {ticks.map((tick, index) => (
            <div
              key={`grid-${tick}-${index}`}
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-slate-100"
              style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
            />
          ))}

          <div className="absolute inset-0 flex gap-0.5 sm:gap-1">
            {days.map((day) => {
              const value = valueKey === "weightKg" ? day.weightKg : day[valueKey];
              const heightPx = barHeightPx(value);

              return (
                <div key={day.date} className="relative min-w-0 flex-1">
                  {value && value > 0 ? (
                    <div
                      className={`absolute bottom-0 left-1/2 w-[55%] max-w-6 min-w-2 shrink-0 -translate-x-1/2 rounded-t-md ${
                        valueKey === "calories" ? "bg-teal-600" : "bg-sky-600"
                      }`}
                      style={{ height: `${heightPx}px` }}
                      title={`${formatDateShort(day.date)}: ${formatChartValue(value, valueKey)} ${unit}`}
                    />
                  ) : (
                    <div className="absolute bottom-0 left-1/2 h-0.5 w-[55%] max-w-6 min-w-2 -translate-x-1/2 rounded bg-slate-100" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-1 flex gap-0.5 sm:gap-1">
          {days.map((day, index) => {
            const showDateLabel = shouldShowDateLabel(index, days.length, period);
            return (
              <div key={`${day.date}-label`} className="min-w-0 flex-1 text-center">
                <span
                  className={`block truncate text-[10px] font-medium text-slate-500 sm:text-xs ${
                    showDateLabel ? "" : "invisible"
                  }`}
                  aria-hidden={!showDateLabel}
                >
                  {formatDateShort(day.date)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WeightLineChart({ days, period }: { days: StatsDay[]; period: "week" | "month" }) {
  const points = days
    .map((day, index) => ({ index, date: day.date, value: day.weightKg }))
    .filter((point): point is { index: number; date: string; value: number } => point.value !== null && point.value > 0);

  if (points.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Нет измерений веса за период</p>;
  }

  const plotHeight = 144;
  const plotWidth = 100; // percentage
  const weights = points.map((p) => p.value);
  const { min, max } = chartRange(weights);
  const span = Math.max(max - min, 0.1);
  const ticks = yAxisTicks(min, max);
  const totalDays = days.length;

  function xPct(dayIndex: number): number {
    return totalDays <= 1 ? 50 : (dayIndex / (totalDays - 1)) * plotWidth;
  }
  function yPct(value: number): number {
    return ((max - value) / span) * 100;
  }

  const svgPoints = points.map((p) => `${xPct(p.index)},${yPct(p.value)}`).join(" ");

  return (
    <div className="flex gap-2 sm:gap-3">
      <div
        className="relative shrink-0 text-right text-[10px] font-medium text-slate-400 sm:text-xs"
        style={{ height: plotHeight, width: "2.75rem" }}
        aria-hidden="true"
      >
        {ticks.map((tick, index) => (
          <span
            key={`${tick}-${index}`}
            className="absolute right-0 -translate-y-1/2 leading-none"
            style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
          >
            {formatChartValue(tick, "weightKg")}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1 border-l border-slate-200 pl-2 sm:pl-3">
        <div className="relative" style={{ height: plotHeight }}>
          {ticks.map((tick, index) => (
            <div
              key={`grid-${tick}-${index}`}
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-slate-100"
              style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
            />
          ))}

          <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${plotWidth} 100`} preserveAspectRatio="none">
            <polyline
              points={svgPoints}
              fill="none"
              stroke="#0284c7"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>

          {points.map((p) => (
            <div
              key={p.date}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${xPct(p.index)}%`, top: `${yPct(p.value)}%` }}
            >
              <div className="h-2.5 w-2.5 rounded-full border-2 border-sky-600 bg-white" title={`${formatDateShort(p.date)}: ${p.value} кг`} />
              <span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-[9px] font-semibold leading-none text-slate-700 sm:text-[10px]" style={{ bottom: "14px" }}>
                {formatChartValue(p.value, "weightKg")}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-1 flex">
          {days.map((day, index) => {
            const showLabel = shouldShowDateLabel(index, days.length, period);
            return (
              <div key={day.date} className="min-w-0 flex-1 text-center">
                <span className={`block truncate text-[10px] font-medium text-slate-500 sm:text-xs ${showLabel ? "" : "invisible"}`}>
                  {formatDateShort(day.date)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function StatsView({ endDate }: StatsViewProps) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath(`/api/stats?period=${period}&end=${endDate}`));
      const payload = (await response.json()) as StatsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось загрузить статистику");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [endDate, period]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 sm:max-w-xs">
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${period === "week" ? "bg-white text-teal-800 shadow" : "text-slate-600"}`}
          onClick={() => setPeriod("week")}
        >
          Неделя
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-2 text-sm font-semibold ${period === "month" ? "bg-white text-teal-800 shadow" : "text-slate-600"}`}
          onClick={() => setPeriod("month")}
        >
          Месяц
        </button>
      </div>

      {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Среднее ккал/день</div>
              <div className="mt-1 text-2xl font-bold">{data.summary.avgCalories}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Дней с едой</div>
              <div className="mt-1 text-2xl font-bold">{data.summary.totalMealDays}</div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Изменение веса</div>
              <div className="mt-1 text-2xl font-bold">
                {data.summary.weightChangeKg != null
                  ? `${data.summary.weightChangeKg > 0 ? "+" : ""}${data.summary.weightChangeKg} кг`
                  : "—"}
              </div>
            </div>
          </div>

          <section className="card p-4 md:p-6">
            <h2 className="text-lg font-bold">Калории по дням</h2>
            <div className="mt-4">
              <BarChart days={data.days} valueKey="calories" unit="ккал" period={period} />
            </div>
          </section>

          <section className="card p-4 md:p-6">
            <h2 className="text-lg font-bold">Вес по дням</h2>
            <div className="mt-4">
              <WeightLineChart days={data.days} period={period} />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
