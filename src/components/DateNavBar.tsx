"use client";

import { useEffect, useRef, useState } from "react";
import { Chip } from "@/components/Chip";
import { DayCalendar } from "@/components/DayCalendar";
import { formatDateWords, mondayOfWeek, shiftDateKey, weekdayShort } from "@/lib/dates";

type DateNavBarProps = {
  date: string;
  today: string;
  onDateChange: (date: string) => void;
  refreshKey?: number;
};

export function DateNavBar({ date, today, onDateChange, refreshKey }: DateNavBarProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const weekStart = mondayOfWeek(date);
  const weekDays = Array.from({ length: 7 }, (_, index) => shiftDateKey(weekStart, index));

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleClick(event: MouseEvent) {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function pickDate(next: string) {
    onDateChange(next);
    setOpen(false);
  }

  const canGoForward = date < today;

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="btn btn-secondary h-11 min-h-11 px-3 text-lg leading-none"
          aria-label="Предыдущий день"
          onClick={() => onDateChange(shiftDateKey(date, -1))}
        >
          ←
        </button>
        <button
          type="button"
          className="min-w-0 flex-1 rounded-xl px-2 py-1.5 text-center hover:bg-slate-50"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="block truncate text-sm font-bold capitalize text-slate-900">
            {formatDateWords(date)}
          </span>
        </button>
        <button
          type="button"
          className="btn btn-secondary h-11 min-h-11 px-3 text-lg leading-none"
          aria-label="Следующий день"
          disabled={!canGoForward}
          onClick={() => canGoForward && onDateChange(shiftDateKey(date, 1))}
        >
          →
        </button>
        {date !== today ? (
          <Chip active onClick={() => pickDate(today)}>
            Сегодня
          </Chip>
        ) : null}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const future = day > today;
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => pickDate(day)}
              className={`flex min-h-11 flex-col items-center justify-center rounded-xl text-[0.65rem] font-semibold ${
                day === date
                  ? "bg-[var(--accent)] text-white"
                  : day === today
                    ? "bg-teal-50 text-teal-800"
                    : "text-slate-600 hover:bg-slate-100"
              } disabled:opacity-40`}
            >
              <span className="uppercase">{weekdayShort(day)}</span>
              <span className="text-sm">{Number(day.slice(-2))}</span>
            </button>
          );
        })}
      </div>

      {open ? (
        <div
          ref={dialogRef}
          className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
        >
          <DayCalendar selectedDate={date} onSelect={pickDate} refreshKey={refreshKey} />
        </div>
      ) : null}
    </div>
  );
}
