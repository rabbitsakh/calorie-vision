/**
 * R3a — first cosmetic auto-equip when the matching slot is empty.
 */

import {
  getEquippedCheerKey,
  persistEquippedCheerKey,
} from "@/lib/equipped-cheer";
import {
  getEquippedFrameKey,
  persistEquippedFrameKey,
} from "@/lib/equipped-frame";
import {
  getEquippedStickerKey,
  persistEquippedStickerKey,
} from "@/lib/equipped-sticker";
import { isCheerReward, isFrameReward, isStickerReward } from "@/lib/rewards";

export type AutoEquipKind = "sticker" | "frame" | "cheer";

/**
 * If the user has nothing equipped in that slot, put the new reward on.
 * @returns which slot was filled, or null if skipped.
 */
export async function maybeAutoEquipReward(
  rewardKey: string | null | undefined,
): Promise<AutoEquipKind | null> {
  const key = rewardKey?.trim();
  if (!key) return null;

  if (isStickerReward(key) && !getEquippedStickerKey()) {
    await persistEquippedStickerKey(key);
    return "sticker";
  }
  if (isFrameReward(key) && !getEquippedFrameKey()) {
    await persistEquippedFrameKey(key);
    return "frame";
  }
  if (isCheerReward(key) && !getEquippedCheerKey()) {
    await persistEquippedCheerKey(key);
    return "cheer";
  }
  return null;
}
