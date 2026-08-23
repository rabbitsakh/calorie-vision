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
  /** Optional small badge (e.g. streak days); shown under the mascot. */
  badge?: string;
  durationMs?: number;
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
  badge,
  durationMs = 3400,
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
      variant={variantFromPose(pose)}
      durationMs={durationMs}
      onMuteToday={muteDate ? () => muteSoftCelebrationsToday(muteDate) : undefined}
      onClose={onClose}
    />
  );
}
