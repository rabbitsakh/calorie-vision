import type { PushPayload } from "@/lib/push";
import { rationMealLink, reminderDeepLink } from "@/lib/push-deeplink";
import { recommendDietForProfile, type DietProfileFields } from "@/lib/diet";
import { computeStreakFromSet, shiftDateKeyUtc, weekStartMonday } from "@/lib/streak-utils";
import {
  REMINDER_SCHEDULE,
  effectiveReminderSchedule,
  type PushReminderPrefs,
  type ReminderKind,
} from "@/lib/push-reminder-schedule";

export {
  REMINDER_SCHEDULE,
  effectiveReminderSchedule,
  normalizePushReminderPrefs,
  parsePushReminderPrefs,
  reminderKindLabel,
  type PushReminderPrefs,
  type ReminderKind,
  type ReminderKindPref,
} from "@/lib/push-reminder-schedule";

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

export function remindersForLocalTime(
  hour: number,
  weekday: number,
  prefs?: PushReminderPrefs | null,
): ReminderKind[] {
  return effectiveReminderSchedule(prefs)
    .filter((slot) => {
      if (slot.hour !== hour) return false;
      if (slot.weekday != null && slot.weekday !== weekday) return false;
      return true;
    })
    .map((slot) => slot.kind);
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

export function computeCalorieTarget(
  input: DietProfileFields & { latestWeightKg: number | null | undefined },
): number | null {
  return recommendDietForProfile(input.latestWeightKg, input)?.calories ?? null;
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

/** A/B copy bucket for push reminder text. */
export type PushCopyVariant = "A" | "B";

/**
 * Stable A/B assignment from userId (+ reminder kind).
 * Same user always gets the same variant for a given kind across cron runs.
 */
export function pickPushCopyVariant(userId: string, kind: ReminderKind): PushCopyVariant {
  const key = `${userId}:${kind}`;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 2 === 0 ? "A" : "B";
}

export type BuildReminderOptions = {
  /** Prefer explicit variant in tests; otherwise derived from userId. */
  variant?: PushCopyVariant;
  /** Used to pick a stable A/B variant when `variant` is omitted. */
  userId?: string;
};

function resolveCopyVariant(
  kind: ReminderKind,
  options?: BuildReminderOptions,
): PushCopyVariant {
  if (options?.variant) return options.variant;
  if (options?.userId) return pickPushCopyVariant(options.userId, kind);
  return "A";
}

export function buildReminderPayload(
  kind: ReminderKind,
  ctx: UserReminderContext,
  options?: BuildReminderOptions,
): PushPayload | null {
  const rationUrl = reminderDeepLink(kind === "calories" ? "streak" : kind);
  const statsUrl = reminderDeepLink("weekly");
  const breakfastUrl = rationMealLink("BREAKFAST");
  const lunchUrl = rationMealLink("LUNCH");
  const dinnerUrl = rationMealLink("DINNER");
  const variant = resolveCopyVariant(kind, options);
  const isB = variant === "B";

  switch (kind) {
    case "breakfast":
      if (ctx.mealCount > 0 || ctx.hasBreakfast) return null;
      return {
        title: isB ? "Завтрак ждёт" : "Доброе утро!",
        body:
          ctx.streakBeforeToday >= 3
            ? isB
              ? `Не потеряйте серию ${ctx.streakBeforeToday} дн. — отметьте завтрак.`
              : `Серия ${ctx.streakBeforeToday} дн. — запишите завтрак, чтобы сохранить её.`
            : isB
              ? "Отметьте завтрак сейчас — потом вспомнить сложнее."
              : "Первая запись дня — завтрак. Это занимает меньше минуты.",
        url: breakfastUrl,
        tag: "cv-breakfast",
      };

    case "lunch":
      if (ctx.hasLunch) return null;
      if (ctx.mealCount === 0) {
        return {
          title: isB ? "Пора обедать" : "Обед без записей",
          body: isB
            ? "День пока пустой — добавьте обед, чтобы открыть дневник."
            : "Сегодня ещё нет приёмов пищи — добавьте хотя бы обед.",
          url: lunchUrl,
          tag: "cv-lunch",
        };
      }
      return {
        title: isB ? "Не забудьте обед" : "Время обеда",
        body:
          ctx.totalCalories > 0
            ? isB
              ? `Уже ${ctx.totalCalories} ккал за день — запишите обед, пока свежо.`
              : `Уже ${ctx.totalCalories} ккал — не забудьте записать обед.`
            : isB
              ? "Пара кликов — и обед в дневнике."
              : "Запишите обед, пока помните состав и порцию.",
        url: lunchUrl,
        tag: "cv-lunch",
      };

    case "dinner":
      if (ctx.hasDinner) return null;
      if (ctx.mealCount === 0) {
        return {
          title: isB ? "Ужин ещё впереди" : "Ужин без записей",
          body: isB
            ? "День пустой — отметьте ужин, чтобы открыть дневник."
            : "Сегодня ещё нет приёмов пищи — добавьте хотя бы ужин.",
          url: dinnerUrl,
          tag: "cv-dinner",
        };
      }
      return {
        title: isB ? "Не забудьте ужин" : "Время ужина",
        body:
          ctx.totalCalories > 0
            ? isB
              ? `Уже ${ctx.totalCalories} ккал — запишите ужин, пока помните.`
              : `Уже ${ctx.totalCalories} ккал за день — не забудьте ужин.`
            : isB
              ? "Пара кликов — и ужин в дневнике."
              : "Запишите ужин, пока помните состав и порцию.",
        url: dinnerUrl,
        tag: "cv-dinner",
      };

    case "water_midday":
      if (ctx.waterMl >= WATER_DAILY_TARGET_ML / 2) return null;
      return {
        title: isB ? "Напомните себе про воду" : "Стакан воды?",
        body: isB
          ? `${waterProgressLine(ctx.waterMl)}. До середины цели осталось ~${WATER_DAILY_TARGET_ML / 2 - ctx.waterMl} мл.`
          : `${waterProgressLine(ctx.waterMl)}. До половины цели ~${WATER_DAILY_TARGET_ML / 2 - ctx.waterMl} мл.`,
        url: rationUrl,
        tag: "cv-water-mid",
      };

    case "water_evening":
      if (ctx.waterMl >= WATER_DAILY_TARGET_ML) return null;
      return {
        title: isB ? "Допить до цели?" : "Вечерняя вода",
        body: isB
          ? `${waterProgressLine(ctx.waterMl)}. Ещё ${WATER_DAILY_TARGET_ML - ctx.waterMl} мл — и день по воде закрыт.`
          : `${waterProgressLine(ctx.waterMl)}. До цели ещё ${WATER_DAILY_TARGET_ML - ctx.waterMl} мл.`,
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
            title: isB ? "Калории за день" : "Сводка за день",
            body: isB
              ? `${ctx.totalCalories} из ${ctx.calorieTarget} ккал (${pct}%). Запас ~${left} ккал.`
              : `${ctx.totalCalories} / ${ctx.calorieTarget} ккал (${pct}%). Осталось ~${left} ккал.`,
            url: statsUrl,
            tag: "cv-calories",
          };
        }
        if (ctx.totalCalories > ctx.calorieTarget * 1.1) {
          return {
            title: isB ? "Выше цели на сегодня" : "Сводка за день",
            body: isB
              ? `${ctx.totalCalories} ккал при цели ${ctx.calorieTarget} (+${ctx.totalCalories - ctx.calorieTarget}).`
              : `${ctx.totalCalories} ккал — выше цели ${ctx.calorieTarget} на ${ctx.totalCalories - ctx.calorieTarget} ккал.`,
            url: statsUrl,
            tag: "cv-calories",
          };
        }
        return {
          title: isB ? "Цель по калориям закрыта" : "Вы в цели!",
          body: isB
            ? `${ctx.totalCalories} / ${ctx.calorieTarget} ккал (${pct}%) — день в балансе.`
            : `${ctx.totalCalories} / ${ctx.calorieTarget} ккал (${pct}%) — хороший баланс на сегодня.`,
          url: statsUrl,
          tag: "cv-calories",
        };
      }
      return {
        title: isB ? "Итог по еде" : "Сводка за день",
        body: isB
          ? `${ctx.mealCount} ${pluralMeals(ctx.mealCount)}, ${ctx.totalCalories} ккал. Ужин ещё можно добавить.`
          : `${ctx.mealCount} ${pluralMeals(ctx.mealCount)}, ${ctx.totalCalories} ккал. Запишите ужин, если ещё не добавили.`,
        url: dinnerUrl,
        tag: "cv-calories",
      };

    case "streak":
      if (ctx.loggedToday) {
        if (ctx.streak >= 7 && ctx.streak % 7 === 0) {
          return {
            title: isB ? `${ctx.streak} дней подряд!` : `Серия ${ctx.streak} дней!`,
            body: isB
              ? "Сегодня уже отмечено — так держать."
              : "Сегодня уже есть запись — отличная регулярность.",
            url: rationUrl,
            tag: "cv-streak",
          };
        }
        return null;
      }
      if (ctx.streakBeforeToday >= 1) {
        return {
          title: isB
            ? `Серия ${ctx.streakBeforeToday} дн. может оборваться`
            : `Серия ${ctx.streakBeforeToday} дн. под угрозой`,
          body: isB
            ? "До полуночи ещё есть время — одна запись сохранит серию."
            : "Сегодня ещё нет записей — добавьте хотя бы один приём пищи до полуночи.",
          url: rationUrl,
          tag: "cv-streak",
        };
      }
      return {
        title: isB ? "Одна запись — и день ваш" : "Откройте день записью",
        body: isB
          ? "Минута сейчас — и день уже засчитан."
          : "Одна отметка — и день уже «открыт». Это занимает меньше минуты.",
        url: rationUrl,
        tag: "cv-streak",
      };

    case "checkin":
      if (ctx.mood != null) return null;
      return {
        title: isB ? "Вечерний чек-ин" : "Как прошёл день?",
        body:
          ctx.mealCount > 0
            ? isB
              ? `Сегодня ${ctx.mealCount} ${pluralMeals(ctx.mealCount)} и ${ctx.totalCalories} ккал — как настроение?`
              : `${ctx.mealCount} ${pluralMeals(ctx.mealCount)}, ${ctx.totalCalories} ккал — отметьте настроение в дневнике.`
            : isB
              ? "Норм / перебрал / не записывал — три кнопки, без оценок."
              : "Три кнопки: норм, перебрал или не записывал — без оценок.",
        url: rationUrl,
        tag: "cv-checkin",
      };

    case "weekly":
      if (ctx.daysLoggedLastWeek >= 5) return null;
      return {
        title: isB ? "Неделя позади" : "Итог прошлой недели",
        body: isB
          ? `Записей: ${ctx.daysLoggedLastWeek} из ${ctx.daysInLastWeek} дней. Новая неделя — свежий старт.`
          : `${ctx.daysLoggedLastWeek} из ${ctx.daysInLastWeek} дней с записями. Новая неделя — хороший момент начать с чистого листа.`,
        url: statsUrl,
        tag: "cv-weekly",
      };

    default:
      return null;
  }
}
