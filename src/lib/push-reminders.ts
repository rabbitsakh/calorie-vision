import type { PushPayload } from "@/lib/push";
import { withBasePath } from "@/lib/paths";
import { isGoalPace, isSex, isWeightGoal, recommendDiet } from "@/lib/diet";
import { computeStreakFromSet, shiftDateKeyUtc, weekStartMonday } from "@/lib/streak-utils";
import {
  REMINDER_SCHEDULE,
  type ReminderKind,
} from "@/lib/push-reminder-schedule";

export { REMINDER_SCHEDULE, reminderKindLabel, type ReminderKind } from "@/lib/push-reminder-schedule";

export { WATER_DAILY_TARGET_ML } from "@/lib/water-target";
import { WATER_DAILY_TARGET_ML } from "@/lib/water-target";

export const DEFAULT_PUSH_TIMEZONE = "Europe/Moscow";

export type UserReminderContext = {
  today: string;
  mealCount: number;
  totalCalories: number;
  calorieTarget: number | null;
  waterMl: number;
  streak: number;
  streakBeforeToday: number;
  loggedToday: boolean;
  mood: number | null;
  hasBreakfast: boolean;
  hasLunch: boolean;
  hasDinner: boolean;
  daysLoggedLastWeek: number;
  daysInLastWeek: number;
};

export function resolvePushTimezone(timezone: string | null | undefined): string {
  const trimmed = timezone?.trim();
  if (!trimmed) return DEFAULT_PUSH_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: trimmed });
    return trimmed;
  } catch {
    return DEFAULT_PUSH_TIMEZONE;
  }
}

export function localHour(timezone: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    hour12: false,
    timeZone: timezone,
  }).formatToParts(now);
  const raw = Number(parts.find((p) => p.type === "hour")?.value ?? "12");
  // Some engines still emit 24 at midnight; normalize to 0–23.
  if (!Number.isFinite(raw)) return 12;
  if (raw === 24) return 0;
  return Math.min(23, Math.max(0, Math.trunc(raw)));
}

/** 0 = Sunday … 6 = Saturday in the given timezone. */
export function localWeekday(timezone: string, now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone,
  }).formatToParts(now);
  const short = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[short] ?? 1;
}

export function remindersForLocalTime(hour: number, weekday: number): ReminderKind[] {
  return REMINDER_SCHEDULE.filter((slot) => {
    if (slot.hour !== hour) return false;
    if (slot.weekday != null && slot.weekday !== weekday) return false;
    return true;
  }).map((slot) => slot.kind);
}

function pluralMeals(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "приём пищи";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "приёма пищи";
  return "приёмов пищи";
}

function waterProgressLine(waterMl: number): string {
  const pct = Math.round((waterMl / WATER_DAILY_TARGET_ML) * 100);
  return `${waterMl} мл из ${WATER_DAILY_TARGET_ML} (${pct}%)`;
}

export function computeCalorieTarget(input: {
  goal: string | null | undefined;
  goalPace: string | null | undefined;
  sex: string | null | undefined;
  latestWeightKg: number | null | undefined;
}): number | null {
  if (!isWeightGoal(input.goal) || input.latestWeightKg == null) return null;
  const pace = isGoalPace(input.goalPace) ? input.goalPace : null;
  const sex = isSex(input.sex) ? input.sex : null;
  return recommendDiet(input.latestWeightKg, input.goal, pace, sex).calories;
}

export function computeStreakStats(mealDates: string[], frozenDates: string[], today: string) {
  const dateSet = new Set([...mealDates, ...frozenDates]);
  const loggedToday = dateSet.has(today);
  const yesterday = shiftDateKeyUtc(today, -1);
  const streakBeforeToday = computeStreakFromSet(dateSet, yesterday);
  const streak = loggedToday ? computeStreakFromSet(dateSet, today) : streakBeforeToday;
  return { loggedToday, streak, streakBeforeToday };
}

export function computeLastWeekStats(
  mealDates: string[],
  today: string,
  timezone: string | null | undefined,
): { daysLoggedLastWeek: number; daysInLastWeek: number } {
  const weekStart = weekStartMonday(today, timezone);
  const lastWeekEnd = shiftDateKeyUtc(weekStart, -1);
  const lastWeekStart = shiftDateKeyUtc(weekStart, -7);
  const mealSet = new Set(mealDates);
  let daysLoggedLastWeek = 0;
  for (let i = 0; i < 7; i += 1) {
    const date = shiftDateKeyUtc(lastWeekStart, i);
    if (date > lastWeekEnd) break;
    if (mealSet.has(date)) daysLoggedLastWeek += 1;
  }
  return { daysLoggedLastWeek, daysInLastWeek: 7 };
}

