"use client";

import { useEffect, useRef, useState, type TouchEvent } from "react";
import { DayCalendar } from "@/components/DayCalendar";
import { formatDateWords, mondayOfWeek, shiftDateKey, weekdayShort } from "@/lib/dates";

type DateNavBarProps = {
  date: string;
  today: string;
  onDateChange: (date: string) => void;
  refreshKey?: number;
};

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      aria-hidden
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
    >
      {dir === "left" ? (
        <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

export function DateNavBar({ date, today, onDateChange, refreshKey }: DateNavBarProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
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
  const isToday = date === today;
  const dateLabel = isToday ? `Сегодня · ${formatDateWords(date)}` : formatDateWords(date);

  function onTouchStart(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  }

  function onTouchEnd(event: TouchEvent) {
    const startX = touchStartX.current;
    const startY = touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    const touch = event.changedTouches[0];
    if (startX == null || startY == null || !touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx > 0) {
      onDateChange(shiftDateKey(date, -1));
    } else if (canGoForward) {
      onDateChange(shiftDateKey(date, 1));
    }
  }

  return (
    <div
      className="relative touch-pan-y"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] active:scale-95"
          aria-label="Предыдущий день"
          onClick={() => onDateChange(shiftDateKey(date, -1))}
        >
          <Chevron dir="left" />
        </button>

        <button
          type="button"
          className="min-w-0 flex-1 rounded-lg px-1 py-1 text-center transition-colors hover:bg-white/50"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={`${dateLabel}, открыть календарь`}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="inline-flex max-w-full items-center justify-center gap-1.5">
            <span className="truncate font-display text-[0.95rem] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
              {dateLabel}
            </span>
            <svg
              aria-hidden
              className={`h-3.5 w-3.5 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        <button
          type="button"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--accent-soft)] hover:text-[var(--accent-ink)] active:scale-95 disabled:opacity-30"
          aria-label="Следующий день"
          disabled={!canGoForward}
          onClick={() => canGoForward && onDateChange(shiftDateKey(date, 1))}
        >
          <Chevron dir="right" />
        </button>

        {!isToday ? (
          <button
            type="button"
            className="ml-0.5 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-[var(--accent-ink)] transition-colors hover:bg-white/60"
            onClick={() => pickDate(today)}
          >
            Сегодня
          </button>
        ) : null}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const future = day > today;
          const selected = day === date;
          const dayIsToday = day === today;
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => pickDate(day)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors disabled:opacity-40 ${
                selected
                  ? "bg-[var(--accent)] text-white"
                  : dayIsToday
                    ? "bg-white/70 text-[var(--accent-ink)] hover:bg-white"
                    : "text-[var(--foreground)] hover:bg-white/55"
              }`}
            >
              <span
                className={`text-[0.58rem] font-bold uppercase tracking-[0.08em] ${
                  selected ? "text-white/85" : "text-[var(--muted)]"
                }`}
              >
                {weekdayShort(day)}
              </span>
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                  selected
                    ? "text-white"
                    : dayIsToday
                      ? "ring-2 ring-[var(--accent)]/45"
                      : ""
                }`}
              >
                {Number(day.slice(-2))}
              </span>
            </button>
          );
        })}
      </div>

      {open ? (
        <div
          ref={dialogRef}
          className="absolute left-0 right-0 z-20 mt-2 rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white p-3 shadow-[var(--shadow-card)]"
          role="dialog"
          aria-label="Календарь"
        >
          <DayCalendar selectedDate={date} onSelect={pickDate} refreshKey={refreshKey} />
        </div>
      ) : null}
    </div>
  );
}
