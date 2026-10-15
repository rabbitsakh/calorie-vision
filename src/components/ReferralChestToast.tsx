"use client";

import { useCallback, useEffect, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import { notifyChestInbox } from "@/lib/chest-inbox";
import { withBasePath } from "@/lib/paths";
import {
  isSoftCelebrationQuietBlocked,
  isSoftCelebrationSeen,
  isSoftCelebrationsMutedToday,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";

type ReferralReward = {
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
  source: string | null;
  sourceKey: string | null;
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Soft toast for the inviter when a referral chest was granted while they were away.
 * Quiet mode → inbox toast with equip/collection CTA (R2c); loud → SoftCelebration.
 */
export function ReferralChestToast() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Друг присоединился!");
  const [subtitle, setSubtitle] = useState<string | undefined>();
  const [seenKey, setSeenKey] = useState<string | null>(null);

  useEffect(() => {
    const today = todayKey();
    if (isSoftCelebrationsMutedToday(today)) return;

    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/rewards"), { cache: "no-store" });
        if (!resp.ok) return;
        const data = (await resp.json()) as { rewards?: ReferralReward[] };
        const pending = (data.rewards ?? []).filter(
          (r) =>
            r.unlocked &&
            r.source === "referral" &&
            r.sourceKey &&
            !isSoftCelebrationSeen("referral-chest", r.sourceKey),
        );
        const next = pending[0];
        if (!next?.sourceKey) return;
        markSoftCelebrationSeen("referral-chest", next.sourceKey);
        setSeenKey(next.sourceKey);

        const quiet = isSoftCelebrationQuietBlocked();
        if (quiet) {
          notifyChestInbox({
            title: "Друг открыл приложение по вашей ссылке",
            subtitle: `В коллекции: ${next.title}`,
            rewardKey: next.key,
          });
          return;
        }

        setTitle("Друг открыл приложение по вашей ссылке");
        setSubtitle(`В коллекции: ${next.title}`);
        setOpen(true);
      } catch {
        // non-critical
      }
    })();
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (seenKey) markSoftCelebrationSeen("referral-chest", seenKey);
  }, [seenKey]);

  return (
    <SoftCelebration
      open={open}
      variant="cheer"
      pose="cheer"
      title={title}
      subtitle={subtitle}
      badge="✦"
      durationMs={4200}
      ctaLabel="Круто"
      muteDate={todayKey()}
      onClose={close}
    />
  );
}
