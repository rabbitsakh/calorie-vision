import type { PushPayload } from "@/lib/push";
import { rationMealLink, reminderDeepLink, workoutsDeepLink } from "@/lib/push-deeplink";
import { recommendDietForProfile, type DietProfileFields } from "@/lib/diet";
import { computeStreakFromSet, shiftDateKeyUtc, weekStartMonday } from "@/lib/streak-utils";
import {
  effectiveReminderSchedule,
  type PushReminderPrefs,
  type ReminderKind,
} from "@/lib/push-reminder-schedule";
import {
  breakfastStreakBody,
  emptyMealSlotTitle,
  streakAtRiskPushTitle,
} from "@/lib/motivation-voice";
import {
  pickGymReminderCopy,
  shouldSkipGymReminder,
} from "@/lib/push-gym-reminder";

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
import { resolveWaterTargetMl } from "@/lib/water-target";

export const DEFAULT_PUSH_TIMEZONE = "Europe/Moscow";

export type UserReminderContext = {
  today: string;
  mealCount: number;
  totalCalories: number;
  calorieTarget: number | null;
  waterMl: number;
  /** Personal water goal (ml); falls back to default when omitted. */
  waterTargetMl?: number | null;
  streak: number;
  streakBeforeToday: number;
  loggedToday: boolean;
  mood: number | null;
  hasBreakfast: boolean;
  hasLunch: boolean;
  hasDinner: boolean;
  daysLoggedLastWeek: number;
  daysInLastWeek: number;
  /** Days since last meal log; null if never logged. */
  daysSinceLastMeal: number | null;
  /** Gym nudge: clock started, not finished (running/paused). */
  hasActiveWorkoutToday?: boolean;
  /** Gym nudge: session finished today. */
  hasFinishedWorkoutToday?: boolean;
  /** Gym nudge: at least one completed set logged today. */
  hasLoggedWorkoutSetToday?: boolean;
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

function waterTargetOf(ctx: UserReminderContext): number {
  return resolveWaterTargetMl(ctx.waterTargetMl);
}

function waterProgressLine(waterMl: number, targetMl: number): string {
  const pct = Math.round((waterMl / targetMl) * 100);
  return `${waterMl} мл из ${targetMl} (${pct}%)`;
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
 * A/B assignment from userId + kind + local date.
 * Rotates day-to-day so the same user sees more variety.
 */
export function pickPushCopyVariant(
  userId: string,
  kind: ReminderKind,
  today?: string | null,
): PushCopyVariant {
  const key = today ? `${userId}:${kind}:${today}` : `${userId}:${kind}`;
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
  ctx: UserReminderContext,
  options?: BuildReminderOptions,
): PushCopyVariant {
  if (options?.variant) return options.variant;
  if (options?.userId) return pickPushCopyVariant(options.userId, kind, ctx.today);
  return "A";
}

export function buildReminderPayload(
  kind: ReminderKind,
  ctx: UserReminderContext,
  options?: BuildReminderOptions,
): PushPayload | null {
  const rationUrl = reminderDeepLink(kind === "calories" ? "streak" : kind);
  const planUrl = reminderDeepLink("weekly");
  const statsUrl = reminderDeepLink("calories");
  const breakfastUrl = rationMealLink("BREAKFAST");
  const lunchUrl = rationMealLink("LUNCH");
  const dinnerUrl = rationMealLink("DINNER");
  const variant = resolveCopyVariant(kind, ctx, options);
  const isB = variant === "B";

  switch (kind) {
    case "breakfast":
      if (ctx.mealCount > 0 || ctx.hasBreakfast) return null;
      return {
        title: isB ? "Завтрак ждёт" : "Доброе утро!",
        body:
          ctx.streakBeforeToday >= 3
            ? breakfastStreakBody(ctx.streakBeforeToday, isB)
            : isB
              ? "Лёгкий старт дня: отметьте завтрак, пока всё свежо."
              : "Первая запись дня — завтрак. Меньше минуты, и день уже открыт.",
        url: breakfastUrl,
        tag: "cv-breakfast",
      };

    case "lunch":
      if (ctx.hasLunch) return null;
      if (ctx.mealCount === 0) {
        return {
          title: emptyMealSlotTitle("lunch", isB),
          body: isB
            ? "День пока пустой — добавьте обед, чтобы открыть дневник."
            : "Сегодня ещё нет приёмов пищи — добавьте хотя бы обед.",
          url: lunchUrl,
          tag: "cv-lunch",
        };
      }
      return {
        title: isB ? "Обед — якорь дня" : "Время обеда",
        body:
          ctx.totalCalories > 0
            ? isB
              ? `Уже ${ctx.totalCalories} ккал — обед закрепит картину дня.`
              : `Уже ${ctx.totalCalories} ккал. Запишите обед, пока помните порцию.`
            : isB
              ? "Пара кликов — и обед в дневнике. День станет понятнее."
              : "Запишите обед сейчас — вечером вспоминать сложнее.",
        url: lunchUrl,
        tag: "cv-lunch",
      };

    case "dinner":
      if (ctx.hasDinner) return null;
      if (ctx.mealCount === 0) {
        return {
          title: emptyMealSlotTitle("dinner", isB),
          body: isB
            ? "День пустой — отметьте ужин, чтобы открыть дневник."
            : "Сегодня ещё нет приёмов пищи — добавьте хотя бы ужин.",
          url: dinnerUrl,
          tag: "cv-dinner",
        };
      }
      return {
        title: isB ? "Ужин закроет день" : "Время ужина",
        body:
          ctx.totalCalories > 0
            ? isB
              ? `Уже ${ctx.totalCalories} ккал — ужин дополнит картину без оценок.`
              : `Уже ${ctx.totalCalories} ккал за день. Запишите ужин, пока свежо.`
            : isB
              ? "Короткая запись ужина — и день можно спокойно закрыть."
              : "Запишите ужин сейчас — потом вспомнить порцию сложнее.",
        url: dinnerUrl,
        tag: "cv-dinner",
      };

    case "water_midday": {
      const waterTarget = waterTargetOf(ctx);
      if (ctx.waterMl >= waterTarget / 2) return null;
      return {
        title: isB ? "Напомните себе про воду" : "Стакан воды?",
        body: isB
          ? `${waterProgressLine(ctx.waterMl, waterTarget)}. До середины цели осталось ~${waterTarget / 2 - ctx.waterMl} мл.`
          : `${waterProgressLine(ctx.waterMl, waterTarget)}. До половины цели ~${waterTarget / 2 - ctx.waterMl} мл.`,
        url: rationUrl,
        tag: "cv-water-mid",
      };
    }

    case "water_evening": {
      const waterTarget = waterTargetOf(ctx);
      if (ctx.waterMl >= waterTarget) return null;
      return {
        title: isB ? "Допить до цели?" : "Вечерняя вода",
        body: isB
          ? `${waterProgressLine(ctx.waterMl, waterTarget)}. Ещё ${waterTarget - ctx.waterMl} мл — и день по воде закрыт.`
          : `${waterProgressLine(ctx.waterMl, waterTarget)}. До цели ещё ${waterTarget - ctx.waterMl} мл.`,
        url: rationUrl,
        tag: "cv-water-eve",
      };
    }

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
          title: streakAtRiskPushTitle(ctx.streakBeforeToday, isB),
          body: isB
            ? "Без давления: одна запись до полуночи сохранит ритм."
            : "Сегодня ещё пусто — любой приём пищи до полуночи удержит серию.",
          url: rationUrl,
          tag: "cv-streak",
        };
      }
      return {
        title: isB ? "Одна запись — и день ваш" : "Откройте день записью",
        body: isB
          ? "Минута сейчас — и день уже засчитан. Можно начать с чего угодно."
          : "Одна отметка открывает день. Меньше минуты, без оценок.",
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
        url: planUrl,
        tag: "cv-weekly",
      };

    case "reactivation":
      if (ctx.daysSinceLastMeal == null) return null;
      if (ctx.daysSinceLastMeal < 3 || ctx.daysSinceLastMeal > 30) return null;
      return {
        title: isB ? "Мы рядом, без давления" : "Скучали по вам",
        body: isB
          ? `Уже ${ctx.daysSinceLastMeal} дн. без записей — можно начать с одного приёма пищи.`
          : `${ctx.daysSinceLastMeal} дн. без записей. Один приём пищи — и день снова открыт.`,
        url: rationUrl,
        tag: "cv-reactivation",
      };

    case "gym":
      if (shouldSkipGymReminder(ctx)) return null;
      {
        const copy = pickGymReminderCopy({
          userId: options?.userId,
          today: ctx.today,
        });
        return {
          title: copy.title,
          body: copy.body,
          url: workoutsDeepLink(),
          tag: "cv-gym",
        };
      }

    default:
      return null;
  }
}
