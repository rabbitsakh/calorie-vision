"use client";

import { useEffect, useRef } from "react";
import { useCelebrationGate } from "@/components/CelebrationOrchestrator";
import { Mascot, type MascotPose } from "@/components/Mascot";
import type { CelebrationVariant } from "@/components/FullscreenCelebration";
import type { RewardRarity } from "@/lib/rewards";
import { hydrateQuietHoursFromAccount } from "@/lib/quiet-hours-prefs";
import {
  consumeSoftCelebrationSlot,
  isSoftCelebrationCapReached,
  isSoftCelebrationQuietBlocked,
  isSoftCelebrationSuppressed,
  muteSoftCelebrationsToday,
} from "@/lib/soft-celebration";
import { toDateKeyTz } from "@/lib/dates";

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
  const gate = useCelebrationGate();
  const todayKey = muteDate ?? toDateKeyTz(new Date());
  const claimedSlotRef = useRef(false);
  const budgetBlocked = isSoftCelebrationCapReached(todayKey);
  const suppressed = isSoftCelebrationSuppressed({
    open,
    quietBlocked: isSoftCelebrationQuietBlocked() || budgetBlocked,
    fullscreenActiveId: gate?.activeId ?? null,
  });

  useEffect(() => {
    hydrateQuietHoursFromAccount();
  }, []);

  useEffect(() => {
    if (open && suppressed) onClose();
  }, [open, suppressed, onClose]);

  // Claim a daily soft slot once per open — not on every onClose identity change.
  useEffect(() => {
    if (!open || suppressed) {
      claimedSlotRef.current = false;
      return;
    }
    if (claimedSlotRef.current) return;
    claimedSlotRef.current = true;
    if (!consumeSoftCelebrationSlot(todayKey)) onClose();
  }, [open, suppressed, todayKey, onClose]);

  useEffect(() => {
    if (!open || suppressed) return;
    if (durationMs <= 0) return;
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [open, suppressed, durationMs, onClose]);

  if (!open || suppressed) return null;

  return (
    <div
      className="soft-celeb-root fixed inset-0 z-50 flex items-end justify-center bg-[rgba(15,40,38,0.22)] p-4 pb-24 sm:items-center sm:pb-4"
      role="status"
      aria-live="polite"
      onClick={onClose}
    >
      <div
        className="soft-celeb-card relative w-full max-w-sm overflow-hidden px-5 py-5 text-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className={`pointer-events-none absolute left-1/2 top-2 h-16 w-16 -translate-x-1/2 rounded-full ${ringClass(pose, variant)}`}
          aria-hidden
        />
        <div className="relative mx-auto mb-2 flex flex-col items-center">
          <Mascot pose={pose} size="md" />
          {badge ? (
            <span
              className={`mt-1 rounded-md px-2 py-0.5 text-xs font-semibold text-white ${
                pose === "streak" || variant === "streak" ? "bg-amber-700" : "bg-teal-800"
              }`}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
        {subtitle ? <p className="mt-1 text-sm text-[var(--muted-strong)]">{subtitle}</p> : null}
        <button type="button" className="btn-quiet mt-3 text-sm text-[var(--accent-ink)]" onClick={onClose}>
          {ctaLabel}
        </button>
        {muteDate ? (
          <button
            type="button"
            className="mt-2 block w-full text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--accent-ink)] hover:underline"
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
