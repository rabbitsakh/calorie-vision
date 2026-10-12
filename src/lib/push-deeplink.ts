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

/** AI assistant in week mode (digest → coach). */
export function assistantWeekLink(opts?: { prefill?: string }): string {
  const base = withBasePath("/assistant");
  const params = new URLSearchParams({ mode: "week" });
  if (opts?.prefill?.trim()) {
    params.set("q", opts.prefill.trim().slice(0, 400));
  }
  return `${base}?${params.toString()}`;
}

/** Gym hub deep link. */
export function workoutsDeepLink(): string {
  return withBasePath("/workouts");
}

/** Build client path for a push notification tap. */
export function reminderDeepLink(kind: ReminderKind): string {
  if (kind === "weekly") {
    // Wave E — land on week digest fold, not shopping.
    return `${withBasePath("/plan")}#week-digest`;
  }
  if (kind === "calories") {
    return withBasePath("/stats");
  }
  if (kind === "checkin") {
    return `${withBasePath("/ration")}#checkin`;
  }
  if (kind === "reactivation") {
    return assistantWeekLink({
      prefill: "Помоги спланировать неделю: рацион и 2–3 тренировки",
    });
  }
  if (kind === "gym") {
    return workoutsDeepLink();
  }
  const meal = mealTypeForReminder(kind);
  return rationMealLink(meal);
}

export function parseMealQueryParam(value: string | null | undefined): MealType | null {
  if (!value) return null;
  const upper = value.trim().toUpperCase();
  return MEAL_TYPES.has(upper as MealType) ? (upper as MealType) : null;
}
