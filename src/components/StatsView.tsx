"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateShort } from "@/lib/dates";
import { decodeHtmlEntities } from "@/lib/html-text";
import { withBasePath } from "@/lib/paths";
import { WeeklyReportCard } from "@/components/WeeklyReportCard";

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
  calorieTarget: number | null;
  hourlyCalories: number[];
  topFoods: Array<{ dishName: string; count: number; avgCalories: number }>;
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

// ── helpers ──────────────────────────────────────────────────────────────────

function chartRange(values: number[], paddingRatio = 0.1): { min: number; max: number } {
  const filtered = values.filter((v) => v > 0);
  if (filtered.length === 0) return { min: 0, max: 1 };
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
  if (period === "week") return true;
  if (index === 0 || index === total - 1) return true;
  return index % 7 === 0;
}

function formatChartValue(value: number, key: "calories" | "weightKg"): string {
  if (key === "weightKg") return Number.isInteger(value) ? String(value) : value.toFixed(1);
  return String(Math.round(value));
}

function yAxisTicks(min: number, max: number, count = 4): number[] {
  if (count < 2) return [max, min];
  const span = max - min;
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) ticks.push(min + (span * i) / (count - 1));
  return ticks.reverse();
}

// ── BarChart ──────────────────────────────────────────────────────────────────

