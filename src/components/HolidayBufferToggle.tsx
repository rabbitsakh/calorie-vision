"use client";

import { useEffect, useState } from "react";
import {
  HOLIDAY_BUFFER_FACTOR,
  isHolidayBufferOn,
  setHolidayBuffer,
} from "@/lib/holiday-buffer";

type HolidayBufferToggleProps = {
  selectedDate: string;
  onChange?: (on: boolean) => void;
};

export function HolidayBufferToggle({ selectedDate, onChange }: HolidayBufferToggleProps) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(isHolidayBufferOn(selectedDate));
  }, [selectedDate]);

  function toggle() {
    const next = !on;
    setHolidayBuffer(selectedDate, next);
    setOn(next);
    onChange?.(next);
  }

  const pct = Math.round((HOLIDAY_BUFFER_FACTOR - 1) * 100);

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-800">Праздничный запас</p>
        <p className="mt-0.5 text-xs text-slate-500">
          На сегодня +{pct}% к норме калорий — мягкий запас на праздник
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          on ? "bg-teal-600" : "bg-slate-300"
        }`}
        onClick={toggle}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}
