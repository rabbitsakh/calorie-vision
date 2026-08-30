/**
 * Soft daily micro-quests (wave 4) — not a second weekly challenge.
 */

export type DailyQuestId = "log_meal" | "drink_water";

export type DailyQuestDef = {
  id: DailyQuestId;
  title: string;
  doneHint: string;
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
];

export type DailyQuestProgress = {
  id: DailyQuestId;
  title: string;
  done: boolean;
  doneHint: string;
};

export function computeDailyQuests(input: {
  mealCount: number;
  waterMl: number;
  waterTarget: number;
}): { quests: DailyQuestProgress[]; allDone: boolean } {
  const quests: DailyQuestProgress[] = DAILY_QUESTS.map((q) => {
    const done =
      q.id === "log_meal"
        ? input.mealCount >= 1
        : input.waterMl >= input.waterTarget && input.waterTarget > 0;
    return { id: q.id, title: q.title, done, doneHint: q.doneHint };
  });
  return { quests, allDone: quests.every((q) => q.done) };
}
