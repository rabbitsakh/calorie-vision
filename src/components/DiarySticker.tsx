"use client";

import { useEffect, useState } from "react";
import {
  getEquippedStickerKey,
  subscribeEquippedSticker,
} from "@/lib/equipped-sticker";
import { stickerGlyph } from "@/lib/rewards";

/** Soft diary decoration when a sticker is equipped from the collection. */
export function DiarySticker({ className = "" }: { className?: string }) {
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    setKey(getEquippedStickerKey());
    return subscribeEquippedSticker(setKey);
  }, []);

  const glyph = stickerGlyph(key);
  if (!glyph) return null;

  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-sm shadow-sm ring-1 ring-teal-900/5 ${className}`.trim()}
      title="Наклейка из коллекции"
      aria-hidden
    >
      {glyph}
    </span>
  );
}
