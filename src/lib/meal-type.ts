import type { MealType } from "@/types";

/**
 * Infer meal slot from local hour (same bands as quick-add API).
 * 05–11 breakfast, 11–15 lunch, 17–22 dinner, else snack.
 */
export function inferMealTypeFromHour(hour: number): MealType {
  const h = Number.isFinite(hour) ? ((Math.floor(hour) % 24) + 24) % 24 : 12;
  if (h >= 5 && h < 11) return "BREAKFAST";
  if (h >= 11 && h < 15) return "LUNCH";
  if (h >= 17 && h < 22) return "DINNER";
  return "SNACK";
}

/** Hour 0–23 in an IANA timezone, or device local if tz missing/invalid. */
export function hourInTimezone(date: Date, timeZone?: string | null): number {
  if (!timeZone) {
    return date.getHours();
  }
  try {
    const raw = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone,
    }).format(date);
    const hour = Number(raw);
    return Number.isFinite(hour) ? hour % 24 : date.getHours();
  } catch {
    return date.getHours();
  }
}
