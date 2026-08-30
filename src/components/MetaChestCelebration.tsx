"use client";

import { useCallback, useEffect, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import type { ChestRewardPayload } from "@/lib/chest-client";
import type { RewardRarity } from "@/lib/rewards";

const EVENT = "cv-meta-chest";

/**
 * Shows a follow-up celebration when a collection meta chest drops (wave 9).
 * Mount once in AppShell.
 */
export function MetaChestCelebration() {
  const [queue, setQueue] = useState<ChestRewardPayload[]>([]);
  const current = queue[0] ?? null;

  useEffect(() => {
    function onMeta(event: Event) {
      const detail = (event as CustomEvent<ChestRewardPayload[]>).detail;
      if (!Array.isArray(detail) || detail.length === 0) return;
      setQueue((prev) => [...prev, ...detail]);
    }
    window.addEventListener(EVENT, onMeta);
    return () => window.removeEventListener(EVENT, onMeta);
  }, []);

  const close = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  if (!current) return null;

  return (
    <SoftCelebration
      open
      variant="chest"
      pose="cheer"
      title={current.title}
      subtitle={current.description || "Мета-сундук коллекции"}
      lootRarity={current.rarity as RewardRarity | undefined}
      lootRarityLabel={current.rarityLabel}
      badge="★"
      durationMs={0}
      ctaLabel="Круто!"
      onClose={close}
    />
  );
}
