import { withBasePath } from "@/lib/paths";
import type { ReminderKind } from "@/lib/push-reminder-schedule";
import type { MealType } from "@/types";

const MEAL_TYPES = new Set<MealType>(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);

/** Map reminder kind → meal deep-link query (when applicable). */
export function mealTypeForReminder(kind: ReminderKind): MealType | null {
  switch (kind) {
    case "breakfast":
      return "BREAKFAST";
    case "lunch":
      return "LUNCH";
    case "dinner":
      return "DINNER";
    default:
      return null;
  }
}

/** Ration deep link with optional meal preselect. */
export function rationMealLink(meal?: MealType | null): string {
  const base = withBasePath("/ration");
  return meal ? `${base}?meal=${meal}` : base;
}

/** Build client path for a push notification tap. */
export function reminderDeepLink(kind: ReminderKind): string {
  if (kind === "weekly" || kind === "calories") {
    return withBasePath("/stats");
  }
  const meal = mealTypeForReminder(kind);
  return rationMealLink(meal);
}

export function parseMealQueryParam(value: string | null | undefined): MealType | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return MEAL_TYPES.has(upper as MealType) ? (upper as MealType) : null;
}
