"use client";

import { AuthPanel } from "@/components/AuthPanel";
import { BrandMark } from "@/components/BrandMark";
import { FoodAddHost, useFoodAddUi } from "@/components/FoodAddHost";
import { FoodAddModeMenu } from "@/components/FoodAddQuickMenu";
import { MetaChestCelebration } from "@/components/MetaChestCelebration";
import { ReferralChestToast } from "@/components/ReferralChestToast";
import { MobileTabBar } from "@/components/MobileTabBar";
import { NavIcon } from "@/components/NavIcons";
import { WeightQuickSheet } from "@/components/WeightQuickSheet";
import { WaterQuickSheet } from "@/components/WaterQuickSheet";
import { APP_NAV, isFoodAddPath, navKeepsDate } from "@/lib/navigation";
import { requestOpenFoodAddPicker } from "@/lib/open-food-camera";
import { withDateQuery } from "@/lib/use-selected-date";
import { ensureAdultQuietDefault } from "@/lib/gamification-quiet";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppShellProps = {
  title: string;
  description?: string;
  date?: string;
  headerExtra?: ReactNode;
  /** Compact mobile chrome: smaller brand + title, optional description hidden on small screens. */
  compact?: boolean;
  children: ReactNode;
};

function DesktopAddButton() {
  const { confirmOpen } = useFoodAddUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  useEffect(() => {
    if (confirmOpen) setMenuOpen(false);
  }, [confirmOpen]);

  return (
    <div className="relative hidden md:inline-flex">
      <div className="inline-flex overflow-hidden rounded-[var(--radius-control)] bg-[var(--accent)] shadow-sm">
        <button
          type="button"
          className="inline-flex min-h-10 items-center gap-2 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-40"
          disabled={confirmOpen}
          onClick={() => requestOpenFoodAddPicker()}
        >
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Добавить
        </button>
        <button
          type="button"
          className="inline-flex min-h-10 items-center border-l border-white/25 px-2.5 text-white transition-opacity hover:opacity-95 disabled:opacity-40"
          disabled={confirmOpen}
          aria-label="Способ добавления"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <svg aria-hidden className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <FoodAddModeMenu open={menuOpen} onClose={closeMenu} placement="down" className="right-0 left-auto translate-x-0" />
      <DesktopAddHotkey disabled={confirmOpen} />
    </div>
  );
}

function DesktopAddHotkey({ disabled }: { disabled?: boolean }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (disabled) return;
      if (event.key !== "a" && event.key !== "A" && event.key !== "ф" && event.key !== "Ф") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) return;
      event.preventDefault();
      requestOpenFoodAddPicker();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled]);
  return null;
}

export function AppShell({
  title,
  description,
  date,
  headerExtra,
  compact = false,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const homeHref = date ? withDateQuery("/ration", date) : "/ration";
  const hideTitleOnMobile = compact && (pathname === "/ration" || pathname === "/stats");
  const theaterChrome =
    pathname === "/ration" ||
    pathname === "/stats" ||
    pathname === "/workouts" ||
    pathname.startsWith("/dev/chrome-preview");
  const foodAddEnabled = isFoodAddPath(pathname);

  useEffect(() => {
    ensureAdultQuietDefault();
  }, []);

  return (
    <FoodAddHost date={date} enabled={foodAddEnabled}>
      <div className="cv-app-frame">
        <main
          className={`app-shell cv-app-main mx-auto flex w-full max-w-6xl flex-1 flex-col px-2.5 md:gap-6 md:px-4 md:py-8 ${
            theaterChrome ? "gap-1.5 py-1.5" : "gap-2.5 py-2"
          }`}
        >
          <header className={`app-chrome${theaterChrome ? " app-chrome--theater" : ""}`}>
            <div className={`flex items-center justify-between gap-3 ${theaterChrome ? "h-10 md:h-12" : "h-11 md:h-12"}`}>
              <Link href={homeHref} className="app-chrome__brand">
                <BrandMark size={theaterChrome ? 36 : compact ? 38 : 42} className="md:hidden" />
                <BrandMark size={compact ? 44 : 52} className="hidden md:block" />
                <span className="app-chrome__wordmark truncate">
                  Calorie Vision
                  {compact && !hideTitleOnMobile && !theaterChrome ? (
                    <span className="app-chrome__wordmark-sub md:hidden">{title}</span>
                  ) : null}
                </span>
              </Link>
              <div className="flex h-full shrink-0 items-center gap-2">
                {foodAddEnabled ? <DesktopAddButton /> : null}
                <AuthPanel compactTrigger />
              </div>
            </div>

            <h1
              className={`font-bold tracking-tight text-[var(--foreground)] ${
                hideTitleOnMobile
                  ? "mt-0 hidden md:mt-3 md:block md:text-2xl"
                  : compact
                    ? "mt-2 hidden text-xl md:mt-3 md:block md:text-2xl"
                    : "mt-2.5 text-2xl md:text-3xl"
              }`}
            >
              {title}
            </h1>
            {description ? (
              <p
                className={`max-w-2xl text-sm text-[var(--muted-strong)] ${
                  compact ? "mt-0.5 hidden md:mt-1 md:block md:text-base" : "mt-1 md:mt-2 md:text-base"
                }`}
              >
                {description}
              </p>
            ) : null}

            {headerExtra ? <div className={compact ? "mt-2" : "mt-4"}>{headerExtra}</div> : null}

            <nav className="app-chrome__nav" aria-label="Разделы">
              {APP_NAV.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const href =
                  date && navKeepsDate(item.href) ? withDateQuery(item.href, date) : item.href;

                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={`app-chrome__nav-link${active ? " app-chrome__nav-link--active" : ""}`}
                  >
                    <NavIcon name={item.icon} className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          {children}
        </main>

        <MobileTabBar date={date} showAdd={foodAddEnabled} />
        <MetaChestCelebration />
        <ReferralChestToast />
        <WaterQuickSheet />
        <WeightQuickSheet />
      </div>
    </FoodAddHost>
  );
}

export function PageFallback() {
  return (
    <main className="app-shell mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 px-3 py-3 md:gap-6 md:px-4 md:py-8">
      <header className="app-chrome">
        <div className="skeleton-line w-40" />
        <div className="mt-3 skeleton-line w-24" />
      </header>
      <section className="space-y-2 pt-1">
        <div className="skeleton-line w-3/4" />
        <div className="h-24 animate-pulse rounded-[var(--radius-lg)] bg-teal-100/60" />
        <div className="h-16 animate-pulse rounded-[var(--radius-lg)] bg-[var(--accent-soft)]/70" />
      </section>
    </main>
  );
}
