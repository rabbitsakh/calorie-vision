export type NavIconName = "stats" | "ration" | "plan" | "weight" | "profile";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: NavIconName;
};

/**
 * Primary app chrome (Wave Weekly OS):
 * Стат · Рацион · [+] · План · Профиль
 * Weight stays at /weight via DayHero / Plan / Profile — not a tab.
 */
export const APP_NAV: AppNavItem[] = [
  { href: "/stats", label: "Статистика", shortLabel: "Стат.", icon: "stats" },
  { href: "/ration", label: "Рацион", shortLabel: "Рацион", icon: "ration" },
  { href: "/plan", label: "План", shortLabel: "План", icon: "plan" },
  { href: "/profile", label: "Профиль", shortLabel: "Профиль", icon: "profile" },
];

export function isAppNavPath(pathname: string): boolean {
  return APP_NAV.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

/** Paths that keep the selected ?date= when switching tabs. */
export function navKeepsDate(href: string): boolean {
  return href === "/ration" || href === "/stats" || href === "/plan";
}
