"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import {
  mondayOfWeek,
  shiftDateKey,
  weekdayShort,
} from "@/lib/dates";
import {
  HOLIDAY_BUFFER_FACTOR,
  applyHolidayBuffer,
  isHolidayBufferOn,
  setHolidayBuffer,
} from "@/lib/holiday-buffer";
import { withBasePath } from "@/lib/paths";
import { withDateQuery } from "@/lib/use-selected-date";

type DayRow = {
  date: string;
  calories: number;
};

type WeeklyPlanProps = {
  selectedDate: string;
  refreshKey?: number;
  onSelectDate?: (date: string) => void;
  compact?: boolean;
  /** Show compact holiday buffer switch in the header (today only). */
  showHolidayToggle?: boolean;
  onHolidayChange?: () => void;
};

export function WeeklyPlan({
  selectedDate,
  refreshKey = 0,
  onSelectDate,
  compact = false,
  showHolidayToggle = false,
  onHolidayChange,
}: WeeklyPlanProps) {
  const day = useOptionalRationDay();
  const [days, setDays] = useState<DayRow[]>([]);
  const [target, setTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [holidayOn, setHolidayOn] = useState(false);

  const weekStart = mondayOfWeek(selectedDate);
  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftDateKey(weekStart, i)),
    [weekStart],
  );
  const weekEnd = weekDates[6]!;

  const applyWeek = useCallback(
    (weekDays: DayRow[], calorieTarget: number | null | undefined) => {
      const byDate = new Map(weekDays.map((d) => [d.date, d.calories]));
      setDays(
        weekDates.map((date) => ({
          date,
          calories: byDate.get(date) ?? 0,
        })),
      );
      setTarget(
        typeof calorieTarget === "number" && calorieTarget > 0 ? calorieTarget : null,
      );
      setLoading(false);
    },
    [weekDates],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(
        withBasePath(`/api/stats?period=week&end=${encodeURIComponent(weekEnd)}`),
        { cache: "no-store" },
      );
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        days?: DayRow[];
        calorieTarget?: number | null;
      };
      applyWeek(data.days ?? [], data.calorieTarget);
    } catch {
      // non-critical
    } finally {
      setLoading(false);
    }
  }, [weekEnd, applyWeek, refreshKey]);

  useEffect(() => {
    const weekPayload = day?.data?.week;
    if (weekPayload?.days?.length) {
      const byDate = new Map(weekPayload.days.map((d) => [d.date, d.calories]));
      const overlaps = weekDates.some((date) => byDate.has(date));
      if (overlaps) {
        applyWeek(weekPayload.days, weekPayload.calorieTarget);
        return;
      }
    }

    if (day && day.date === selectedDate && day.loading) {
      setLoading(true);
      return;
    }

    void load();
  }, [applyWeek, day, load, selectedDate, weekDates, refreshKey]);

  useEffect(() => {
    setHolidayOn(isHolidayBufferOn(selectedDate));
  }, [selectedDate, refreshKey]);

  const effectiveTarget =
    target != null ? applyHolidayBuffer(target, holidayOn) : null;
  const holidayPct = Math.round((HOLIDAY_BUFFER_FACTOR - 1) * 100);

  return (
    <section className={compact ? "overflow-hidden" : "card overflow-hidden"}>
      <div className={`flex items-start justify-between gap-2 ${compact ? "pb-2" : "px-4 py-3 md:px-5"}`}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="font-semibold text-slate-800">План недели</p>
            <Link
              href={withDateQuery("/plan", selectedDate)}
              className="text-xs font-semibold text-teal-800 underline-offset-2 hover:underline"
            >
              Подробнее →
            </Link>
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            Цель vs факт по дням
            {effectiveTarget ? ` · норма ${effectiveTarget} ккал` : ""}
            {holidayOn ? " · праздничный запас" : ""}
          </p>
        </div>
        {showHolidayToggle ? (
          <label className="flex shrink-0 cursor-pointer items-center gap-2 pl-2">
            <span className="text-right leading-tight">
              <span className="block text-xs font-semibold text-slate-700">Праздничный запас</span>
              <span className="block text-[10px] text-slate-500">+{holidayPct}% к норме</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={holidayOn}
              aria-label={`Праздничный запас +${holidayPct}% к норме`}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                holidayOn ? "bg-teal-600" : "bg-slate-300"
              }`}
              onClick={() => {
                const next = !holidayOn;
                setHolidayBuffer(selectedDate, next);
                setHolidayOn(next);
                onHolidayChange?.();
              }}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                  holidayOn ? "translate-x-5" : ""
                }`}
              />
            </button>
          </label>
        ) : null}
      </div>

      {loading && days.length === 0 ? (
        <p className={`text-sm text-slate-500 ${compact ? "" : "px-4 pb-4 md:px-5"}`}>
          Загружаем неделю…
        </p>
      ) : (
        <div className={`grid grid-cols-7 gap-1.5 ${compact ? "pt-1" : "px-3 pb-4 md:px-4"}`}>
          {days.map((dayRow) => {
            const pct =
              effectiveTarget && effectiveTarget > 0
                ? Math.min(130, Math.round((dayRow.calories / effectiveTarget) * 100))
                : dayRow.calories > 0
                  ? 100
                  : 0;
            const selected = dayRow.date === selectedDate;
            const over = effectiveTarget != null && dayRow.calories > effectiveTarget * 1.05;
            const barH = Math.max(4, Math.round((Math.min(100, pct) / 100) * 40));

            return (
              <button
                key={dayRow.date}
                type="button"
                className={`flex flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 transition-colors ${
                  selected ? "bg-teal-50 ring-1 ring-teal-200" : "hover:bg-slate-50"
                }`}
                onClick={() => onSelectDate?.(dayRow.date)}
                aria-label={`${weekdayShort(dayRow.date)} ${dayRow.date}: ${dayRow.calories} ккал`}
              >
                <span className="text-[0.65rem] font-semibold uppercase text-slate-500">
                  {weekdayShort(dayRow.date)}
                </span>
                <div className="flex h-10 w-full items-end justify-center">
                  <div
                    className={`w-3 rounded-t-sm ${
                      over ? "bg-rose-400" : dayRow.calories > 0 ? "bg-teal-500" : "bg-slate-200"
                    }`}
                    style={{ height: `${barH}px` }}
                  />
                </div>
                <span
                  className={`text-[0.65rem] font-semibold tabular-nums ${
                    over ? "text-rose-600" : "text-slate-700"
                  }`}
                >
                  {dayRow.calories > 0 ? dayRow.calories : "—"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
