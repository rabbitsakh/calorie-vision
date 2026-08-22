"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatDateInput,
  formatMonthTitle,
  formatYearMonth,
  getMonthGrid,
  shiftYearMonth,
} from "@/lib/dates";
import { withBasePath } from "@/lib/paths";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type DayCalendarProps = {
  selectedDate: string;
  onSelect: (date: string) => void;
  refreshKey?: number;
  disabled?: boolean;
};

export function DayCalendar({ selectedDate, onSelect, refreshKey, disabled }: DayCalendarProps) {
  const selected = useMemo(() => new Date(`${selectedDate}T00:00:00`), [selectedDate]);
  const [year, setYear] = useState(selected.getFullYear());
  const [monthIndex, setMonthIndex] = useState(selected.getMonth());
  const [marked, setMarked] = useState<string[]>([]);

  useEffect(() => {
    setYear(selected.getFullYear());
    setMonthIndex(selected.getMonth());
  }, [selected]);

  useEffect(() => {
    if (disabled) {
      setMarked([]);
      return;
    }

    const month = formatYearMonth(year, monthIndex);
    let cancelled = false;

    fetch(withBasePath(`/api/calendar?month=${month}`))
      .then((response) => response.json())
      .then((data: { dates?: string[] }) => {
        if (!cancelled) {
          setMarked(data.dates ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMarked([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [year, monthIndex, refreshKey, disabled]);

  const grid = getMonthGrid(year, monthIndex);
  const markedSet = new Set(marked);
  const today = formatDateInput(new Date());

  function changeMonth(delta: number) {
    const next = shiftYearMonth(year, monthIndex, delta);
    setYear(next.year);
    setMonthIndex(next.monthIndex);
  }

  return (
    <div className="min-w-64">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          className="btn btn-secondary px-3 py-2 text-sm"
          disabled={disabled}
          onClick={() => changeMonth(-1)}
        >
          ←
        </button>
        <p className="text-sm font-semibold capitalize text-slate-700">
          {formatMonthTitle(year, monthIndex)}
        </p>
        <button
          type="button"
          className="btn btn-secondary px-3 py-2 text-sm"
          disabled={disabled}
          onClick={() => changeMonth(1)}
        >
          →
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-slate-400">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-10" />;
          }

          const isSelected = date === selectedDate;
          const hasData = markedSet.has(date);
          const isToday = date === today;

          return (
            <button
              key={date}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(date)}
              className={`relative flex h-10 flex-col items-center justify-center rounded-xl text-sm font-medium ${
                isSelected
                  ? "bg-[var(--accent)] text-white"
                  : isToday
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {Number(date.slice(-2))}
              {hasData ? (
                <span
                  className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-teal-600"}`}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
