"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RewardArt } from "@/components/RewardArt";
import type { ChestMeterModel } from "@/lib/chest-progress";
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
import { cheerPhrase, frameAvatarClass, rewardDef } from "@/lib/rewards";

type WearSize = "md" | "lg";

/**
 * R5–R9 / R16 / C2 — equipped collection wear on gym surfaces.
 * Ready chest → cue back to ration (open lives on ChestDock).
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

  const phrase = cheerKey ? cheerPhrase(cheerKey) : null;
  const frameClass = frameAvatarClass(frameKey);
  if (!sticker && !phrase && !frameClass && !chestReady) return null;

  const avatar = size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const art = size === "lg" ? 30 : 24;
  const phraseClass =
    size === "lg"
      ? "text-sm font-medium leading-snug text-[var(--accent-ink)]"
      : "max-w-[9rem] truncate text-[11px] font-semibold text-[var(--accent-ink)]";
  const stickerTitle = sticker ? rewardDef(sticker)?.title ?? "Наклейка" : null;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`.trim()}>
      {chestReady ? (
        <Link
          href={withBasePath("/ration")}
          className="gym-chest-ready-cue"
          aria-label="Сундук готов — открыть на рационе"
        >
          Сундук готов · рацион
        </Link>
      ) : null}
      {sticker || phrase || frameClass ? (
        <Link
          href={withBasePath("/profile#rewards")}
          className={`flex flex-wrap items-center gap-2 ${pulse ? "gym-collection-wear--pulse" : ""}`.trim()}
          aria-label="Коллекция наград"
          title="Открыть коллекцию"
        >
          {sticker || frameClass ? (
            <span
              className={`inline-flex ${avatar} items-center justify-center rounded-full bg-[var(--accent-soft)] shadow-sm ${frameClass}`.trim()}
            >
              {sticker ? (
                <RewardArt
                  rewardKey={sticker}
                  size={art}
                  title={stickerTitle ?? "Наклейка из коллекции"}
                />
              ) : frameKey ? (
                <RewardArt rewardKey={frameKey} size={art} title="Рамка из коллекции" />
              ) : null}
            </span>
          ) : null}
          {phrase ? <p className={`max-w-[14rem] ${phraseClass}`}>{phrase}</p> : null}
        </Link>
      ) : null}
    </div>
  );
}