function BarChart({
  days,
  valueKey,
  unit,
  period,
  targetValue,
}: {
  days: StatsDay[];
  valueKey: "calories" | "weightKg";
  unit: string;
  period: "week" | "month";
  targetValue?: number | null;
}) {
  const values = days.map((d) => (valueKey === "weightKg" ? (d.weightKg ?? 0) : d.calories));
  const presentValues = values.filter((v) => v > 0);
  // Include target in range so the dashed line is always visible
  const rangeValues = targetValue ? [...presentValues, targetValue] : presentValues;
  const { min, max } = chartRange(rangeValues);
  const span = Math.max(max - min, 1);
  const ticks = yAxisTicks(min, max);
  const plotHeight = 144;
  const labelAreaHeight = period === "month" ? 32 : 28; // reserved above bars for vertical labels
  const labelGap = 4;
  const totalHeight = plotHeight + labelAreaHeight;

  const valueLabelClass = "text-xs";

  function barHeightPx(v: number | null | undefined): number {
    if (!v || v <= 0) return 0;
    return Math.max(Math.round(((v - min) / span) * plotHeight), 6);
  }

  // Y position (px from top) for a given value within the bar zone
  function yPxFromTop(v: number): number {
    return labelAreaHeight + plotHeight - barHeightPx(v);
  }

  const targetYPx = targetValue && targetValue > 0 ? yPxFromTop(targetValue) : null;

  return (
    <div className="flex gap-2 sm:gap-3">
      {/* Y-axis labels */}
      <div
        className="relative shrink-0 text-right text-xs font-medium text-slate-400"
        style={{ height: totalHeight, width: "2.75rem" }}
        aria-hidden="true"
      >
        {ticks.map((tick, i) => (
          <span
            key={`${tick}-${i}`}
            className="absolute right-0 -translate-y-1/2 leading-none"
            style={{ top: `${labelAreaHeight + (i / (ticks.length - 1)) * plotHeight}px` }}
          >
            {formatChartValue(tick, valueKey)}
          </span>
        ))}
      </div>

      {/* Plot area */}
      <div className="min-w-0 flex-1 border-l border-slate-200 pl-2 sm:pl-3">
        <div className="relative" style={{ height: totalHeight }}>
          {/* Dashed grid lines in bar zone */}
          {ticks.map((tick, i) => (
            <div
              key={`grid-${i}`}
              className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-slate-100"
              style={{ top: `${labelAreaHeight + (i / (ticks.length - 1)) * plotHeight}px` }}
            />
          ))}

          {/* Target line — amber, full width, inside bar zone */}
          {targetYPx !== null ? (
            <div
              className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-dashed border-amber-400"
              style={{ top: `${targetYPx}px` }}
            />
          ) : null}

          {/* Bars + labels */}
          <div className="absolute inset-0 flex gap-0.5 sm:gap-1">
            {days.map((day) => {
              const value = valueKey === "weightKg" ? day.weightKg : day[valueKey];
              const heightPx = barHeightPx(value);
              const barColor = valueKey === "calories"
                ? targetValue && value && value > targetValue
                  ? "bg-rose-500"
                  : targetValue && value && value >= targetValue * 0.9
                    ? "bg-teal-500"
                    : "bg-teal-600"
                : "bg-sky-600";

              return (
                <div key={day.date} className="relative min-w-0 flex-1">
                  {value && value > 0 ? (
                    <>
                      <div
                        className={`absolute bottom-0 left-1/2 w-[55%] max-w-6 min-w-2 -translate-x-1/2 rounded-t-md ${barColor}`}
                        style={{ height: `${heightPx}px` }}
                        title={`${formatDateShort(day.date)}: ${formatChartValue(value, valueKey)} ${unit}`}
                      />
                      {/* Vertical label above bar */}
                      <div
                        className="absolute inset-x-0 flex justify-center"
                        style={{ bottom: `${heightPx + labelGap}px` }}
                      >
                        <span
                          className={`whitespace-nowrap font-semibold leading-none text-slate-600 ${valueLabelClass}`}
                          style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
                        >
                          {formatChartValue(value, valueKey)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="absolute bottom-0 left-1/2 h-0.5 w-[55%] max-w-6 min-w-2 -translate-x-1/2 rounded bg-slate-100" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis date labels */}
        <div className="mt-1 flex gap-0.5 sm:gap-1">
          {days.map((day, index) => {
            const show = shouldShowDateLabel(index, days.length, period);
            return (
              <div key={`${day.date}-lbl`} className="min-w-0 flex-1 text-center">
                <span className={`block truncate text-xs font-medium text-slate-500 ${show ? "" : "invisible"}`}>
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

// ── WeightLineChart ───────────────────────────────────────────────────────────

function WeightLineChart({ days, period }: { days: StatsDay[]; period: "week" | "month" }) {
  const points = days
    .map((d, i) => ({ index: i, date: d.date, value: d.weightKg }))
    .filter((p): p is { index: number; date: string; value: number } => p.value !== null && p.value > 0);

  if (points.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-400">Нет измерений веса за период</p>;
  }

  const plotHeight = 120;
  const plotWidth = 100;
  const weights = points.map((p) => p.value);
  const { min, max } = chartRange(weights);
  const span = Math.max(max - min, 0.1);
  const ticks = yAxisTicks(min, max);
  const totalDays = days.length;

  function xPct(i: number) { return totalDays <= 1 ? 50 : (i / (totalDays - 1)) * plotWidth; }
  function yPct(v: number) { return ((max - v) / span) * 100; }

  const svgPoints = points.map((p) => `${xPct(p.index)},${yPct(p.value)}`).join(" ");

  function rollingAvg(window = 7) {
    return points.map((p) => {
      const slice = points.filter((q) => q.index >= p.index - window + 1 && q.index <= p.index);
      const avg = slice.reduce((s, q) => s + q.value, 0) / slice.length;
      return { index: p.index, avg: Math.round(avg * 10) / 10 };
    });
  }
  const avgPoints = points.length >= 3 ? rollingAvg() : null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 sm:gap-3">
        {/* Y-axis */}
        <div
          className="relative shrink-0 text-right text-xs font-medium text-slate-400"
          style={{ height: plotHeight, width: "2.75rem" }}
          aria-hidden="true"
        >
          {ticks.map((tick, i) => (
            <span
              key={`${tick}-${i}`}
              className="absolute right-0 -translate-y-1/2 leading-none"
              style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            >
              {formatChartValue(tick, "weightKg")}
            </span>
          ))}
        </div>

        {/* Plot */}
        <div className="min-w-0 flex-1 border-l border-slate-200 pl-2 sm:pl-3">
          <div className="relative" style={{ height: plotHeight }}>
            {ticks.map((tick, i) => (
              <div
                key={`grid-${i}`}
                className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-slate-100"
                style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
              />
            ))}

            <svg
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox={`0 0 ${plotWidth} 100`}
              preserveAspectRatio="none"
            >
              {/* Raw measurements */}
              <polyline
                points={svgPoints}
                fill="none"
                stroke="#bae6fd"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Rolling average */}
              {avgPoints ? (
                <polyline
                  points={avgPoints.map((p) => `${xPct(p.index)},${yPct(p.avg)}`).join(" ")}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="2.5"
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null}
            </svg>

            {/* Dots + value labels */}
            {points.map((p) => (
              <div
                key={p.date}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${xPct(p.index)}%`, top: `${yPct(p.value)}%` }}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full border-2 border-sky-600 bg-white"
                  title={`${formatDateShort(p.date)}: ${p.value} кг`}
                />
                <span
                  className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-xs font-semibold leading-none text-slate-700"
                  style={{ bottom: "14px" }}
                >
                  {formatChartValue(p.value, "weightKg")}
                </span>
              </div>
            ))}
          </div>

          {/* X-axis */}
          <div className="mt-1 flex">
            {days.map((day, index) => {
              const show = shouldShowDateLabel(index, days.length, period);
              return (
                <div key={day.date} className="min-w-0 flex-1 text-center">
                  <span className={`block truncate text-xs font-medium text-slate-500 ${show ? "" : "invisible"}`}>
                    {formatDateShort(day.date)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend — below chart, full width */}
      {avgPoints ? (
        <div className="flex items-center gap-4 pl-[3.25rem] text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-6 rounded bg-sky-200" />
            Измерения
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-[2.5px] w-6 rounded bg-sky-600" />
            7‑дневное среднее
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ── MacroChart ────────────────────────────────────────────────────────────────

function MacroChart({ days, period }: { days: StatsDay[]; period: "week" | "month" }) {
  const hasData = days.some((d) => d.protein > 0 || d.fat > 0 || d.carbs > 0);
  if (!hasData) return <p className="py-4 text-center text-sm text-slate-400">Нет данных о БЖУ за период</p>;

  const maxTotal = Math.max(...days.map((d) => d.protein + d.fat + d.carbs), 1);
  const labelClass = "text-xs";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-3 text-xs text-slate-600">
        {[{ label: "Белки", color: "bg-teal-500" }, { label: "Жиры", color: "bg-amber-400" }, { label: "Углеводы", color: "bg-violet-400" }].map((m) => (
          <span key={m.label} className="flex items-center gap-1">
            <span className={`h-2.5 w-2.5 rounded-sm ${m.color}`} />
            {m.label}
          </span>
        ))}
      </div>
      <div className="flex gap-0.5 sm:gap-1">
        {days.map((day, index) => {
          const total = day.protein + day.fat + day.carbs;
          const show = shouldShowDateLabel(index, days.length, period);
          const barH = total > 0 ? Math.max(4, Math.round((total / maxTotal) * 100)) : 0;
          return (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
              <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-sm" style={{ height: "80px" }}>
                {total > 0 ? (
                  <div className="w-full overflow-hidden" style={{ height: `${barH}%` }} title={`Б ${day.protein}г · Ж ${day.fat}г · У ${day.carbs}г`}>
                    <div style={{ height: `${(day.protein / total) * 100}%` }} className="bg-teal-500" />
                    <div style={{ height: `${(day.fat / total) * 100}%` }} className="bg-amber-400" />
                    <div style={{ height: `${(day.carbs / total) * 100}%` }} className="bg-violet-400" />
                  </div>
                ) : (
                  <div className="h-0.5 w-full rounded bg-slate-100" />
                )}
              </div>
              <span className={`block truncate text-center font-medium text-slate-500 ${labelClass} ${show ? "" : "invisible"}`}>
                {formatDateShort(day.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TimingChart ───────────────────────────────────────────────────────────────

function TimingChart({ hourlyCalories }: { hourlyCalories: number[] }) {
  const maxVal = Math.max(...hourlyCalories, 1);
  const LABELS = ["00", "02", "04", "06", "08", "10", "12", "14", "16", "18", "20", "22"];
  return (
    <div className="flex items-end gap-0.5">
      {hourlyCalories.map((val, hour) => {
        const h = Math.max(0, Math.round((val / maxVal) * 100));
        const show = hour % 2 === 0;
        return (
          <div key={hour} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
            <div className="flex w-full flex-col justify-end" style={{ height: "64px" }}>
              {val > 0 ? (
                <div
                  className="w-full rounded-t-sm bg-teal-500 opacity-80"
                  style={{ height: `${h}%` }}
                  title={`${String(hour).padStart(2, "0")}:00 — ${val} ккал`}
                />
              ) : (
                <div className="h-px w-full bg-slate-100" />
              )}
            </div>
            <span className={`text-xs font-medium text-slate-400 ${show ? "" : "invisible"}`}>
              {LABELS[Math.floor(hour / 2)]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl px-4 py-3 ${accent ? "bg-teal-50" : "bg-slate-50"}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-teal-700" : ""}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

// ── StatsView ─────────────────────────────────────────────────────────────────

export function StatsView({ endDate }: StatsViewProps) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(withBasePath(`/api/stats?period=${period}&end=${endDate}`));
      const payload = (await resp.json()) as StatsResponse;
      if (!resp.ok) throw new Error(payload.error ?? "Не удалось загрузить статистику");
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [endDate, period]);

  useEffect(() => { void loadStats(); }, [loadStats]);

  // Export helpers — use the period end date and compute start from period
  const periodStart = data?.days[0]?.date ?? "";
  const periodEnd = data?.days[data.days.length - 1]?.date ?? "";
  const exportUrl = (format: "csv" | "pdf") =>
    withBasePath(`/api/export?format=${format}&from=${periodStart}&to=${periodEnd}`);

  return (
    <div className="flex flex-col gap-6">
      {/* Period toggle — sticky so it stays visible when scrolling */}
      <div className="sticky top-0 z-20 -mx-4 bg-[var(--background)] px-4 pb-2 pt-1 md:static md:mx-0 md:bg-transparent md:p-0">
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 sm:max-w-xs">
          {(["week", "month"] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${period === p ? "bg-white text-teal-800 shadow" : "text-slate-600"}`}
              onClick={() => setPeriod(p)}
            >
              {p === "week" ? "Неделя" : "Месяц"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className="daisy-loading"><span /><span /><span /></span> Загрузка...
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {data ? (
        <>
          {period === "week" ? <WeeklyReportCard endDate={endDate} /> : null}
          {/* Summary tiles */}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard
              label="Среднее ккал/день"
              value={String(data.summary.avgCalories)}
              sub={data.calorieTarget ? `цель ${data.calorieTarget} ккал` : undefined}
              accent={!!data.calorieTarget && data.summary.avgCalories >= data.calorieTarget * 0.9 && data.summary.avgCalories <= data.calorieTarget * 1.05}
            />
            <StatCard label="Дней с едой" value={`${data.summary.totalMealDays} / ${data.days.length}`} />
            <StatCard
              label="Изменение веса"
              value={data.summary.weightChangeKg != null
                ? `${data.summary.weightChangeKg > 0 ? "+" : ""}${data.summary.weightChangeKg} кг`
                : "—"}
              sub={data.summary.firstWeightKg && data.summary.lastWeightKg
                ? `${data.summary.firstWeightKg} → ${data.summary.lastWeightKg} кг`
                : undefined}
            />
          </div>

          {/* Calories */}
          <section className="card p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold">Калории по дням</h2>
              {data.calorieTarget ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-600">
                  <span className="inline-block h-0 w-6 border-t-2 border-dashed border-amber-400" />
                  цель {data.calorieTarget} ккал
                </div>
              ) : null}
            </div>
            <div className="mt-4">
              <BarChart days={data.days} valueKey="calories" unit="ккал" period={period} targetValue={data.calorieTarget} />
            </div>
          </section>

          {/* Macros */}
          <section className="card p-4 md:p-6">
            <h2 className="text-lg font-bold">БЖУ по дням</h2>
            <div className="mt-4">
              <MacroChart days={data.days} period={period} />
            </div>
          </section>

          {/* Weight */}
          <section className="card p-4 md:p-6">
            <h2 className="text-lg font-bold">Вес по дням</h2>
            <div className="mt-4">
              <WeightLineChart days={data.days} period={period} />
            </div>
          </section>

          {/* Top foods */}
          {data.topFoods.length > 0 ? (
            <section className="card p-4 md:p-6">
              <h2 className="text-lg font-bold">Что вы часто едите</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {data.topFoods.map((food) => (
                  <li key={food.dishName} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{decodeHtmlEntities(food.dishName)}</p>
                      <p className="text-xs text-slate-500">~{food.avgCalories} ккал</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">
                      {food.count}×
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Timing */}
          {data.hourlyCalories.some((v) => v > 0) ? (
            <section className="card p-4 md:p-6">
              <h2 className="text-lg font-bold">Когда вы едите</h2>
              <p className="mt-1 text-xs text-slate-500">Калории по часам суток за период</p>
              <div className="mt-4">
                <TimingChart hourlyCalories={data.hourlyCalories} />
              </div>
            </section>
          ) : null}

          {/* Export */}
          <section className="card p-4 md:p-6">
            <h2 className="mb-3 text-base font-semibold">Экспорт данных</h2>
            <div className="flex flex-wrap gap-3">
              <a
                href={exportUrl("csv")}
                download
                className="btn btn-secondary text-sm"
              >
                📥 Скачать CSV
              </a>
              <a
                href={exportUrl("pdf")}
                download
                className="btn btn-secondary text-sm"
              >
                📄 Скачать PDF
              </a>
            </div>
            {periodStart && periodEnd ? (
              <p className="mt-2 text-xs text-slate-400">Период: {periodStart} — {periodEnd}</p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
