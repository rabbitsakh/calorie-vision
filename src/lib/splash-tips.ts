/**
 * Short splash tips — rotated while the app boots / day bootstraps.
 */

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

export function pickSplashTip(seed = Date.now()): string {
  const tip = SPLASH_TIPS[Math.abs(seed) % SPLASH_TIPS.length];
  return tip ?? SPLASH_TIPS[0]!;
}
