"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { FullscreenCelebration } from "@/components/FullscreenCelebration";
import {
  flushPendingMetaChests,
  openChest,
  presentChestGrant,
} from "@/lib/chest-client";
import type { RewardRarity } from "@/lib/rewards";
import { withBasePath } from "@/lib/paths";
import { pluralDays } from "@/lib/russian-text";
import {
  isSoftCelebrationQuietBlocked,
  isSoftCelebrationSeen,
  isSoftCelebrationsMutedToday,
  markSoftCelebrationSeen,
  muteSoftCelebrationsToday,
} from "@/lib/soft-celebration";

type WeekPerfectCelebrationProps = {
  today: string;
  selectedDate: string;
  refreshKey: number;
};

type StreakPayload = {
  daysLoggedThisWeek?: number;
  daysInWeekSoFar?: number;
  weekStart?: string;
};

/**
 * Soft week (Mon..today all logged, ≥5 days) → week chest (wave 3).
 */
export function WeekPerfectCelebration({
  today,
  selectedDate,
  refreshKey,
}: WeekPerfectCelebrationProps) {
  const day = useOptionalRationDay();
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState({
    title: "",
    subtitle: "",
    badge: "",
    lootKey: undefined as string | undefined,
    rarity: undefined as RewardRarity | undefined,
    rarityLabel: undefined as string | undefined,
  });
  const prevPerfect = useRef<boolean | null>(null);
  const close = useCallback(() => {
    setOpen(false);
    flushPendingMetaChests();
  }, []);

  useEffect(() => {
    if (selectedDate !== today) return;

    async function apply(data: StreakPayload) {
      const logged = data.daysLoggedThisWeek ?? 0;
      const total = data.daysInWeekSoFar ?? 0;
      const weekStart = data.weekStart ?? today;
      const perfect = total >= 5 && logged === total;

      if (
        prevPerfect.current === false &&
        perfect &&
        !isSoftCelebrationSeen("week-perfect", weekStart)
      ) {
        const muted = isSoftCelebrationsMutedToday(today);
        const quiet = isSoftCelebrationQuietBlocked();
        markSoftCelebrationSeen("week-perfect", weekStart);
        const result = await openChest({ source: "week", weekStart });
        const loot = result?.reward;
        const fallbackTitle = total >= 7 ? "Идеальная неделя!" : "Отличная неделя!";
        const fallbackSubtitle = `${logged} ${pluralDays(logged)} подряд с записями — регулярность на высоте.`;

        if (loot) {
          presentChestGrant(loot, {
            quiet,
            muted,
            fallbackTitle,
            fallbackSubtitle,
            onFullscreen: (reward) => {
              setCopy({
                title: reward.title,
                subtitle: reward.description,
                badge: "✦",
                lootKey: reward.key,
                rarity: reward.rarity,
                rarityLabel: reward.rarityLabel,
              });
              setOpen(true);
            },
          });
        } else if (!muted && !quiet) {
          setCopy({
            title: fallbackTitle,
            subtitle: fallbackSubtitle,
            badge: String(logged),
            lootKey: undefined,
            rarity: undefined,
            rarityLabel: undefined,
          });
          setOpen(true);
          flushPendingMetaChests();
        } else {
          flushPendingMetaChests();
        }
      }

      prevPerfect.current = perfect;
    }

    if (day?.data?.streak && day.today === today) {
      void apply(day.data.streak);
      return;
    }

    if (day && day.today === today && day.loading) {
      return;
    }

    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/streak?today=${encodeURIComponent(today)}`));
        if (!resp.ok) return;
        await apply((await resp.json()) as StreakPayload);
      } catch {
        // non-critical
      }
    })();
  }, [today, selectedDate, refreshKey, day]);

  return (
    <FullscreenCelebration
      onMuteToday={() => muteSoftCelebrationsToday(today)}
      open={open}
      variant="chest"
      title={copy.title}
      subtitle={copy.subtitle}
      pose="cheer"
      badge={copy.badge || undefined}
      lootKey={copy.lootKey}
      lootRarity={copy.rarity}
      lootRarityLabel={copy.rarityLabel}
      ctaLabel="Круто!"
      durationMs={0}
      onClose={close}
    />
  );
}
