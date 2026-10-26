"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RewardArt } from "@/components/RewardArt";
import type { ChestMeterModel } from "@/lib/chest-progress";
import { collectionWearModel } from "@/lib/collection-wear";
import { EQUIP_PULSE_MS, subscribeEquipPulse } from "@/lib/equip-pulse";
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

type WearSize = "md" | "lg";
type WearTone = "light" | "stage";

/**
 * R5–R9 / R16 / C2 — equipped collection wear on gym surfaces.
 * Ready chest → cue back to ration (open lives on ChestDock).
 * Cheer alone shows RewardArt (not only a text line).
 */
export function GymCollectionWear({
  className = "",
  size = "lg",
  tone = "light",
}: {
  className?: string;
  /** R16 — default larger so frame/sticker/cheer read on DayHero and gym. */
  size?: WearSize;
  /** Dark StageScreen / live stage — light text + soft wash. */
  tone?: WearTone;
}) {
  const [sticker, setSticker] = useState<string | null>(null);
  const [cheerKey, setCheerKey] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState<string | null>(null);
  const [chestReady, setChestReady] = useState(false);
  const [pulse, setPulse] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/rewards"), { cache: "no-store" });
        if (!resp.ok || cancelled) return;
        const data = (await resp.json()) as { chest?: ChestMeterModel };
        if (!cancelled) setChestReady(data.chest?.state === "ready");
      } catch {
        if (!cancelled) setChestReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const unsub = subscribeEquipPulse(() => {
      setPulse(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setPulse(false), EQUIP_PULSE_MS);
    });
    return () => {
      unsub();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const model = collectionWearModel({ sticker, cheerKey, frameKey, chestReady });
  if (!model.visible) return null;

  const stage = tone === "stage";
  const avatar = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const art = size === "lg" ? 30 : 24;
  const phraseClass = stage
    ? size === "lg"
      ? "text-sm font-medium leading-snug text-white/90"
      : "max-w-[9rem] truncate text-[11px] font-semibold text-white/85"
    : size === "lg"
      ? "text-sm font-medium leading-snug text-[var(--accent-ink)]"
      : "max-w-[9rem] truncate text-[11px] font-semibold text-[var(--accent-ink)]";
  const badgeWash = stage
    ? "bg-white/15 shadow-sm ring-1 ring-white/20"
    : "bg-[var(--accent-soft)] shadow-sm";

  return (
    <div
      className={`gym-collection-wear flex flex-col gap-1.5 ${stage ? "gym-collection-wear--stage" : ""} ${className}`.trim()}
    >
      {model.chestReady ? (
        <Link
          href={withBasePath("/ration")}
          className={`gym-chest-ready-cue ${stage ? "gym-chest-ready-cue--stage" : ""}`.trim()}
          aria-label="Сундук готов — открыть на рационе"
        >
          Сундук готов · рацион
        </Link>
      ) : null}
      {model.hasBadge ? (
        <Link
          href={withBasePath("/profile#rewards")}
          className={`flex flex-wrap items-center gap-2 ${pulse ? "gym-collection-wear--pulse" : ""}`.trim()}
          aria-label="Коллекция наград"
          title="Открыть коллекцию"
        >
          {model.artKey || model.frameClass ? (
            <span
              className={`inline-flex ${avatar} items-center justify-center rounded-full ${badgeWash} ${model.frameClass}`.trim()}
            >
              {model.artKey ? (
                <RewardArt
                  rewardKey={model.artKey}
                  size={art}
                  title={model.artTitle}
                />
              ) : null}
            </span>
          ) : null}
          {model.phrase ? (
            <p className={`max-w-[14rem] ${phraseClass}`}>{model.phrase}</p>
          ) : null}
        </Link>
      ) : null}
    </div>
  );
}
