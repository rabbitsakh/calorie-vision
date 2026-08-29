"use client";

import {
  FullscreenCelebration,
  type CelebrationVariant,
} from "@/components/FullscreenCelebration";
import type { MascotPose } from "@/components/Mascot";
import { muteSoftCelebrationsToday } from "@/lib/soft-celebration";

type SoftCelebrationProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  pose?: MascotPose;
  variant?: CelebrationVariant;
  /** Optional small badge (e.g. streak days); shown under the mascot. */
  badge?: string;
  durationMs?: number;
  ctaLabel?: string;
  /** When set, shows «Не показывать сегодня» and mutes soft celebrations for this date. */
  muteDate?: string;
  onClose: () => void;
};

function variantFromPose(pose: MascotPose): CelebrationVariant {
  if (pose === "streak") return "streak";
  if (pose === "goal") return "goal";
  return "cheer";
}

/**
 * Everyday win celebration — immersive fullscreen stage (not a white card).
 * Auto-hides after a few seconds; tap / «Закрыть» sooner.
 */
export function SoftCelebration({
  open,
  title,
  subtitle,
  pose = "cheer",
  variant,
  badge,
  durationMs = 3400,
  ctaLabel,
  muteDate,
  onClose,
}: SoftCelebrationProps) {
  return (
    <FullscreenCelebration
      open={open}
      title={title}
      subtitle={subtitle}
      pose={pose}
      badge={badge}
      variant={variant ?? variantFromPose(pose)}
      durationMs={durationMs}
      ctaLabel={ctaLabel}
      onMuteToday={muteDate ? () => muteSoftCelebrationsToday(muteDate) : undefined}
      onClose={onClose}
    />
  );
}
