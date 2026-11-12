"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { menuAnchor } from "@/lib/workouts/menu-anchor";
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
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const running = Boolean(restEndsAt && Number.isFinite(restEndsAt));
  const label = formatRestClock(running ? restLeft : restSeconds);

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight || 280;
      const menuWidth = menuRef.current?.offsetWidth || 176;
      setBox(
        menuAnchor({
          buttonTop: rect.top,
          buttonBottom: rect.bottom,
          buttonRight: rect.right,
          viewportHeight: window.innerHeight,
          viewportWidth: window.innerWidth,
          menuWidth,
          menuHeight,
        }),
      );
    };
    place();
    const scroller = document.querySelector(".cv-app-main");
    window.addEventListener("resize", place);
    scroller?.addEventListener("scroll", place);
    return () => {
      window.removeEventListener("resize", place);
      scroller?.removeEventListener("scroll", place);
    };
  }, [open, options, running]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
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
      {open
        ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="cv-menu fixed z-[80] flex w-44 flex-col rounded-xl border border-[var(--border-quiet)] py-1 shadow-lg"
          style={{ top: box?.top ?? -9999, left: box?.left ?? 8, position: "fixed" }}
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
        </div>,
          document.documentElement,
        )
        : null}
    </div>
  );
}
