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
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
          disabled={disabled}
          aria-label="Предыдущий месяц"
          onClick={() => changeMonth(-1)}
        >
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-slate-800">{formatMonthTitle(year, monthIndex)}</p>
        <button
          type="button"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40"
          disabled={disabled}
          aria-label="Следующий месяц"
          onClick={() => changeMonth(1)}
        >
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="h-9" />;
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
              className={`relative flex h-9 flex-col items-center justify-center rounded-full text-sm font-medium tabular-nums ${
                isSelected
                  ? "bg-[var(--accent)] text-white"
                  : isToday
                    ? "bg-teal-50 text-teal-800 ring-1 ring-inset ring-teal-300/80"
                    : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              {Number(date.slice(-2))}
              {hasData ? (
                <span
                  className={`absolute bottom-1 h-1 w-1 rounded-full ${isSelected ? "bg-white" : "bg-teal-600"}`}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
