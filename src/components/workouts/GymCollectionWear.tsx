"use client";

import { useEffect, useState } from "react";
import { DiarySticker } from "@/components/DiarySticker";
import {
  getEquippedCheerKey,
  hydrateEquippedCheerFromAccount,
  subscribeEquippedCheer,
} from "@/lib/equipped-cheer";
import {
  getEquippedStickerKey,
  hydrateEquippedStickerFromAccount,
  subscribeEquippedSticker,
} from "@/lib/equipped-sticker";
import { cheerPhrase } from "@/lib/rewards";

/**
 * R5 — show equipped collection wear on gym Today (sticker + cheer line).
 */
export function GymCollectionWear({ className = "" }: { className?: string }) {
  const [sticker, setSticker] = useState<string | null>(null);
  const [cheerKey, setCheerKey] = useState<string | null>(null);

  useEffect(() => {
    setSticker(getEquippedStickerKey());
    setCheerKey(getEquippedCheerKey());
    void hydrateEquippedStickerFromAccount().then(setSticker);
    void hydrateEquippedCheerFromAccount().then(setCheerKey);
    const unsubS = subscribeEquippedSticker(setSticker);
    const unsubC = subscribeEquippedCheer(setCheerKey);
    return () => {
      unsubS();
      unsubC();
    };
  }, []);

  const phrase = cheerKey ? cheerPhrase(cheerKey) : null;
  if (!sticker && !phrase) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
      aria-label="Награда из коллекции"
    >
      {sticker ? <DiarySticker /> : null}
      {phrase ? (
        <p className="text-xs font-medium text-[var(--muted-strong)]">{phrase}</p>
      ) : null}
    </div>
  );
}
