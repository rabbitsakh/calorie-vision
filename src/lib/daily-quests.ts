/**
 * Soft daily micro-quests (wave 4) — not a second weekly challenge.
 * Chest claim uses meal + water only; gym is a bonus strip credit.
 */

export type DailyQuestId = "log_meal" | "drink_water" | "gym_today";

export type DailyQuestDef = {
  id: DailyQuestId;
  title: string;
  doneHint: string;
  /** When true, quest does not block chest `allDone`. */
  bonus?: boolean;
};

export const DAILY_QUESTS: DailyQuestDef[] = [
  {
    id: "log_meal",
    title: "Записать приём",
    doneHint: "Есть запись в дневнике",
  },
  {
    id: "drink_water",
    title: "Дойти по воде",
    doneHint: "Норма воды за день",
  },
  {
    id: "gym_today",
    title: "Зал сегодня",
    doneHint: "Есть тренировка",
    bonus: true,
  },
];

export type DailyQuestProgress = {
  id: DailyQuestId;
  title: string;
  done: boolean;
  doneHint: string;
  bonus?: boolean;
};

export function computeDailyQuests(input: {
  mealCount: number;
  waterMl: number;
  waterTarget: number;
  /** Finished / clocked sessions today — credits the bonus gym quest. */
  gymSessionCount?: number;
}): { quests: DailyQuestProgress[]; allDone: boolean } {
  const gymCount = Math.max(0, Number(input.gymSessionCount) || 0);
  const quests: DailyQuestProgress[] = DAILY_QUESTS.map((q) => {
    let done = false;
    if (q.id === "log_meal") {
      done = input.mealCount >= 1;
    } else if (q.id === "drink_water") {
      done = input.waterMl >= input.waterTarget && input.waterTarget > 0;
    } else if (q.id === "gym_today") {
      done = gymCount >= 1;
    }
    return {
      id: q.id,
      title: q.title,
      done,
      doneHint: q.doneHint,
      ...(q.bonus ? { bonus: true } : {}),
    };
  });
  const required = quests.filter((q) => !q.bonus);
  return { quests, allDone: required.every((q) => q.done) };
}
