"use client";

import { useEffect, useState } from "react";
import { FullscreenCelebration } from "@/components/FullscreenCelebration";
import { openChest } from "@/lib/chest-client";
import type { RewardRarity } from "@/lib/rewards";
import { pluralDays } from "@/lib/russian-text";
import { CELEBRATION_STREAK_MILESTONES } from "@/lib/streak-chest";

const MILESTONE_COPY: Record<number, string> = {
  7: "Неделя без пропусков — это уже привычка!",
  14: "Две недели подряд. Вы в форме!",
  30: "Месяц дневника — невероятно!",
  60: "Два месяца. Вы мастер регулярности!",
  100: "Сто дней! Легендарный результат!",
  200: "200 дней подряд. Вы вдохновляете!",
  365: "Год дневника! Это уровень чемпиона!",
};

function seenKey(milestone: number): string {
  return `milestone-seen-${milestone}`;
}

function isMilestoneSeen(milestone: number): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(seenKey(milestone)) === "1";
  } catch {
    return true;
  }
}

function markMilestoneSeen(milestone: number): void {
  try {
    localStorage.setItem(seenKey(milestone), "1");
  } catch {
    // ignore
  }
}

/** Highest reached celebration milestone that hasn't been shown yet. */
export function findUnseenMilestone(streak: number): number | null {
  const reached = CELEBRATION_STREAK_MILESTONES.filter((m) => streak >= m);
  for (let i = reached.length - 1; i >= 0; i--) {
    const m = reached[i]!;
    if (!isMilestoneSeen(m)) return m;
  }
  return null;
}

type MilestoneCelebrationProps = {
  streak: number;
};

/**
 * Big streak milestones — fullscreen chest with loot (wave 3).
 */
export function MilestoneCelebration({ streak }: MilestoneCelebrationProps) {
  const [milestone, setMilestone] = useState<number | null>(null);
  const [loot, setLoot] = useState<{
    title: string;
    description: string;
    rarity?: RewardRarity;
    rarityLabel?: string;
  } | null>(null);

  useEffect(() => {
    const next = findUnseenMilestone(streak);
    if (next == null) return;
    setMilestone(next);
    markMilestoneSeen(next);
    void (async () => {
      const result = await openChest({ source: "streak", milestone: next });
      if (result?.reward) {
        setLoot({
          title: result.reward.title,
          description: result.reward.description,
          rarity: result.reward.rarity,
          rarityLabel: result.reward.rarityLabel,
        });
      }
    })();
  }, [streak]);

  if (milestone == null) return null;

  const subtitle = loot
    ? loot.description
    : (MILESTONE_COPY[milestone] ?? `Вы достигли ${milestone} дней подряд!`);

  return (
    <FullscreenCelebration
      open
      variant="chest"
      pose="cheer"
      badge={String(milestone)}
      title={loot?.title ?? `${milestone} ${pluralDays(milestone)} — сундук!`}
      subtitle={subtitle}
      lootRarity={loot?.rarity}
      lootRarityLabel={loot?.rarityLabel}
      durationMs={0}
      ctaLabel="Круто!"
      onClose={() => {
        setMilestone(null);
        setLoot(null);
      }}
    />
  );
}
