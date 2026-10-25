"use client";

import { useEffect, useState } from "react";
import { RewardArt } from "@/components/RewardArt";
import { EQUIP_PULSE_MS, subscribeEquipPulse } from "@/lib/equip-pulse";
import {
  getEquippedStickerKey,
  hydrateEquippedStickerFromAccount,
  subscribeEquippedSticker,
} from "@/lib/equipped-sticker";
import { isStickerReward, rewardDef } from "@/lib/rewards";

/** Soft diary decoration when a sticker is equipped from the collection. */
export function DiarySticker({ className = "" }: { className?: string }) {
  const [key, setKey] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setKey(getEquippedStickerKey());
    void hydrateEquippedStickerFromAccount().then(setKey);
    return subscribeEquippedSticker(setKey);
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const unsub = subscribeEquipPulse((detail) => {
      if (detail.kind !== "sticker") return;
      setPulse(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setPulse(false), EQUIP_PULSE_MS);
    }, "sticker");
    return () => {
      unsub();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  if (!key || !isStickerReward(key)) return null;
  const title = rewardDef(key)?.title ?? "Наклейка из коллекции";

  return (
    <span
      className={`diary-sticker inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-sm ring-1 ring-[var(--accent-ink)]/12 ${
        pulse ? "diary-sticker--pulse" : ""
      } ${className}`.trim()}
      title={title}
      data-cv-sticker={key}
    >
      <RewardArt rewardKey={key} size={22} title={title} />
    </span>
  );
}
