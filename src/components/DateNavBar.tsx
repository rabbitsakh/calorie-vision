"use client";

import { useEffect, useRef, useState } from "react";
import { DayCalendar } from "@/components/DayCalendar";
import { formatDateWords, shiftDateKey } from "@/lib/dates";

type DateNavBarProps = {
  date: string;
  today: string;
  onDateChange: (date: string) => void;
  refreshKey?: number;
};

export function DateNavBar({ date, today, onDateChange, refreshKey }: DateNavBarProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

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
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm">
        <button
          type="button"
          className="btn btn-secondary px-3 py-2 text-lg leading-none"
          aria-label="Предыдущий день"
          onClick={() => onDateChange(shiftDateKey(date, -1))}
        >
          ←
        </button>

        <button
          type="button"
          className="min-w-0 flex-1 rounded-xl px-2 py-2 text-center hover:bg-slate-50"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="block text-xs font-semibold uppercase tracking-wide text-teal-700">Дата</span>
          <span className="block truncate text-sm font-bold capitalize text-slate-900">
            {formatDateWords(date)}
          </span>
        </button>

        <button
          type="button"
          className="btn btn-secondary px-3 py-2 text-lg leading-none"
          aria-label="Следующий день"
          disabled={!canGoForward}
          onClick={() => canGoForward && onDateChange(shiftDateKey(date, 1))}
        >
          →
        </button>
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
