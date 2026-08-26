"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateShort, getMonthGrid, parseDateInput, shiftDateKey } from "@/lib/dates";
import { decodeHtmlEntities } from "@/lib/html-text";
import { withBasePath } from "@/lib/paths";
import { pluralDays } from "@/lib/russian-text";
import { axisLabelIndices, sparseValueLabelIndices } from "@/lib/stats-chart-layout";
import { HEATMAP_TONE_CLASS, heatmapCellTone } from "@/lib/stats-heatmap";
import {
  buildWeekSummary,
  type CorridorStreakAlert,
  type WeekSummary,
} from "@/lib/stats-insights";
import { WeeklyReportCard } from "@/components/WeeklyReportCard";

type StatsDay = {
  date: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  sugar?: number;
  weightKg: number | null;
};

type StatsResponse = {
  period: "week" | "month" | "quarter";
  days: StatsDay[];
  calorieTarget: number | null;
  hourlyCalories: number[];
  moodInsight?: string | null;
  corridorAlert?: CorridorStreakAlert | null;
  weekOverWeek?: {
    thisWeek: { start: string; end: string; avgCalories: number; totalCalories: number; daysLogged: number };
    prevWeek: { start: string; end: string; avgCalories: number; totalCalories: number; daysLogged: number };
    deltaAvgCalories: number | null;
    deltaPct: number | null;
  };
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

/** Day number for dense axes; full short date only when there is room. */
function formatAxisDate(dateKey: string, compact: boolean): string {
  if (!compact) return formatDateShort(dateKey);
  const short = formatDateShort(dateKey);
  const day = short.match(/\d+/)?.[0];
  return day ?? short;
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
  period: "week" | "month" | "quarter";
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
  const showValueLabels = period === "week";
  const labelAreaHeight = showValueLabels ? 36 : 8;
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
  const xLabels = axisLabelIndices(days.length, period);
  const compactAxis = days.length > 5;
  // Value callouts only on week — denser periods clip into each other on mobile.
  const valueLabelIdx = showValueLabels
    ? sparseValueLabelIndices(
        days
          .map((d, index) => ({
            index,
            value: valueKey === "weightKg" ? (d.weightKg ?? 0) : d.calories,
          }))
          .filter((p) => p.value > 0),
        5,
      )
    : new Set<number>();

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
      <div className="min-w-0 flex-1 overflow-hidden border-l border-slate-200 pl-2 sm:pl-3">
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
          <div className="absolute inset-0 flex gap-px sm:gap-0.5">
            {days.map((day, index) => {
              const value = valueKey === "weightKg" ? day.weightKg : day[valueKey];
              const heightPx = barHeightPx(value);
              const barColor = valueKey === "calories"
                ? targetValue && value && value > targetValue
                  ? "bg-rose-500"
                  : targetValue && value && value >= targetValue * 0.9
                    ? "bg-teal-500"
                    : "bg-teal-600"
                : "bg-sky-600";
              const labelValue = value && value > 0 && valueLabelIdx.has(index);

              return (
                <div key={day.date} className="relative min-w-0 flex-1 overflow-hidden">
                  {value && value > 0 ? (
                    <>
                      <div
                        className={`absolute bottom-0 left-1/2 w-[70%] max-w-8 -translate-x-1/2 rounded-t-md ${barColor}`}
                        style={{ height: `${heightPx}px` }}
                        title={`${formatDateShort(day.date)}: ${formatChartValue(value, valueKey)} ${unit}`}
                      />
                      {labelValue ? (
                        <div
                          className="pointer-events-none absolute inset-x-0 flex justify-center overflow-hidden"
                          style={{ bottom: `${heightPx + labelGap}px` }}
                        >
                          <span
                            className={`font-semibold leading-none text-slate-600 ${valueLabelClass}`}
                            style={{ writingMode: "vertical-lr", transform: "rotate(180deg)" }}
                          >
                            {formatChartValue(value, valueKey)}
                          </span>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="absolute bottom-0 left-1/2 h-0.5 w-[70%] max-w-8 -translate-x-1/2 rounded bg-slate-100" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* X-axis date labels — fixed h-4 slot so labeled columns share one baseline */}
        <div className="mt-1 flex gap-px overflow-hidden sm:gap-0.5" aria-hidden="true">
          {days.map((day, index) => {
            const show = xLabels.has(index);
            return (
              <div
                key={`${day.date}-lbl`}
                className="flex h-4 min-w-0 flex-1 shrink-0 items-center justify-center overflow-hidden"
              >
                {show ? (
                  <span className="block w-full truncate text-center text-[10px] font-medium leading-none text-slate-500 sm:text-xs">
                    {formatAxisDate(day.date, compactAxis && index !== 0 && index !== days.length - 1)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── WeightLineChart ───────────────────────────────────────────────────────────

function WeightLineChart({ days, period }: { days: StatsDay[]; period: "week" | "month" | "quarter" }) {
  const points = days
    .map((d, i) => ({ index: i, date: d.date, value: d.weightKg }))
    .filter((p): p is { index: number; date: string; value: number } => p.value !== null && p.value > 0);

  const minDaysForTrend = 3;
  if (points.length < minDaysForTrend) {
    const need = minDaysForTrend - points.length;
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        {points.length === 0
          ? `Пока нет измерений — добавьте ${minDaysForTrend} ${pluralDays(minDaysForTrend)}, чтобы увидеть тренд.`
          : `Мало данных для графика — добавьте ещё ${need} ${pluralDays(need)}.`}
      </p>
    );
  }

  const plotHeight = 120;
  const plotWidth = 100;
  const weights = points.map((p) => p.value);
  const { min, max } = chartRange(weights);
  const span = Math.max(max - min, 0.1);
  const ticks = yAxisTicks(min, max);
  const totalDays = days.length;
  // Keep first/last points inset so value labels are not clipped by the card edge.
  const xPadPct = 6;

  function xPct(i: number) {
    if (totalDays <= 1) return 50;
    const t = i / (totalDays - 1);
    return xPadPct + t * (100 - xPadPct * 2);
  }
  function yPct(v: number) {
    return ((max - v) / span) * 100;
  }
  function labelAnchor(x: number): "start" | "center" | "end" {
    if (x <= 14) return "start";
    if (x >= 86) return "end";
    return "center";
  }

  const svgPoints = points.map((p) => `${xPct(p.index)},${yPct(p.value)}`).join(" ");

  function rollingAvg(window = 7) {
    return points.map((p) => {
      const slice = points.filter((q) => q.index >= p.index - window + 1 && q.index <= p.index);
      const avg = slice.reduce((s, q) => s + q.value, 0) / slice.length;
      return { index: p.index, avg: Math.round(avg * 10) / 10 };
    });
  }
  const avgPoints = points.length >= 3 ? rollingAvg() : null;
  const xLabels = axisLabelIndices(days.length, period);
  const compactAxis = days.length > 5;
  const maxValueLabels = period === "week" ? 4 : period === "month" ? 3 : 2;
  const valueLabelIdx = sparseValueLabelIndices(points, maxValueLabels);

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
        <div className="min-w-0 flex-1 overflow-hidden border-l border-slate-200 pl-2 sm:pl-3">
          <div className="relative overflow-visible" style={{ height: plotHeight }}>
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

            {/* Dots + edge-aware value labels */}
            {points.map((p) => {
              const showLabel = valueLabelIdx.has(p.index);
              const x = xPct(p.index);
              const y = yPct(p.value);
              const anchor = labelAnchor(x);
              const labelBelow = y < 18;
              return (
                <div
                  key={p.date}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full border-2 border-sky-600 bg-white"
                    title={`${formatDateShort(p.date)}: ${p.value} кг`}
                  />
                  {showLabel ? (
                    <span
                      className="absolute z-10 whitespace-nowrap rounded bg-white/95 px-0.5 text-center text-[10px] font-semibold leading-none text-slate-700 shadow-sm sm:text-xs"
                      style={{
                        ...(labelBelow
                          ? { top: "14px" }
                          : { bottom: "14px" }),
                        ...(anchor === "start"
                          ? { left: 0 }
                          : anchor === "end"
                            ? { right: 0 }
                            : { left: "50%", transform: "translateX(-50%)" }),
                      }}
                    >
                      {formatChartValue(p.value, "weightKg")}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* X-axis — fixed h-4 slot (same baseline as TimingChart / MacroChart) */}
          <div className="mt-1 flex overflow-hidden" aria-hidden="true">
            {days.map((day, index) => {
              const show = xLabels.has(index);
              return (
                <div
                  key={day.date}
                  className="flex h-4 min-w-0 flex-1 shrink-0 items-center justify-center overflow-hidden"
                >
                  {show ? (
                    <span className="block w-full truncate text-center text-[10px] font-medium leading-none text-slate-500 sm:text-xs">
                      {formatAxisDate(day.date, compactAxis && index !== 0 && index !== days.length - 1)}
                    </span>
                  ) : null}
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

function MacroChart({ days, period }: { days: StatsDay[]; period: "week" | "month" | "quarter" }) {
  const hasData = days.some((d) => d.protein > 0 || d.fat > 0 || d.carbs > 0);
  if (!hasData) return <p className="py-4 text-center text-sm text-slate-400">Нет данных о БЖУ за период</p>;

  const maxTotal = Math.max(...days.map((d) => d.protein + d.fat + d.carbs), 1);
  const xLabels = axisLabelIndices(days.length, period);
  const compactAxis = days.length > 5;

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
      <div className="flex gap-px overflow-hidden sm:gap-0.5">
        {days.map((day, index) => {
          const total = day.protein + day.fat + day.carbs;
          const show = xLabels.has(index);
          const barH = total > 0 ? Math.max(4, Math.round((total / maxTotal) * 100)) : 0;
          return (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center overflow-hidden">
              <div className="flex w-full flex-col justify-end overflow-hidden rounded-t-sm" style={{ height: "80px" }}>
                {total > 0 ? (
                  <div className="w-full overflow-hidden" style={{ height: `${barH}%` }} title={`Б ${day.protein}г · Ж ${day.fat}г · У ${day.carbs}г · клетчатка ${day.fiber ?? 0} г · сахар ${day.sugar ?? 0} г`}>
                    <div style={{ height: `${(day.protein / total) * 100}%` }} className="bg-teal-500" />
                    <div style={{ height: `${(day.fat / total) * 100}%` }} className="bg-amber-400" />
                    <div style={{ height: `${(day.carbs / total) * 100}%` }} className="bg-violet-400" />
                  </div>
                ) : (
                  <div className="h-0.5 w-full rounded bg-slate-100" />
                )}
              </div>
              <div className="flex h-4 w-full shrink-0 items-center justify-center">
                {show ? (
                  <span className="block w-full truncate text-center text-[10px] font-medium leading-none text-slate-500 sm:text-xs">
                    {formatAxisDate(day.date, compactAxis && index !== 0 && index !== days.length - 1)}
                  </span>
                ) : null}
              </div>
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
  const LABELS = ["00", "04", "08", "12", "16", "20"];
  return (
    <div className="flex gap-px overflow-hidden sm:gap-0.5">
      {hourlyCalories.map((val, hour) => {
        const h = Math.max(0, Math.round((val / maxVal) * 100));
        const show = hour % 4 === 0;
        return (
          <div key={hour} className="flex min-w-0 flex-1 flex-col items-center overflow-hidden">
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
            {/* Fixed label slot so labeled columns don't lift bars (was items-end + uneven label height). */}
            <div className="flex h-4 w-full shrink-0 items-center justify-center">
              {show ? (
                <span className="truncate text-[10px] font-medium leading-none text-slate-400 sm:text-xs">
                  {LABELS[Math.floor(hour / 4)]}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MonthHeatmap ──────────────────────────────────────────────────────────────

function MonthHeatmap({
  days,
  calorieTarget,
  endDate,
}: {
  days: StatsDay[];
  calorieTarget: number | null;
  endDate: string;
}) {
  const end = parseDateInput(endDate);
  const year = end.getFullYear();
  const monthIndex = end.getMonth();
  const grid = getMonthGrid(year, monthIndex);
  const byDate = new Map(days.map((d) => [d.date, d.calories]));
  const weekdays = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

  return (
    <section className="card p-4 md:p-6">
      <h2 className="font-display text-lg font-bold">Календарь калорий</h2>
      <p className="mt-1 text-xs text-slate-500">
        Дни относительно цели{calorieTarget ? ` (${calorieTarget} ккал)` : ""}
      </p>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400 sm:text-xs">
        {weekdays.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {grid.map((dateKey, index) => {
          if (!dateKey) {
            return <div key={`empty-${index}`} className="aspect-square rounded-md" />;
          }
          const kcal = byDate.get(dateKey) ?? 0;
          const tone = heatmapCellTone(kcal, calorieTarget);
          const dayNum = Number(dateKey.slice(8, 10));
          return (
            <div
              key={dateKey}
              className={`flex aspect-square items-center justify-center rounded-md text-xs font-semibold ${HEATMAP_TONE_CLASS[tone]}`}
              title={
                kcal > 0
                  ? `${formatDateShort(dateKey)}: ${kcal} ккал`
                  : `${formatDateShort(dateKey)}: нет записей`
              }
            >
              {dayNum}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded ${HEATMAP_TONE_CLASS.empty.split(" ")[0]}`} />
          нет данных
        </span>
        {calorieTarget ? (
          <>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded ${HEATMAP_TONE_CLASS.under.split(" ")[0]}`} />
              ниже цели
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded ${HEATMAP_TONE_CLASS.good.split(" ")[0]}`} />
              около цели
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`inline-block h-3 w-3 rounded ${HEATMAP_TONE_CLASS.over.split(" ")[0]}`} />
              выше цели
            </span>
          </>
        ) : (
          <span className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded ${HEATMAP_TONE_CLASS.logged.split(" ")[0]}`} />
            есть записи
          </span>
        )}
      </div>
    </section>
  );
}

// ── WeekSummaryCard ───────────────────────────────────────────────────────────

function WeekSummaryCard({ summary }: { summary: WeekSummary }) {
  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
        Итоги недели
      </p>
      <p className="mt-1 font-semibold text-teal-950">{summary.headline}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-white/80 px-3 py-2">
          <p className="text-xs text-slate-500">Дней с едой</p>
          <p className="text-lg font-bold text-slate-900">{summary.daysLogged}/7</p>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2">
          <p className="text-xs text-slate-500">Среднее ккал</p>
          <p className="text-lg font-bold text-slate-900">{summary.avgCalories}</p>
          {summary.calorieTarget ? (
            <p className="text-[10px] text-slate-500">цель {summary.calorieTarget}</p>
          ) : null}
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2">
          <p className="text-xs text-slate-500">В коридоре</p>
          <p className="text-lg font-bold text-slate-900">
            {summary.daysInCorridor != null ? summary.daysInCorridor : "—"}
          </p>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2">
          <p className="text-xs text-slate-500">Вес за неделю</p>
          <p className="text-lg font-bold text-slate-900">
            {summary.weightChangeKg != null
              ? `${summary.weightChangeKg > 0 ? "+" : ""}${summary.weightChangeKg} кг`
              : "—"}
          </p>
        </div>
      </div>
      {summary.bestDay ? (
        <p className="mt-2 text-xs text-teal-800">
          Ближе всего к цели: {formatDateShort(summary.bestDay.date)} · {summary.bestDay.calories} ккал
        </p>
      ) : null}
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
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("week");
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportPeriod, setExportPeriod] = useState<"week" | "month" | "quarter" | "custom">("week");
  const [exportFrom, setExportFrom] = useState("");
  const [exportTo, setExportTo] = useState(endDate);

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

  useEffect(() => {
    setExportTo(endDate);
  }, [endDate]);

  const exportRange = useMemo(() => {
    if (exportPeriod === "custom") {
      return { from: exportFrom, to: exportTo || endDate };
    }
    const days = exportPeriod === "quarter" ? 90 : exportPeriod === "month" ? 30 : 7;
    const to = endDate;
    const from = shiftDateKey(to, -(days - 1));
    return { from, to };
  }, [exportPeriod, exportFrom, exportTo, endDate]);

  const exportUrl = (format: "csv" | "pdf") => {
    const { from, to } = exportRange;
    if (!from || !to) return withBasePath(`/api/export?format=${format}`);
    return withBasePath(`/api/export?format=${format}&from=${from}&to=${to}`);
  };

  const wow = data?.weekOverWeek;

  const weekSummary =
    data && period === "week" ? buildWeekSummary(data.days, data.calorieTarget) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Sticky under the notch via `top`, not padding — avoids a blank band while at rest */}
      <div className="sticky top-[env(safe-area-inset-top,0px)] z-20 -mx-2.5 bg-[var(--background)] px-2.5 py-0 md:static md:mx-0 md:bg-transparent md:p-0">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 sm:max-w-md">
          {([
            ["week", "7 дней"],
            ["month", "30 дней"],
            ["quarter", "90 дней"],
          ] as const).map(([p, label]) => (
            <button
              key={p}
              type="button"
              className={`chip min-h-9 w-full justify-center ${period === p ? "chip-active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {label}
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

      {data && data.summary.totalMealDays === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <p className="text-sm text-slate-600">За этот период пока нет записей.</p>
          <a href={withBasePath("/ration")} className="btn btn-primary text-sm">Добавить еду</a>
        </div>
      ) : null}

      {data ? (
        <>
          {weekSummary ? <WeekSummaryCard summary={weekSummary} /> : null}

          {period === "week" ? <WeeklyReportCard endDate={endDate} /> : null}

          {data.corridorAlert ? (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm ${
                data.corridorAlert.direction === "above"
                  ? "border-amber-200 bg-amber-50 text-amber-950"
                  : "border-sky-200 bg-sky-50 text-sky-950"
              }`}
              role="status"
            >
              <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                {data.corridorAlert.direction === "above"
                  ? "Выше цели 3+ дня"
                  : "Ниже цели 3+ дня"}
              </p>
              <p className="mt-1">{data.corridorAlert.message}</p>
            </div>
          ) : null}

          {wow && (wow.thisWeek.daysLogged > 0 || wow.prevWeek.daysLogged > 0) ? (
            <section className="card p-4 md:p-6">
              <h2 className="font-display text-lg font-bold">Эта неделя vs прошлая</h2>
              <p className="mt-1 text-xs text-slate-500">Средние ккал в дни с записями</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-teal-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Эта неделя</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900">
                    {wow.thisWeek.daysLogged > 0 ? wow.thisWeek.avgCalories : "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {wow.thisWeek.daysLogged > 0
                      ? `${wow.thisWeek.daysLogged} ${pluralDays(wow.thisWeek.daysLogged)} · ${formatDateShort(wow.thisWeek.start)}–${formatDateShort(wow.thisWeek.end)}`
                      : "нет записей"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Прошлая</p>
                  <p className="mt-1 font-display text-2xl font-bold text-slate-900">
                    {wow.prevWeek.daysLogged > 0 ? wow.prevWeek.avgCalories : "—"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {wow.prevWeek.daysLogged > 0
                      ? `${wow.prevWeek.daysLogged} ${pluralDays(wow.prevWeek.daysLogged)} · ${formatDateShort(wow.prevWeek.start)}–${formatDateShort(wow.prevWeek.end)}`
                      : "нет записей"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-100 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Разница</p>
                  <p
                    className={`mt-1 font-display text-2xl font-bold ${
                      wow.deltaAvgCalories == null
                        ? "text-slate-400"
                        : wow.deltaAvgCalories > 0
                          ? "text-amber-700"
                          : wow.deltaAvgCalories < 0
                            ? "text-teal-700"
                            : "text-slate-800"
                    }`}
                  >
                    {wow.deltaAvgCalories == null
                      ? "—"
                      : `${wow.deltaAvgCalories > 0 ? "+" : ""}${wow.deltaAvgCalories}`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {wow.deltaPct == null
                      ? "нужны обе недели"
                      : `${wow.deltaPct > 0 ? "+" : ""}${wow.deltaPct}% к прошлой`}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {data.moodInsight ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
              <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
                Настроение и еда
              </p>
              <p className="mt-1">{data.moodInsight}</p>
            </div>
          ) : null}

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
              <h2 className="font-display text-lg font-bold">Калории по дням</h2>
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

          {period === "month" ? (
            <MonthHeatmap
              days={data.days}
              calorieTarget={data.calorieTarget}
              endDate={endDate}
            />
          ) : null}

          {/* Macros */}
          <section className="card p-4 md:p-6">
            <h2 className="font-display text-lg font-bold">БЖУ, клетчатка и сахар</h2>
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
            <h2 className="mb-1 font-display text-lg font-bold">Экспорт · Calorie Vision</h2>
            <p className="mb-3 text-xs text-slate-500">PDF с брендингом и дневником за выбранный период</p>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {(
                [
                  ["week", "7 дней"],
                  ["month", "30 дней"],
                  ["quarter", "90 дней"],
                  ["custom", "Свои даты"],
                ] as const
              ).map(([p, label]) => (
                <button
                  key={p}
                  type="button"
                  className={`chip min-h-9 ${exportPeriod === p ? "chip-active" : ""}`}
                  onClick={() => {
                    setExportPeriod(p);
                    if (p !== "custom") {
                      const days = p === "quarter" ? 90 : p === "month" ? 30 : 7;
                      setExportFrom(shiftDateKey(endDate, -(days - 1)));
                      setExportTo(endDate);
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            {exportPeriod === "custom" ? (
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                <div className="field">
                  <label htmlFor="export-from">С</label>
                  <input
                    id="export-from"
                    type="date"
                    value={exportFrom}
                    onChange={(e) => setExportFrom(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label htmlFor="export-to">По</label>
                  <input
                    id="export-to"
                    type="date"
                    value={exportTo}
                    onChange={(e) => setExportTo(e.target.value)}
                  />
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <a
                href={exportUrl("csv")}
                download
                className="btn btn-secondary text-sm"
              >
                Скачать CSV
              </a>
              <a
                href={exportUrl("pdf")}
                download
                className="btn btn-secondary text-sm"
              >
                Скачать PDF
              </a>
            </div>
            {exportRange.from && exportRange.to ? (
              <p className="mt-2 text-xs text-slate-400">
                Период: {exportRange.from} — {exportRange.to}
              </p>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
