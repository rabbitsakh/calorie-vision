"use client";

import { useEffect, useRef, useState } from "react";
import { formatRestClock } from "@/lib/workouts/rest-timer";

type Props = {
  restSeconds: number;
  setRestSeconds: (n: number) => void;
  restEndsAt: number | null;
  restLeft: number;
  restSound: boolean;
  setRestSound: (v: boolean) => void;
  startRest: (sec?: number) => void;
  clearRest: () => void;
  options: readonly number[];
};

/**
 * One rest control. Presets live in the menu — they do not sit in the list.
 */
export function RestTimer({
  restSeconds,
  setRestSeconds,
  restEndsAt,
  restLeft,
  restSound,
  setRestSound,
  startRest,
  clearRest,
  options,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const running = Boolean(restEndsAt && Number.isFinite(restEndsAt));
  const label = formatRestClock(running ? restLeft : restSeconds);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl px-3 text-sm font-semibold tabular-nums ${
          running
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--border-quiet)] bg-white text-[var(--foreground)]"
        }`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={running ? `Отдых ${label}` : `Отдых ${label}, выбрать длительность`}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>⏱</span>
        {label}
      </button>
      {open ? (
        <div
          role="menu"
          className="cv-menu absolute right-0 z-40 mt-1 flex w-44 flex-col rounded-xl border border-[var(--border-quiet)] py-1 shadow-lg"
        >
          {options.map((sec) => (
            <button
              key={sec}
              type="button"
              role="menuitem"
              className={`min-h-[44px] px-3 text-left text-sm font-semibold tabular-nums ${
                sec === restSeconds
                  ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "text-[var(--foreground)]"
              }`}
              onClick={() => {
                setRestSeconds(sec);
                if (running) startRest(sec);
                setOpen(false);
              }}
            >
              {formatRestClock(sec)}
            </button>
          ))}
          {running ? (
            <button
              type="button"
              role="menuitem"
              className="min-h-[44px] px-3 text-left text-sm text-[var(--muted-strong)]"
              onClick={() => {
                clearRest();
                setOpen(false);
              }}
            >
              Пропустить
            </button>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="min-h-[44px] px-3 text-left text-sm font-semibold text-[var(--accent-ink)]"
              onClick={() => {
                startRest();
                setOpen(false);
              }}
            >
              Старт отдыха
            </button>
          )}
          <label className="flex min-h-[44px] items-center gap-2 px-3 text-sm text-[var(--muted-strong)]">
            <input
              type="checkbox"
              checked={restSound}
              onChange={(e) => setRestSound(e.target.checked)}
            />
            Звук в конце
          </label>
        </div>
      ) : null}
    </div>
  );
}
