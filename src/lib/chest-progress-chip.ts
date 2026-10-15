import { QUEST_DAYS_PER_CHEST } from "@/lib/rewards";
import { pluralDays } from "@/lib/russian-text";

export type ChestProgressChipModel = {
  label: string;
  /** Ration habits panel vs profile collection. */
  href: "habits" | "rewards";
  nextIn: number;
  filled: number;
  per: number;
};

/**
 * Soft chip copy for quest-chest progress (R1d / R2d).
 * After a chest lands (count % per === 0), next cycle needs a full `per` days.
 */
export function buildChestProgressChip(input: {
  questDayCount: number;
  questDaysPerChest?: number;
}): ChestProgressChipModel {
  const per = Math.max(1, input.questDaysPerChest ?? QUEST_DAYS_PER_CHEST);
  const count = Math.max(0, Math.floor(input.questDayCount) || 0);
  const remainder = count % per;
  const nextIn = remainder === 0 ? per : per - remainder;
  const filled = remainder;

  if (count === 0) {
    return {
      label: `Сундук · закрой ${per} ${pluralDays(per)}`,
      href: "habits",
      nextIn: per,
      filled: 0,
      per,
    };
  }

  if (nextIn === 1) {
    return {
      label: "Сундук · закрой день",
      href: "habits",
      nextIn: 1,
      filled,
      per,
    };
  }

  return {
    label: `Сундук · ещё ${nextIn} ${pluralDays(nextIn)}`,
    href: "rewards",
    nextIn,
    filled,
    per,
  };
}
