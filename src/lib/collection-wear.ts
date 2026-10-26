/**
 * Pure model for gym / DayHero collection wear chrome.
 * Cheer alone must still produce a visible art key (not only a text phrase).
 */

import { cheerPhrase, frameAvatarClass, rewardDef } from "@/lib/rewards";

export type CollectionWearModel = {
  visible: boolean;
  /** Primary art in the badge: sticker → cheer → frame. */
  artKey: string | null;
  artTitle: string;
  stickerKey: string | null;
  cheerKey: string | null;
  frameKey: string | null;
  frameClass: string;
  phrase: string | null;
  chestReady: boolean;
  hasBadge: boolean;
};

export function collectionWearModel(input: {
  sticker?: string | null;
  cheerKey?: string | null;
  frameKey?: string | null;
  chestReady?: boolean;
}): CollectionWearModel {
  const stickerKey = input.sticker?.trim() || null;
  const cheerKey = input.cheerKey?.trim() || null;
  const frameKey = input.frameKey?.trim() || null;
  const chestReady = Boolean(input.chestReady);
  const phrase = cheerKey ? cheerPhrase(cheerKey) : null;
  const frameClass = frameAvatarClass(frameKey) || "";

  let artKey: string | null = null;
  let artTitle = "Награда из коллекции";
  if (stickerKey) {
    artKey = stickerKey;
    artTitle = rewardDef(stickerKey)?.title ?? "Наклейка из коллекции";
  } else if (cheerKey) {
    artKey = cheerKey;
    artTitle = phrase ?? rewardDef(cheerKey)?.title ?? "Фраза из коллекции";
  } else if (frameKey) {
    artKey = frameKey;
    artTitle = rewardDef(frameKey)?.title ?? "Рамка из коллекции";
  }

  const hasBadge = Boolean(artKey || phrase || frameClass);
  return {
    visible: hasBadge || chestReady,
    artKey,
    artTitle,
    stickerKey,
    cheerKey,
    frameKey,
    frameClass,
    phrase,
    chestReady,
    hasBadge,
  };
}
