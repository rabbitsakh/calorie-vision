"use client";

import { useEffect } from "react";
import { Mascot, type MascotPose } from "@/components/Mascot";
import type { CelebrationVariant } from "@/components/FullscreenCelebration";
import type { RewardRarity } from "@/lib/rewards";
import { hydrateQuietHoursFromAccount } from "@/lib/quiet-hours-prefs";
import {
  isSoftCelebrationQuietBlocked,
  muteSoftCelebrationsToday,
} from "@/lib/soft-celebration";

type SoftCelebrationProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  pose?: MascotPose;
  /** Kept for API compat with former fullscreen wrapper; drives ring accent. */
  variant?: CelebrationVariant;
  /** Optional small badge (e.g. streak days); shown under the mascot. */
  badge?: string;
  /** Ignored on soft card — major loot uses FullscreenCelebration. */
  lootRarity?: RewardRarity;
  lootRarityLabel?: string;
  durationMs?: number;
  ctaLabel?: string;
  /** When set, shows «Не показывать сегодня» and mutes soft celebrations for this date. */
  muteDate?: string;
  onClose: () => void;
};

function ringClass(pose: MascotPose, variant?: CelebrationVariant): string {
  if (pose === "streak" || variant === "streak") return "soft-celeb-ring soft-celeb-ring-streak";
  if (pose === "goal" || variant === "goal") return "soft-celeb-ring soft-celeb-ring-goal";
  return "soft-celeb-ring bg-teal-100/80";
}

/**
 * Everyday win celebration — compact card (not fullscreen).
 * Auto-hides after a few seconds; tap / «Закрыть» sooner.
 * Fullscreen is reserved for major milestones (chests, badges, week perfect).
 */
export function SoftCelebration({
  open,
  title,
  subtitle,
  pose = "cheer",
  variant,
  badge,
  durationMs = 2800,
  ctaLabel = "Закрыть",
  muteDate,
  onClose,
}: SoftCelebrationProps) {
  const suppressed = !open || isSoftCelebrationQuietBlocked();

  useEffect(() => {
    hydrateQuietHoursFromAccount();
  }, []);

  useEffect(() => {
    if (open && suppressed) onClose();
  }, [open, suppressed, onClose]);

  useEffect(() => {
    if (!open || suppressed) return;
    if (durationMs <= 0) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, suppressed, durationMs, onClose]);

  if (!open || suppressed) return null;

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
        <div
          className={`pointer-events-none absolute left-1/2 top-2 h-20 w-20 -translate-x-1/2 rounded-full ${ringClass(pose, variant)}`}
          aria-hidden
        />
        <div className="relative mx-auto mb-2 flex flex-col items-center">
          <Mascot pose={pose} size="lg" />
          {badge ? (
            <span
              className={`mt-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white ${
                pose === "streak" || variant === "streak" ? "bg-amber-600" : "bg-teal-700"
              }`}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-lg font-bold text-slate-900">{title}</p>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
        <button type="button" className="btn-quiet mt-3 text-sm text-teal-800" onClick={onClose}>
          {ctaLabel}
        </button>
        {muteDate ? (
          <button
            type="button"
            className="mt-2 block w-full text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
            onClick={() => {
              muteSoftCelebrationsToday(muteDate);
              onClose();
            }}
          >
            Не показывать сегодня
          </button>
        ) : null}
      </div>
    </div>
  );
}
