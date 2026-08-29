"use client";

import { useCallback, useEffect, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import { unlockPendingBadges } from "@/lib/badge-unlock-client";
import type { BadgeDef } from "@/lib/badges";
import {
  isSoftCelebrationSeen,
  isSoftCelebrationsMutedToday,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";
import { toDateKey } from "@/lib/dates";

type BadgeUnlockHostProps = {
  /** Bump after meals / water / day reload so unlocks land without opening Profile. */
  refreshKey: number;
};

/**
 * Unlocks badges on ration (and celebrates the first new one).
 * Profile BadgesPanel still unlocks on visit; soft-celeb flags prevent double show.
 */
export function BadgeUnlockHost({ refreshKey }: BadgeUnlockHostProps) {
  const [unlock, setUnlock] = useState<BadgeDef | null>(null);
  const todayKey = toDateKey(new Date());

  const close = useCallback(() => setUnlock(null), []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        if (isSoftCelebrationsMutedToday(todayKey)) {
          await unlockPendingBadges();
          return;
        }
        const { newlyUnlocked } = await unlockPendingBadges();
        if (cancelled || newlyUnlocked.length === 0) return;

        const next = newlyUnlocked.find(
          (badge) => !isSoftCelebrationSeen("badge-unlock", badge.key),
        );
        if (!next) return;
        markSoftCelebrationSeen("badge-unlock", next.key);
        setUnlock(next);
      })();
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [refreshKey, todayKey]);

  return (
    <SoftCelebration
      open={unlock != null}
      variant="badge"
      pose="cheer"
      title={unlock?.title ?? "Новое достижение!"}
      subtitle={unlock?.description}
      badge="★"
      durationMs={0}
      ctaLabel="Круто!"
      muteDate={todayKey}
      onClose={close}
    />
  );
}
