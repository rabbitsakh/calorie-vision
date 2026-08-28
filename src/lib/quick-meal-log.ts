import { dateKeyAndTimeToIso, toTimeInputValue } from "@/lib/dates";
import { hourInTimezone, inferMealTypeFromHour } from "@/lib/meal-type";
import type { MealType } from "@/types";

/** Infer meal slot + eatenAt for one-tap logging on `selectedDate`. */
export function buildQuickMealLogExtras(
  selectedDate: string,
  timezone?: string | null,
): { mealType: MealType; eatenAt?: string } {
  const now = new Date();
  const mealType = inferMealTypeFromHour(hourInTimezone(now, timezone));
  const eatenAt = dateKeyAndTimeToIso(selectedDate, toTimeInputValue(now, timezone), timezone);
  return { mealType, eatenAt: eatenAt ?? undefined };
}
