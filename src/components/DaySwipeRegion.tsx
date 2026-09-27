"use client";

import { useRef, type ReactNode, type TouchEvent } from "react";
import { shiftDateKey } from "@/lib/dates";

type DaySwipeRegionProps = {
  date: string;
  today: string;
  onDateChange: (next: string) => void;
  className?: string;
  children: ReactNode;
};

/**
 * Horizontal swipe across the day scene / meal feed (Wave E).
 * Ignores mostly-vertical gestures so the diary still scrolls.
 */
export function DaySwipeRegion({
  date,
  today,
  onDateChange,
  className,
  children,
}: DaySwipeRegionProps) {
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);

  function onTouchStart(event: TouchEvent) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    startX.current = touch.clientX;
    startY.current = touch.clientY;
  }

  function onTouchEnd(event: TouchEvent) {
    const x0 = startX.current;
    const y0 = startY.current;
    startX.current = null;
    startY.current = null;
    const touch = event.changedTouches[0];
    if (x0 == null || y0 == null || !touch) return;
    const dx = touch.clientX - x0;
    const dy = touch.clientY - y0;
    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.35) return;
    if (dx > 0) {
      onDateChange(shiftDateKey(date, -1));
      return;
    }
    if (date < today) {
      onDateChange(shiftDateKey(date, 1));
    }
  }

  return (
    <div
      className={className}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}
