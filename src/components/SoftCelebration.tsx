"use client";

import { useEffect } from "react";
import { Mascot, type MascotPose } from "@/components/Mascot";

type SoftCelebrationProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  pose?: MascotPose;
  /** Optional small badge (e.g. streak days); shown under the mascot. */
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
  pose = "cheer",
  badge,
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
        <div className={`soft-celeb-ring pointer-events-none absolute left-1/2 top-2 h-20 w-20 -translate-x-1/2 rounded-full ${pose === "streak" ? "soft-celeb-ring-streak" : pose === "goal" ? "soft-celeb-ring-goal" : "bg-teal-100/80"}`} aria-hidden />
        <div className="relative mx-auto mb-2 flex flex-col items-center">
          <Mascot pose={pose} size="lg" />
          {badge ? (
            <span className={`mt-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${pose === "streak" ? "bg-amber-600" : "bg-teal-700"}`}>
              {badge}
            </span>
          ) : null}
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
