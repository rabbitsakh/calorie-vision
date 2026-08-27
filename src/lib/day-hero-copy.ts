/**
 * Short day-hero phrases — one line under the mascot on the ration screen.
 */

import type { MascotPose } from "@/lib/mascot-types";
import { pluralDays } from "@/lib/russian-text";

export type DayHeroCopyContext = {
  calories: number;
  calorieTarget: number | null;
  caloriePct: number;
  streak: number;
  loggedToday: boolean;
  isToday: boolean;
  holiday?: boolean;
};

export type DayHeroCopy = {
  eyebrow: string;
  headline: string;
  pose: MascotPose;
};

export function buildDayHeroCopy(ctx: DayHeroCopyContext): DayHeroCopy {
  const eyebrow = ctx.isToday ? "Сегодня" : "День";
  const pct = ctx.caloriePct;
  const hasTarget = ctx.calorieTarget != null && ctx.calorieTarget > 0;
  const streak = Math.max(0, ctx.streak);

  if (ctx.calories <= 0) {
    if (streak >= 2 && ctx.isToday) {
      return {
        eyebrow,
        headline: `Серия ${streak} ${pluralDays(streak)} — добавьте первый приём.`,
        pose: "streak",
      };
    }
    return {
      eyebrow,
      headline: ctx.isToday
        ? "Один приём — и день уже в движении."
        : "Пока пусто. Можно добавить записи за этот день.",
      pose: "empty",
    };
  }

  if (hasTarget && pct >= 95 && pct <= 110) {
    return {
      eyebrow,
      headline: ctx.holiday
        ? "Цель закрыта — с учётом праздничного запаса."
        : "Цель почти закрыта. Отличная работа!",
      pose: "goal",
    };
  }

  if (hasTarget && pct > 110) {
    return {
      eyebrow,
      headline: "Чуть выше цели — без паники, день ещё идёт.",
      pose: "tip",
    };
  }

  if (hasTarget && pct >= 40) {
    return {
      eyebrow,
      headline:
        streak >= 3
          ? `День ${streak} серии — вы уже на ${Math.round(pct)}%.`
          : `Уже ${Math.round(pct)}% к цели — продолжайте в своём темпе.`,
      pose: streak >= 3 ? "streak" : "cheer",
    };
  }

  return {
    eyebrow,
    headline:
      streak >= 2
        ? `Запись есть. Серия ${streak} ${pluralDays(streak)} в безопасности.`
        : "Первый шаг сделан — дальше проще.",
    pose: "cheer",
  };
}
