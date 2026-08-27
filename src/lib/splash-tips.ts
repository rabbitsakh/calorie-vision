/**
 * Splash tips + day-part copy — rotated / personalized while the app boots.
 */

import { pluralDays } from "@/lib/russian-text";

/** How long the branded splash stays visible at minimum (ration bootstrap). */
export const SPLASH_MIN_VISIBLE_MS = 2000;

export const SPLASH_TIPS = [
  "Сфотографируйте тарелку целиком — так распознавание точнее.",
  "Вода не добавляет калорий, но закрывает дневную цель.",
  "Регулярность важнее идеальных цифр.",
  "Можно править КБЖУ после фото — это нормально.",
  "Перекус тоже считается: день закрывается любой записью.",
  "Штрихкод на упаковке часто точнее, чем фото этикетки.",
  "Вечерний чек-ин помогает заметить паттерны настроения.",
  "Серия не про давление — можно заморозить один день в неделю.",
] as const;

export type DayPart = "morning" | "day" | "evening" | "night";

export type SplashTipContext = {
  streak?: number | null;
  loggedToday?: boolean | null;
  /** 0–23 local hour; defaults to device clock. */
  hour?: number | null;
  /** Server tip from /api/ration-day when available. */
  serverTip?: string | null;
};

export function dayPartFromHour(hour: number): DayPart {
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}

export function greetingForDayPart(part: DayPart): string {
  switch (part) {
    case "morning":
      return "Доброе утро";
    case "day":
      return "Хорошего дня";
    case "evening":
      return "Добрый вечер";
    default:
      return "Спокойной ночи";
  }
}

export function pickSplashTip(seed = Date.now()): string {
  const tip = SPLASH_TIPS[Math.abs(seed) % SPLASH_TIPS.length];
  return tip ?? SPLASH_TIPS[0]!;
}

/**
 * Prefer a personal line (streak / day part), then server tip, then generic rotation.
 */
export function buildPersonalSplashTip(ctx: SplashTipContext = {}, seed = Date.now()): string {
  const hour = ctx.hour ?? new Date().getHours();
  const part = dayPartFromHour(hour);
  const streak = ctx.streak ?? 0;
  const logged = Boolean(ctx.loggedToday);

  if (streak >= 2) {
    if (logged) {
      return `День ${streak} серии — вы в ритме. Так держать.`;
    }
    if (part === "evening" || part === "night") {
      return `Серия ${streak} ${pluralDays(streak)} — один приём сохранит её.`;
    }
    return `${greetingForDayPart(part)}. Серия ${streak} ${pluralDays(streak)} — день ещё впереди.`;
  }

  if (part === "morning") {
    return "Доброе утро. Один приём — и день уже начат.";
  }
  if (part === "evening") {
    return "Добрый вечер. Короткий чек-ин закрывает день без давления.";
  }
  if (part === "night") {
    return "Поздний час — достаточно одной записи, чтобы день засчитался.";
  }

  if (ctx.serverTip?.trim()) {
    return ctx.serverTip.trim();
  }

  return pickSplashTip(seed);
}

export type SplashStatusPhase = "boot" | "loading" | "ready";

export function splashStatusLabel(phase: SplashStatusPhase, custom?: string): string {
  if (custom) return custom;
  switch (phase) {
    case "ready":
      return "Готово";
    case "loading":
      return "Собираем день…";
    default:
      return "Открываем рацион…";
  }
}

/** Pose for splash mascot — cheer when ready / on a streak. */
export function splashMascotPose(
  phase: SplashStatusPhase,
  streak?: number | null,
): "tip" | "cheer" | "streak" {
  if (phase === "ready") return "cheer";
  if ((streak ?? 0) >= 3) return "streak";
  return "tip";
}
