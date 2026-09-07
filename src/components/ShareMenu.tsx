"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ShareDayButton } from "@/components/ShareDayButton";
import { ShareWeekButton } from "@/components/ShareWeekButton";

type ShareMenuProps = {
  date: string;
  className?: string;
};

/** One quiet control for day/week share cards (avoids two full buttons under DayHero). */
export function ShareMenu({ date, className = "" }: ShareMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        Поделиться
        <span aria-hidden className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute left-0 z-20 mt-1 min-w-[10.5rem] rounded-xl border border-slate-200 bg-white p-1.5 shadow-md"
        >
          <ShareDayButton date={date} variant="menu" onDone={() => setOpen(false)} />
          <ShareWeekButton endDate={date} variant="menu" onDone={() => setOpen(false)} />
        </div>
      ) : null}
    </div>
  );
}
