/**
 * Splash tips + day-part copy — rotated / personalized while the app boots.
 *
 * B0 inventory (loading surfaces):
 * - AppSplash fullscreen — ration brand boot (this file)
 * - AppSplash inline — AuthGate “Входим…” (no second fullscreen)
 * - Capacitor SplashScreen — native shell (~350ms)
 * - AppShell.PageFallback / app/loading.tsx — route Suspense skeleton
 * - DayHero / DailyLog skeletons — in-scene
 * - DaisyLoading — admin only
 * - SceneSkeleton / SceneBusy — product routes (Wave D1)
 */

import { pluralDays } from "@/lib/russian-text";

/**
 * Brand beat once data is ready — short enough to feel fast, long enough
 * for the mascot/tip to read (Wave B1). Legacy name kept for imports.
 */
export const SPLASH_BRAND_MIN_MS = 900;
/** Extra hold after ready so the “Готово” bar can finish. */
export const SPLASH_OUTRO_MS = 400;
/** @deprecated Use SPLASH_BRAND_MIN_MS — kept as alias for older callers/tests. */
export const SPLASH_MIN_VISIBLE_MS = SPLASH_BRAND_MIN_MS;

/** Session flag: AuthGate already showed boot chrome this tab. */
export const BOOT_SPLASH_SESSION_KEY = "cv-boot-splash-at";

export function markBootSplashShown(now = Date.now()): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(BOOT_SPLASH_SESSION_KEY, String(now));
  } catch {
    // private mode
  }
}

export function recentBootSplashAgeMs(now = Date.now()): number | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(BOOT_SPLASH_SESSION_KEY);
    if (!raw) return null;
    const at = Number(raw);
    if (!Number.isFinite(at)) return null;
    return Math.max(0, now - at);
  } catch {
    return null;
  }
}

/** Skip fullscreen brand splash if AuthGate just showed boot UI. */
export function shouldSkipRationBrandSplash(now = Date.now()): boolean {
  const age = recentBootSplashAgeMs(now);
  return age != null && age < 12_000;
}

/** Ms to keep splash after bootstrap becomes ready. */
export function splashHoldAfterReadyMs(elapsedMs: number): number {
  const elapsed = Math.max(0, elapsedMs);
  if (elapsed >= SPLASH_BRAND_MIN_MS) return SPLASH_OUTRO_MS;
  return SPLASH_BRAND_MIN_MS - elapsed;
}

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
 * Prefer Monday week wrap / server tip, then streak / day part, then generic rotation.
 */
export function buildPersonalSplashTip(ctx: SplashTipContext = {}, seed = Date.now()): string {
  const hour = ctx.hour ?? new Date().getHours();
  const part = dayPartFromHour(hour);
  const streak = ctx.streak ?? 0;
  const logged = Boolean(ctx.loggedToday);
  const serverTip = ctx.serverTip?.trim() ?? "";

  // Monday wrap from ration-day wins over streak so the week start feels intentional.
  if (serverTip.startsWith("Прошлая неделя") || serverTip.startsWith("Новая неделя")) {
    return serverTip;
  }

  if (streak >= 2) {
    if (logged) {
      return `День ${streak} серии — вы в ритме. Так держать.`;
    }
    if (part === "evening" || part === "night") {
      return `Серия ${streak} ${pluralDays(streak)} — один приём сохранит её.`;
    }
    return `${greetingForDayPart(part)}. Серия ${streak} ${pluralDays(streak)} — день ещё впереди.`;
  }

  if (serverTip) {
    return serverTip;
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
