import { nextMetaProgress, QUEST_DAYS_PER_CHEST } from "@/lib/rewards";
import { pluralDays } from "@/lib/russian-text";

export type ChestProgressChipModel = {
  label: string;
  /** Optional meta collection progress (R3c). */
  metaLabel: string | null;
  /** Ration habits panel vs profile collection. */
  href: "habits" | "rewards";
  nextIn: number;
  filled: number;
  per: number;
};

function withMeta(
  base: Omit<ChestProgressChipModel, "metaLabel">,
  ownedCount?: number | null,
): ChestProgressChipModel {
  const meta =
    ownedCount != null && Number.isFinite(ownedCount)
      ? nextMetaProgress(Math.max(0, Math.floor(ownedCount)))
      : null;
  return {
    ...base,
    metaLabel: meta ? `мета ${meta.current}/${meta.target}` : null,
  };
}

/**
 * Soft chip copy for quest-chest progress (R1d / R2d / R3c).
 * After a chest lands (count % per === 0), next cycle needs a full `per` days.
 */
export function buildChestProgressChip(input: {
  questDayCount: number;
  questDaysPerChest?: number;
  /** Unique owned cosmetics — drives meta line. */
  ownedCount?: number | null;
}): ChestProgressChipModel {
  const per = Math.max(1, input.questDaysPerChest ?? QUEST_DAYS_PER_CHEST);
  const count = Math.max(0, Math.floor(input.questDayCount) || 0);
  const remainder = count % per;
  const nextIn = remainder === 0 ? per : per - remainder;
  const filled = remainder;
  const owned = input.ownedCount;

  if (count === 0) {
    return withMeta(
      {
        label: `Сундук · закрой ${per} ${pluralDays(per)}`,
        href: "habits",
        nextIn: per,
        filled: 0,
        per,
      },
      owned,
    );
  }

  if (nextIn === 1) {
    return withMeta(
      {
        label: "Сундук · закрой день",
        href: "habits",
        nextIn: 1,
        filled,
        per,
      },
      owned,
    );
  }

  return withMeta(
    {
      label: `Сундук · ещё ${nextIn} ${pluralDays(nextIn)}`,
      href: "rewards",
      nextIn,
      filled,
      per,
    },
    owned,
  );
}
