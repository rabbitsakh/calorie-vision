/** Quiet-mode inbox toasts for chest grants (R1a / R2a). */

import { isFrameReward, isStickerReward } from "@/lib/rewards";

export type ChestInboxPayload = {
  title: string;
  subtitle?: string;
  /** Reward key for equip / collection CTA (R2). */
  rewardKey?: string;
};

export const CHEST_INBOX_EVENT = "cv-chest-inbox";

export type ChestInboxAction = "equip-sticker" | "equip-frame" | "collection";

export function chestInboxAction(rewardKey: string | undefined): ChestInboxAction {
  if (rewardKey && isStickerReward(rewardKey)) return "equip-sticker";
  if (rewardKey && isFrameReward(rewardKey)) return "equip-frame";
  return "collection";
}

export function notifyChestInbox(payload: ChestInboxPayload): void {
  if (typeof window === "undefined") return;
  if (!payload.title.trim()) return;
  window.dispatchEvent(new CustomEvent(CHEST_INBOX_EVENT, { detail: payload }));
}
