"use client";

import { useEffect, useState, type ReactNode } from "react";
import { frameAvatarClass } from "@/lib/rewards";
import {
  getEquippedFrameKey,
  subscribeEquippedFrame,
} from "@/lib/equipped-frame";

type AvatarFrameProps = {
  className?: string;
  children: ReactNode;
};

/**
 * Soft cosmetic ring around avatar when a frame is equipped (wave 8).
 */
export function AvatarFrame({ className = "", children }: AvatarFrameProps) {
  const [frameKey, setFrameKey] = useState<string | null>(null);

  useEffect(() => {
    setFrameKey(getEquippedFrameKey());
    return subscribeEquippedFrame(setFrameKey);
  }, []);

  const frameClass = frameAvatarClass(frameKey);
  return <span className={`inline-flex shrink-0 ${frameClass} ${className}`.trim()}>{children}</span>;
}
