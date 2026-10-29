export type NavIconName = "stats" | "ration" | "gym" | "plan" | "weight" | "profile";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: NavIconName;
};

/**
 * Primary app chrome (hybrid shell): Сегодня · Зал · Прогресс · Я.
 * Routes keep their old paths (push / APK deep links); /today, /progress, /me redirect.
 * Food add + AI live in the composer above the tabs on «Сегодня».
 * Food week plan stays at /plan, weight at /weight — not tabs.
 */
export const APP_NAV: AppNavItem[] = [
  { href: "/ration", label: "Сегодня", shortLabel: "Сегодня", icon: "ration" },
  { href: "/workouts", label: "Зал", shortLabel: "Зал", icon: "gym" },
  { href: "/stats", label: "Прогресс", shortLabel: "Прогресс", icon: "stats" },
  { href: "/profile", label: "Я", shortLabel: "Я", icon: "profile" },
];

/** Short hybrid aliases → existing routes. */
export const NAV_ALIASES: Record<string, string> = {
  "/today": "/ration",
  "/progress": "/stats",
  "/me": "/profile",
};

/** Bottom composer (text · photo · +) — only on the day screen. */
export function showsComposer(pathname: string): boolean {
  return pathname === "/ration" || pathname.startsWith("/ration/");
}

export function isAppNavPath(pathname: string): boolean {
  return APP_NAV.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

/** Shell pages that keep the center dock (tabs + food week plan + AI assistant). */
export function isFoodAddPath(pathname: string): boolean {
  if (isAppNavPath(pathname)) return true;
  if (pathname === "/assistant" || pathname.startsWith("/assistant/")) return true;
  return pathname === "/plan" || pathname.startsWith("/plan/");
}

/** Paths that keep the selected ?date= when switching tabs. */
export function navKeepsDate(href: string): boolean {
  return href === "/ration" || href === "/stats" || href === "/plan" || href === "/workouts";
}
