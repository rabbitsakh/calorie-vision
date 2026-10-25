/**
 * Chests 2.0 C3 — unified ready queue (quest + milestones), FIFO.
 */

import type { ChestSource } from "@/lib/rewards";
import { pluralDays } from "@/lib/russian-text";

/** Sources that can sit in the dock ready queue (meta flushes after open). */
export type ReadyChestSource = Exclude<ChestSource, "meta">;

export type ReadyChestItem = {
  source: ReadyChestSource;
  sourceKey: string;
  label: string;
  detail: string;
  milestone?: number;
  weekStart?: string;
  challengeKey?: string;
};

export function questReadyItem(readyCount: number): ReadyChestItem | null {
  if (readyCount <= 0) return null;
  return {
    source: "quest",
    sourceKey: "quest-chest:next",
    label: readyCount > 1 ? `Сундук готов · ${readyCount}` : "Сундук готов",
    detail: "Открой — награда в коллекцию",
  };
}

export function streakReadyItem(milestone: number): ReadyChestItem {
  return {
    source: "streak",
    sourceKey: `streak:${milestone}`,
    label: `Серия · ${milestone}`,
    detail: `${milestone} ${pluralDays(milestone)} подряд — открой сундук`,
    milestone,
  };
}

export function weekReadyItem(weekStart: string): ReadyChestItem {
  return {
    source: "week",
    sourceKey: `week:${weekStart}`,
    label: "Спокойная неделя",
    detail: "Неделя закрыта — открой сундук",
    weekStart,
  };
}

export function challengeReadyItem(
  weekStart: string,
  challengeKey: string,
  title?: string,
): ReadyChestItem {
  return {
    source: "challenge",
    sourceKey: `challenge:${weekStart}:${challengeKey}`,
    label: title?.trim() ? `Челлендж · ${title.trim()}` : "Челлендж",
    detail: "Неделя в копилку — открой сундук",
    weekStart,
    challengeKey,
  };
}

export function referralReadyItem(sourceKey: string, rewardTitle?: string): ReadyChestItem {
  return {
    source: "referral",
    sourceKey,
    label: "Друг присоединился",
    detail: rewardTitle?.trim()
      ? `В коллекции: ${rewardTitle.trim()} — открой`
      : "Награда за приглашение — открой",
  };
}

/**
 * Merge quest head + bonus milestones into one FIFO queue.
 * Quest batches always come first (daily loop), then streak → week → challenge → referral.
 */
export function mergeReadyQueue(input: {
  questReadyCount: number;
  streak?: ReadyChestItem[];
  week?: ReadyChestItem | null;
  challenge?: ReadyChestItem[];
  referral?: ReadyChestItem[];
}): ReadyChestItem[] {
  const queue: ReadyChestItem[] = [];
  const quest = questReadyItem(input.questReadyCount);
  if (quest) queue.push(quest);
  if (input.streak?.length) queue.push(...input.streak);
  if (input.week) queue.push(input.week);
  if (input.challenge?.length) queue.push(...input.challenge);
  if (input.referral?.length) queue.push(...input.referral);
  return queue;
}

/** Dock copy from the head of the queue. */
export function readyQueueDockCopy(queue: ReadyChestItem[]): {
  label: string;
  detail: string;
  readyCount: number;
} {
  const head = queue[0];
  if (!head) {
    return { label: "Сундук", detail: "", readyCount: 0 };
  }
  const extra = queue.length > 1 ? ` · ещё ${queue.length - 1}` : "";
  return {
    label: `${head.label}${extra}`,
    detail: head.detail,
    readyCount: queue.length,
  };
}
