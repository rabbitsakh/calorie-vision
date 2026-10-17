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
import {
  getEquippedFrameKey,
  hydrateEquippedFrameFromAccount,
  subscribeEquippedFrame,
} from "@/lib/equipped-frame";
import { cheerPhrase, frameAvatarClass } from "@/lib/rewards";

/**
 * R5/R6/R7 — equipped collection wear on gym Today, summary, and live.
 */
export function GymCollectionWear({ className = "" }: { className?: string }) {
  const [sticker, setSticker] = useState<string | null>(null);
  const [cheerKey, setCheerKey] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState<string | null>(null);

  useEffect(() => {
    setSticker(getEquippedStickerKey());
    setCheerKey(getEquippedCheerKey());
    setFrameKey(getEquippedFrameKey());
    void hydrateEquippedStickerFromAccount().then(setSticker);
    void hydrateEquippedCheerFromAccount().then(setCheerKey);
    void hydrateEquippedFrameFromAccount().then(setFrameKey);
    const unsubS = subscribeEquippedSticker(setSticker);
    const unsubC = subscribeEquippedCheer(setCheerKey);
    const unsubF = subscribeEquippedFrame(setFrameKey);
    return () => {
      unsubS();
      unsubC();
      unsubF();
    };
  }, []);

  const phrase = cheerKey ? cheerPhrase(cheerKey) : null;
  const frameClass = frameAvatarClass(frameKey);
  if (!sticker && !phrase && !frameClass) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
      aria-label="Награда из коллекции"
    >
      {sticker || frameClass ? (
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 ${frameClass}`.trim()}
        >
          {sticker ? <DiarySticker /> : null}
        </span>
      ) : null}
      {phrase ? (
        <p className="text-xs font-medium text-[var(--muted-strong)]">{phrase}</p>
      ) : null}
    </div>
  );
}
