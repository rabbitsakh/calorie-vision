/**
 * Chests 2.0 — single active meter + ready queue derived from quest days.
 * Keeps existing `quest-day:*` / `quest-chest:{n}` sourceKeys.
 */

import { nextMetaProgress, QUEST_DAYS_PER_CHEST } from "@/lib/rewards";
import { pluralDays } from "@/lib/russian-text";

export type ChestMeterState = "empty" | "filling" | "ready";

export type ChestMeterModel = {
  state: ChestMeterState;
  /** Days filled in the current cycle (0..per). Ready → per. */
  filled: number;
  per: number;
  /** Calm days until ready (0 when ready). */
  nextIn: number;
  /** Unopened earned quest chests (usually 0 or 1). */
  readyCount: number;
  label: string;
  detail: string;
  metaLabel: string | null;
  /** Primary dock action. */
  cta: "open" | "none";
};

/**
 * Derive dock meter from quest-day markers vs opened quest-chest rows.
 */
export function buildChestMeter(input: {
  questDayCount: number;
  openedQuestChests: number;
  questDaysPerChest?: number;
  ownedCount?: number | null;
}): ChestMeterModel {
  const per = Math.max(1, input.questDaysPerChest ?? QUEST_DAYS_PER_CHEST);
  const days = Math.max(0, Math.floor(input.questDayCount) || 0);
  const opened = Math.max(0, Math.floor(input.openedQuestChests) || 0);
  const earned = Math.floor(days / per);
  const readyCount = Math.max(0, earned - opened);
  const remainder = days % per;

  const meta =
    input.ownedCount != null && Number.isFinite(input.ownedCount)
      ? nextMetaProgress(Math.max(0, Math.floor(input.ownedCount)))
      : null;
  // Queue cue on dock — same voice as profile meta hint.
  const metaLabel = meta
    ? meta.remaining <= 2
      ? meta.label
      : `мета ${meta.current}/${meta.target}`
    : null;

  if (readyCount > 0) {
    return {
      state: "ready",
      filled: per,
      per,
      nextIn: 0,
      readyCount,
      label: readyCount > 1 ? `Сундук готов · ${readyCount}` : "Сундук готов",
      detail: "Открой — награда в коллекцию",
      metaLabel,
      cta: "open",
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
