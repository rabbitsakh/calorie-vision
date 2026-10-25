/**
 * Chests 2.0 — single active meter + ready queue derived from quest days
 * and milestone bonus chests (C3).
 * Keeps existing `quest-day:*` / `quest-chest:{n}` sourceKeys.
 */

import {
  mergeReadyQueue,
  readyQueueDockCopy,
  type ReadyChestItem,
} from "@/lib/chest-ready-queue";
import { nextMetaProgress, QUEST_DAYS_PER_CHEST } from "@/lib/rewards";
import { pluralDays } from "@/lib/russian-text";

export type ChestMeterState = "empty" | "filling" | "ready";

export type ChestMeterModel = {
  state: ChestMeterState;
  /** Days filled in the current cycle (0..per). Ready → per when quest drives ready. */
  filled: number;
  per: number;
  /** Calm days until quest ready (0 when quest or bonus ready). */
  nextIn: number;
  /** Items waiting to open (quest + milestones). */
  readyCount: number;
  label: string;
  detail: string;
  metaLabel: string | null;
  /** Primary dock action. */
  cta: "open" | "none";
  /** FIFO ready queue — head is next «Открыть». */
  queue: ReadyChestItem[];
};

/**
 * Derive dock meter from quest-day markers vs opened quest-chest rows,
 * plus optional milestone queue (streak / week / challenge).
 *
 * Pass either `bonusQueue` (milestones only) or a full `queue` (already merged).
 */
export function buildChestMeter(input: {
  questDayCount: number;
  openedQuestChests: number;
  questDaysPerChest?: number;
  ownedCount?: number | null;
  /** Milestone items only — quest head is prepended. */
  bonusQueue?: ReadyChestItem[];
  /** Full FIFO queue (skips merge). */
  queue?: ReadyChestItem[];
}): ChestMeterModel {
  const per = Math.max(1, input.questDaysPerChest ?? QUEST_DAYS_PER_CHEST);
  const days = Math.max(0, Math.floor(input.questDayCount) || 0);
  const opened = Math.max(0, Math.floor(input.openedQuestChests) || 0);
  const earned = Math.floor(days / per);
  const questReadyCount = Math.max(0, earned - opened);
  const remainder = days % per;

  const meta =
    input.ownedCount != null && Number.isFinite(input.ownedCount)
      ? nextMetaProgress(Math.max(0, Math.floor(input.ownedCount)))
      : null;
  const metaLabel = meta
    ? meta.remaining <= 2
      ? meta.label
      : `мета ${meta.current}/${meta.target}`
    : null;

  const finalQueue =
    input.queue ??
    mergeReadyQueue({
      questReadyCount,
      streak: (input.bonusQueue ?? []).filter((i) => i.source === "streak"),
      week: (input.bonusQueue ?? []).find((i) => i.source === "week") ?? null,
      challenge: (input.bonusQueue ?? []).filter((i) => i.source === "challenge"),
      referral: (input.bonusQueue ?? []).filter((i) => i.source === "referral"),
    });

  if (finalQueue.length > 0) {
    const copy = readyQueueDockCopy(finalQueue);
    return {
      state: "ready",
      filled: questReadyCount > 0 ? per : remainder === 0 ? 0 : remainder,
      per,
      nextIn: 0,
      readyCount: copy.readyCount,
      label: copy.label,
      detail: copy.detail,
      metaLabel,
      cta: "open",
      queue: finalQueue,
    };
  }

  if (days === 0) {
    return {
      state: "empty",
      filled: 0,
      per,
      nextIn: per,
      readyCount: 0,
      label: "Сундук",
      detail: `Еда + вода · ${per} ${pluralDays(per)}`,
      metaLabel,
      cta: "none",
      queue: [],
    };
  }

  const nextIn = remainder === 0 ? per : per - remainder;
  const filled = remainder === 0 ? 0 : remainder;

  if (nextIn === 1) {
    return {
      state: "filling",
      filled,
      per,
      nextIn: 1,
      readyCount: 0,
      label: "Сундук · почти",
      detail: "Закрой сегодня — еда и вода",
      metaLabel,
      cta: "none",
      queue: [],
    };
  }

  return {
    state: "filling",
    filled,
    per,
    nextIn,
    readyCount: 0,
    label: "Сундук",
    detail: `Ещё ${nextIn} ${pluralDays(nextIn)} спокойствия`,
    metaLabel,
    cta: "none",
    queue: [],
  };
}

/** Next quest-chest batch index to grant (1-based), or null if nothing ready. */
export function nextQuestChestBatchIndex(
  questDayCount: number,
  openedQuestChests: number,
  questDaysPerChest = QUEST_DAYS_PER_CHEST,
): number | null {
  const per = Math.max(1, questDaysPerChest);
  const earned = Math.floor(Math.max(0, questDayCount) / per);
  const opened = Math.max(0, openedQuestChests);
  if (earned <= opened) return null;
  return opened + 1;
}
