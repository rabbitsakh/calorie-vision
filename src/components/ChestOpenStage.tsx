"use client";

import { useEffect, useRef } from "react";
import type { RewardRarity } from "@/lib/rewards";

type ChestOpenStageProps = {
  rarity?: RewardRarity;
  /** Fires when the lid finishes opening — time for the chime. */
  onLidOpen?: () => void;
  /** Fires when the full open sequence is done. */
  onComplete?: () => void;
};

const LID_OPEN_MS = 680;
const REVEAL_MS = 1380;

/**
 * Chest shake → lid → glow (Duolingo-style loot moment).
 */
export function ChestOpenStage({ rarity = "common", onLidOpen, onComplete }: ChestOpenStageProps) {
  const firedLid = useRef(false);
  const firedDone = useRef(false);

  useEffect(() => {
    firedLid.current = false;
    firedDone.current = false;
    const lidTimer = window.setTimeout(() => {
      if (firedLid.current) return;
      firedLid.current = true;
      onLidOpen?.();
    }, LID_OPEN_MS);
    const doneTimer = window.setTimeout(() => {
      if (firedDone.current) return;
      firedDone.current = true;
      onComplete?.();
    }, REVEAL_MS);
    return () => {
      window.clearTimeout(lidTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onLidOpen, onComplete]);

  return (
    <div
      className={`fs-chest-stage fs-chest-rarity-${rarity}`}
      role="img"
      aria-label="Сундук открывается"
    >
      <div className="fs-chest-wrap">
        <div className="fs-chest-shadow" aria-hidden />
        <div className="fs-chest-body" aria-hidden>
          <span className="fs-chest-lock" />
          <span className="fs-chest-band" />
        </div>
        <div className="fs-chest-lid" aria-hidden>
          <span className="fs-chest-lid-rim" />
        </div>
        <div className="fs-chest-glow" aria-hidden />
        <div className="fs-chest-loot-beam" aria-hidden />
        <ul className="fs-chest-sparkles" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className={`fs-chest-sparkle fs-chest-sparkle-${i + 1}`} />
          ))}
        </ul>
      </div>
    </div>
  );
}
