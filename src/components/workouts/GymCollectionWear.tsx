"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { withBasePath } from "@/lib/paths";
import { cheerPhrase, frameAvatarClass } from "@/lib/rewards";

/**
 * R5–R9 — equipped collection wear on gym surfaces and ration DayHero.
 * Links into profile collection when anything is worn.
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
    <Link
      href={withBasePath("/profile#rewards")}
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
      aria-label="Коллекция наград"
      title="Открыть коллекцию"
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
    </Link>
  );
}
