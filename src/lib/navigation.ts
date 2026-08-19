export type NavIconName = "stats" | "ration" | "weight" | "profile";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: NavIconName;
};

export const APP_NAV: AppNavItem[] = [
  { href: "/stats", label: "Статистика", shortLabel: "Стат.", icon: "stats" },
  { href: "/ration", label: "Рацион", shortLabel: "Рацион", icon: "ration" },
  { href: "/weight", label: "Вес", shortLabel: "Вес", icon: "weight" },
  { href: "/profile", label: "Профиль", shortLabel: "Профиль", icon: "profile" },
];

export function isAppNavPath(pathname: string): boolean {
  return APP_NAV.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