export function buildReminderPayload(
  kind: ReminderKind,
  ctx: UserReminderContext,
): PushPayload | null {
  const rationUrl = withBasePath("/ration");
  const statsUrl = withBasePath("/stats");

  switch (kind) {
    case "breakfast":
      if (ctx.mealCount > 0 || ctx.hasBreakfast) return null;
      return {
        title: "Доброе утро!",
        body:
          ctx.streakBeforeToday >= 3
            ? `Серия ${ctx.streakBeforeToday} дн. — запишите завтрак, чтобы сохранить её.`
            : "Первая запись дня — завтрак. Это занимает меньше минуты.",
        url: rationUrl,
        tag: "cv-breakfast",
      };

    case "lunch":
      if (ctx.hasLunch) return null;
      if (ctx.mealCount === 0) {
        return {
          title: "Обед без записей",
          body: "Сегодня ещё нет приёмов пищи — добавьте хотя бы обед.",
          url: rationUrl,
          tag: "cv-lunch",
        };
      }
      return {
        title: "Время обеда",
        body:
          ctx.totalCalories > 0
            ? `Уже ${ctx.totalCalories} ккал — не забудьте записать обед.`
            : "Запишите обед, пока помните состав и порцию.",
        url: rationUrl,
        tag: "cv-lunch",
      };

    case "water_midday":
      if (ctx.waterMl >= WATER_DAILY_TARGET_ML / 2) return null;
      return {
        title: "Стакан воды?",
        body: `${waterProgressLine(ctx.waterMl)}. До половины цели ~${WATER_DAILY_TARGET_ML / 2 - ctx.waterMl} мл.`,
        url: rationUrl,
        tag: "cv-water-mid",
      };

    case "water_evening":
      if (ctx.waterMl >= WATER_DAILY_TARGET_ML) return null;
      return {
        title: "Вечерняя вода",
        body: `${waterProgressLine(ctx.waterMl)}. До цели ещё ${WATER_DAILY_TARGET_ML - ctx.waterMl} мл.`,
        url: rationUrl,
        tag: "cv-water-eve",
      };

    case "calories":
      if (ctx.mealCount === 0) return null;
      if (ctx.calorieTarget) {
        const pct = Math.round((ctx.totalCalories / ctx.calorieTarget) * 100);
        const left = ctx.calorieTarget - ctx.totalCalories;
        if (left > ctx.calorieTarget * 0.15) {
          return {
            title: "Сводка за день",
            body: `${ctx.totalCalories} / ${ctx.calorieTarget} ккал (${pct}%). Осталось ~${left} ккал.`,
            url: statsUrl,
            tag: "cv-calories",
          };
        }
        if (ctx.totalCalories > ctx.calorieTarget * 1.1) {
          return {
            title: "Сводка за день",
            body: `${ctx.totalCalories} ккал — выше цели ${ctx.calorieTarget} на ${ctx.totalCalories - ctx.calorieTarget} ккал.`,
            url: statsUrl,
            tag: "cv-calories",
          };
        }
        return {
          title: "Вы в цели!",
          body: `${ctx.totalCalories} / ${ctx.calorieTarget} ккал (${pct}%) — хороший баланс на сегодня.`,
          url: statsUrl,
          tag: "cv-calories",
        };
      }
      return {
        title: "Сводка за день",
        body: `${ctx.mealCount} ${pluralMeals(ctx.mealCount)}, ${ctx.totalCalories} ккал. Запишите ужин, если ещё не добавили.`,
        url: rationUrl,
        tag: "cv-calories",
      };

    case "streak":
      if (ctx.loggedToday) {
        if (ctx.streak >= 7 && ctx.streak % 7 === 0) {
          return {
            title: `Серия ${ctx.streak} дней!`,
            body: "Сегодня уже есть запись — отличная регулярность.",
            url: rationUrl,
            tag: "cv-streak",
          };
        }
        return null;
      }
      if (ctx.streakBeforeToday >= 1) {
        return {
          title: `Серия ${ctx.streakBeforeToday} дн. под угрозой`,
          body: "Сегодня ещё нет записей — добавьте хотя бы один приём пищи до полуночи.",
          url: rationUrl,
          tag: "cv-streak",
        };
      }
      return {
        title: "Откройте день записью",
        body: "Одна отметка — и день уже «открыт». Это занимает меньше минуты.",
        url: rationUrl,
        tag: "cv-streak",
      };

    case "checkin":
      if (ctx.mood != null) return null;
      return {
        title: "Как прошёл день?",
        body:
          ctx.mealCount > 0
            ? `${ctx.mealCount} ${pluralMeals(ctx.mealCount)}, ${ctx.totalCalories} ккал — отметьте настроение в дневнике.`
            : "Три кнопки: норм, перебрал или не записывал — без оценок.",
        url: rationUrl,
        tag: "cv-checkin",
      };

    case "weekly":
      if (ctx.daysLoggedLastWeek >= 5) return null;
      return {
        title: "Итог прошлой недели",
        body: `${ctx.daysLoggedLastWeek} из ${ctx.daysInLastWeek} дней с записями. Новая неделя — хороший момент начать с чистого листа.`,
        url: statsUrl,
        tag: "cv-weekly",
      };

    default:
      return null;
  }
}
