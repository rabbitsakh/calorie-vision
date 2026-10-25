"use client";

import { useEffect, useState, type ReactNode } from "react";
import { EQUIP_PULSE_MS, subscribeEquipPulse } from "@/lib/equip-pulse";
import {
  getEquippedFrameKey,
  hydrateEquippedFrameFromAccount,
  subscribeEquippedFrame,
} from "@/lib/equipped-frame";
import { frameAvatarClass } from "@/lib/rewards";

type AvatarFrameProps = {
  className?: string;
  children: ReactNode;
};

/**
 * Soft cosmetic ring around avatar when a frame is equipped.
 * C2 — brief equip pulse after «Надеть» / auto-equip.
 */
export function AvatarFrame({ className = "", children }: AvatarFrameProps) {
  const [frameKey, setFrameKey] = useState<string | null>(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    setFrameKey(getEquippedFrameKey());
    void hydrateEquippedFrameFromAccount().then(setFrameKey);
    return subscribeEquippedFrame(setFrameKey);
  }, []);

  useEffect(() => {
    let timer: number | undefined;
    const unsub = subscribeEquipPulse(() => {
      setPulse(true);
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => setPulse(false), EQUIP_PULSE_MS);
    }, "frame");
    return () => {
      unsub();
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const frameClass = frameAvatarClass(frameKey);
  return (
    <span
      className={`inline-flex shrink-0 ${frameClass} ${
        pulse ? "cv-avatar-frame--pulse" : ""
      } ${className}`.trim()}
      data-cv-frame={frameKey ?? undefined}
      title={frameKey ? "Рамка из коллекции" : undefined}
    >
      {children}
    </span>
  );
}
