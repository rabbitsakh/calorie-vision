export type NavIconName = "stats" | "ration" | "weight";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: NavIconName;
};

export const APP_NAV: AppNavItem[] = [
  { href: "/stats", label: "Статистика", shortLabel: "Статистика", icon: "stats" },
  { href: "/ration", label: "Рацион", shortLabel: "Рацион", icon: "ration" },
  { href: "/weight", label: "Вес", shortLabel: "Вес", icon: "weight" },
];

export function isAppNavPath(pathname: string): boolean {
  return APP_NAV.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
