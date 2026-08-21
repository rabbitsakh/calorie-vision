"use client";

import { useEffect } from "react";

type SoftCelebrationProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Glyph inside the teal badge; defaults to a checkmark. */
  badge?: string;
  durationMs?: number;
  onClose: () => void;
};

/**
 * Short, dismissible overlay for everyday wins (not milestone modals).
 * Auto-hides after a few seconds; tap anywhere to close sooner.
 */
export function SoftCelebration({
  open,
  title,
  subtitle,
  badge = "✓",
  durationMs = 2600,
  onClose,
}: SoftCelebrationProps) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div
      className="soft-celeb-root fixed inset-0 z-50 flex items-end justify-center bg-slate-900/25 p-4 pb-24 backdrop-blur-[1px] sm:items-center sm:pb-4"
      role="status"
      aria-live="polite"
      onClick={onClose}
    >
      <div
        className="soft-celeb-card relative w-full max-w-sm overflow-hidden rounded-3xl bg-white px-5 py-5 text-center shadow-xl ring-1 ring-teal-100"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="soft-celeb-ring pointer-events-none absolute left-1/2 top-3 h-16 w-16 -translate-x-1/2 rounded-full bg-teal-100/80" aria-hidden />
        <div className="soft-celeb-dot relative mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-teal-600 text-lg font-bold text-white">
          {badge}
        </div>
        <p className="text-lg font-bold text-slate-900">{title}</p>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        <button
          type="button"
          className="btn-quiet mt-3 text-sm text-teal-800"
          onClick={onClose}
        >
          Закрыть
        </button>
      </div>
    </div>
  );
}
