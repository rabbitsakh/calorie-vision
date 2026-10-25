"use client";

import { useEffect } from "react";
import { notifyChestInbox } from "@/lib/chest-inbox";
import { notifyChestQueueRefresh } from "@/lib/chest-queue-refresh";
import { withBasePath } from "@/lib/paths";
import {
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
 * C3 — referral loot is already granted server-side.
 * Inbox only (no SoftCelebration competing with ChestDock).
 */
export function ReferralChestToast() {
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
        notifyChestQueueRefresh();
        notifyChestInbox({
          title: "Друг открыл приложение по вашей ссылке",
          subtitle: `В коллекции: ${next.title}`,
          rewardKey: next.key,
        });
      } catch {
        // non-critical
      }
    })();
  }, []);

  return null;
}
