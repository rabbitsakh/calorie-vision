export type NavIconName = "stats" | "ration" | "gym" | "plan" | "weight" | "profile";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: NavIconName;
};

/**
 * Primary app chrome:
 * Стат · Рацион · [+] · Зал · Профиль
 * Food week plan stays at /plan via Рацион / Профиль — not a tab.
 * Weight stays at /weight via DayHero / Plan / Profile — not a tab.
 */
export const APP_NAV: AppNavItem[] = [
  { href: "/stats", label: "Статистика", shortLabel: "Стат.", icon: "stats" },
  { href: "/ration", label: "Рацион", shortLabel: "Рацион", icon: "ration" },
  { href: "/workouts", label: "Тренировки", shortLabel: "Зал", icon: "gym" },
  { href: "/profile", label: "Профиль", shortLabel: "Профиль", icon: "profile" },
];

export function isAppNavPath(pathname: string): boolean {
  return APP_NAV.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

/** Shell pages that keep the center «+» (tabs + food week plan). */
export function isFoodAddPath(pathname: string): boolean {
  if (isAppNavPath(pathname)) return true;
  return pathname === "/plan" || pathname.startsWith("/plan/");
}

/** Paths that keep the selected ?date= when switching tabs. */
export function navKeepsDate(href: string): boolean {
  return href === "/ration" || href === "/stats" || href === "/plan";
}
