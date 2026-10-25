/**
 * Legacy chip adapter — prefer {@link buildChestMeter} / ChestDock (chests 2.0).
 */

import { buildChestMeter } from "@/lib/chest-progress";
import { QUEST_DAYS_PER_CHEST } from "@/lib/rewards";
import { pluralDays } from "@/lib/russian-text";

export type ChestProgressChipModel = {
  label: string;
  metaLabel: string | null;
  href: "habits" | "rewards";
  nextIn: number;
  filled: number;
  per: number;
};

/**
 * Soft chip copy for quest-chest progress.
 * After a chest is earned but unopened, label points at open (ready).
 */
export function buildChestProgressChip(input: {
  questDayCount: number;
  questDaysPerChest?: number;
  ownedCount?: number | null;
  /** Opened quest-chest rows; default assumes auto-grant era (caught up). */
  openedQuestChests?: number;
}): ChestProgressChipModel {
  const per = Math.max(1, input.questDaysPerChest ?? QUEST_DAYS_PER_CHEST);
  const days = Math.max(0, Math.floor(input.questDayCount) || 0);
  const opened =
    input.openedQuestChests != null
      ? Math.max(0, Math.floor(input.openedQuestChests) || 0)
      : Math.floor(days / per);

  const meter = buildChestMeter({
    questDayCount: days,
    openedQuestChests: opened,
    questDaysPerChest: per,
    ownedCount: input.ownedCount,
  });

  if (meter.state === "ready") {
    return {
      label: meter.label,
      metaLabel: meter.metaLabel,
      href: "habits",
      nextIn: 0,
      filled: meter.filled,
      per: meter.per,
    };
  }

  const label =
    meter.state === "empty"
      ? `Сундук · сегодня · ${meter.per} ${pluralDays(meter.per)}`
      : meter.nextIn === 1
        ? "Сундук · закрой сегодня"
        : `Сундук · сегодня · ещё ${meter.nextIn} ${pluralDays(meter.nextIn)}`;

  return {
    label,
    metaLabel: meter.metaLabel,
    href: "habits",
    nextIn: meter.nextIn,
    filled: meter.filled,
    per: meter.per,
  };
}
