/**
 * Тренировка изменилась — кэш дня больше не правда.
 * Следующее открытие «Сегодня» считает норму и воду заново, без ручной правки базы.
 */

import { invalidateRationDayCache } from "@/lib/ration-day-cache";

export const WORKOUT_DAY_CHANGED_EVENT = "cv-workout-day-changed";

export function notifyWorkoutDayChanged(date: string | null | undefined): void {
  if (!date) return;
  invalidateRationDayCache(date);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WORKOUT_DAY_CHANGED_EVENT, { detail: { date } }));
}
