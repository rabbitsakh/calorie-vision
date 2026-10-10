/**
 * Soft empty day shell when offline and no localStorage cache for the date.
 * Lets the ration UI render (hero/feed) instead of a hard error card.
 */

import type { RationDayPayload } from "@/components/RationDayProvider";

export function buildEmptyOfflineRationDay(
  date: string,
  today: string,
): RationDayPayload {
  return {
    date,
    today,
    meals: {
      entries: [],
      totalCalories: 0,
      totalProtein: 0,
      totalFat: 0,
      totalCarbs: 0,
      totalFiber: 0,
      totalSugar: 0,
      goal: null,
      goalPace: null,
      dietLabel: null,
      sex: null,
      weightKg: null,
      target: null,
      comparison: null,
      calorieTone: null,
    },
    streak: {
      streak: 0,
      longestStreak: 0,
      nextMilestone: 3,
      daysUntilNext: 3,
      last14: [],
      daysLoggedTotal: 0,
      loggedToday: false,
      streakAtRisk: false,
      streakBeforeToday: 0,
      freezeAvailable: false,
      canFreezeYesterday: false,
      frozenDates: [],
      weekStart: date,
      daysLoggedThisWeek: 0,
      daysInWeekSoFar: 1,
      weekNudge: null,
    },
    water: { totalMl: 0, target: 2000 },
    account: {
      sex: null,
      heightCm: null,
      birthYear: null,
      fastingStartHour: null,
      fastingEndHour: null,
      timezone: null,
      waterTargetMl: null,
      fiberTargetG: null,
      sugarTargetG: null,
    },
    week: { days: [{ date, calories: 0 }], calorieTarget: null },
    weightKg: null,
    tip: null,
    diaryMood: null,
    challenges: { active: null },
  };
}
