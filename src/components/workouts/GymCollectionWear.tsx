"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StickerArt } from "@/components/StickerArt";
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

type WearSize = "md" | "lg";

/**
 * R5–R9 / R16 — equipped collection wear on gym surfaces and ration DayHero.
 * Links into profile collection when anything is worn.
 */
export function GymCollectionWear({
  className = "",
  size = "lg",
}: {
  className?: string;
  /** R16 — default larger so frame/sticker/cheer read on DayHero and gym. */
  size?: WearSize;
}) {
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

  const avatar = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const art = size === "lg" ? 30 : 24;
  const phraseClass =
    size === "lg"
      ? "text-sm font-medium leading-snug text-[var(--accent-ink)]"
      : "max-w-[9rem] truncate text-[11px] font-semibold text-[var(--accent-ink)]";

  return (
    <Link
      href={withBasePath("/profile#rewards")}
      className={`flex flex-wrap items-center gap-2 ${className}`.trim()}
      aria-label="Коллекция наград"
      title="Открыть коллекцию"
    >
      {sticker || frameClass ? (
        <span
          className={`inline-flex ${avatar} items-center justify-center rounded-full bg-[var(--accent-soft)] shadow-sm ${frameClass}`.trim()}
        >
          {sticker ? (
            <StickerArt stickerKey={sticker} size={art} title="Наклейка из коллекции" />
          ) : null}
        </span>
      ) : null}
      {phrase ? <p className={`max-w-[14rem] ${phraseClass}`}>{phrase}</p> : null}
    </Link>
  );
}
