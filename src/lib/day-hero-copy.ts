/**
 * Short day-hero phrases — one line under the ring on the ration screen.
 * Tone: adult product — calm, factual; % of goal is the lead signal when known.
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
  const pct = Math.round(ctx.caloriePct);
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
        ? "Добавьте первый приём — день начнётся."
        : "Пока пусто. Можно добавить записи за этот день.",
      pose: "empty",
    };
  }

  if (hasTarget && pct >= 95 && pct <= 110) {
    return {
      eyebrow,
      headline: ctx.holiday
        ? `${pct}% — цель с праздничным запасом.`
        : `${pct}% — цель почти закрыта.`,
      pose: "goal",
    };
  }

  if (hasTarget && pct > 110) {
    return {
      eyebrow,
      headline: `${pct}% — чуть выше цели.`,
      pose: "tip",
    };
  }

  if (hasTarget && pct >= 20) {
    return {
      eyebrow,
      headline:
        streak >= 3
          ? `${pct}% к цели · день ${streak} серии.`
          : `${pct}% к цели.`,
      pose: streak >= 3 ? "streak" : "cheer",
    };
  }

  if (hasTarget) {
    return {
      eyebrow,
      headline:
        streak >= 2
          ? `${pct}% · серия ${streak} ${pluralDays(streak)}.`
          : `${pct}% — день начат.`,
      pose: streak >= 2 ? "streak" : "cheer",
    };
  }

  return {
    eyebrow,
    headline:
      streak >= 2
        ? `Запись есть · серия ${streak} ${pluralDays(streak)}.`
        : "Первый приём записан.",
    pose: "cheer",
  };
}
