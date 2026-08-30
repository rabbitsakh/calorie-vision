"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { SoftCelebration } from "@/components/SoftCelebration";
import { openChest } from "@/lib/chest-client";
import type { RewardRarity } from "@/lib/rewards";
import { withBasePath } from "@/lib/paths";
import { pluralDays } from "@/lib/russian-text";
import {
  isSoftCelebrationSeen,
  isSoftCelebrationsMutedToday,
  markSoftCelebrationSeen,
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
    rarity: undefined as RewardRarity | undefined,
    rarityLabel: undefined as string | undefined,
  });
  const prevPerfect = useRef<boolean | null>(null);
  const close = useCallback(() => setOpen(false), []);

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
        !isSoftCelebrationsMutedToday(today) &&
        !isSoftCelebrationSeen("week-perfect", weekStart)
      ) {
        markSoftCelebrationSeen("week-perfect", weekStart);
        const result = await openChest({ source: "week", weekStart });
        const loot = result?.reward;
        setCopy({
          title: loot ? loot.title : total >= 7 ? "Идеальная неделя!" : "Отличная неделя!",
          subtitle: loot
            ? loot.description
            : `${logged} ${pluralDays(logged)} подряд с записями — регулярность на высоте.`,
          badge: loot ? "✦" : String(logged),
          rarity: loot?.rarity,
          rarityLabel: loot?.rarityLabel,
        });
        setOpen(true);
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
    <SoftCelebration
      muteDate={today}
      open={open}
      variant="chest"
      title={copy.title}
      subtitle={copy.subtitle}
      pose="cheer"
      badge={copy.badge || undefined}
      lootRarity={copy.rarity}
      lootRarityLabel={copy.rarityLabel}
      ctaLabel="Круто!"
      durationMs={0}
      onClose={close}
    />
  );
}
