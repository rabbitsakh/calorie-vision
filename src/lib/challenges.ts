import { WATER_HABIT_DAY_ML } from "@/lib/water-target";

export type ChallengeDef = {
  key: string;
  title: string;
  description: string;
  target: number;
};

export const CHALLENGE_DEFS: ChallengeDef[] = [
  {
    key: "breakfast_7",
    title: "Завтрак каждый день",
    description: "Запишите завтрак 7 дней подряд на этой неделе",
    target: 7,
  },
  {
    key: "water_5",
    title: "Пять дней с водой",
    description: `≥${WATER_HABIT_DAY_ML} мл воды в 5 днях этой недели`,
    target: 5,
  },
  {
    key: "log_5",
    title: "Пять дней дневника",
    description: "Любые записи еды в 5 днях этой недели",
    target: 5,
  },
];

export function challengeDef(key: string): ChallengeDef | undefined {
  return CHALLENGE_DEFS.find((c) => c.key === key);
}

/** Timezone-aware Monday YYYY-MM-DD (re-exported from streak-utils). */
export { weekStartMonday } from "@/lib/streak-utils";
