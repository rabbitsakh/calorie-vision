/**
 * Тестовые данные макета карточки «Сегодня».
 * Это реконструкция скриншота, не чтение дневника.
 * 514 ккал — Этуотер видимых БЖУ (38/38/5). Цель 2 511 = 514 + остаток 1 997.
 */

import { inferMealTypeFromHour } from "@/lib/meal-type";
import type { MealType } from "@/types";

export const FIXTURE_DATE = "2026-11-13";
export const FIXTURE_HOUR = 9;

/** Съедено по полям калорий, которым объясняется остаток 1 997. */
export const EATEN_KCAL = 514;
export const TARGET_KCAL = 2511;
export const REMAINING_KCAL = TARGET_KCAL - EATEN_KCAL;

export const PROTEIN = 38;
export const PROTEIN_TARGET = 221;
export const FAT = 38;
export const FAT_TARGET = 72;
export const CARBS = 5;
export const CARBS_TARGET = 148;

export const WATER_ML = 0;
export const WATER_TARGET_ML = 2000;
export const WATER_GLASS_ML = 250;

export type IdeaSlot = "breakfast" | "lunch" | "dinner" | "snack";

export type MockIdea = {
  name: string;
  calories: number;
  /** Когда блюдо уместно. Чебурек — не завтрак. */
  slots: IdeaSlot[];
};

/**
 * Три идеи со скриншота.
 * Окончание «сырников» на телефоне обрезано стилем; здесь полное имя,
 * чтобы на макете было видно перенос, а не многоточие.
 */
export const SCREEN_IDEAS: MockIdea[] = [
  { name: "Чебурек с индейкой", calories: 2130, slots: ["lunch", "dinner"] },
  { name: "Сырники льняные с клюквой", calories: 658, slots: ["breakfast"] },
  { name: "Протеин изолят (60 г)", calories: 240, slots: ["breakfast", "snack"] },
];

const SLOT_BY_MEAL: Record<MealType, IdeaSlot> = {
  BREAKFAST: "breakfast",
  LUNCH: "lunch",
  DINNER: "dinner",
  SNACK: "snack",
};

/** Правило макета: порция не больше остатка и слот совпадает с часом. */
export function ideasForMoment(ideas: readonly MockIdea[], remainingKcal: number, hour: number): MockIdea[] {
  const slot = SLOT_BY_MEAL[inferMealTypeFromHour(hour)];
  return ideas.filter(
    (idea) => idea.calories > 0 && idea.calories <= remainingKcal && idea.slots.includes(slot),
  );
}

export function formatKcal(value: number): string {
  return Math.round(value).toLocaleString("ru-RU");
}

/** Литры без обрезки стакана 250 мл до 0,3. */
export function formatWaterLiters(ml: number): string {
  const liters = Math.max(0, ml) / 1000;
  return liters.toLocaleString("ru-RU", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
}
