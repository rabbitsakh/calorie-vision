"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { BrandMark } from "@/components/BrandMark";
import { MobileTabBar } from "@/components/MobileTabBar";
import { NavIcon } from "@/components/NavIcons";
import { APP_NAV } from "@/lib/navigation";
import { withDateQuery } from "@/lib/use-selected-date";

type AppShellProps = {
  title: string;
  description?: string;
  date?: string;
  headerExtra?: ReactNode;
  /** Compact mobile chrome: smaller brand + title, optional description hidden on small screens. */
  compact?: boolean;
  children: ReactNode;
};

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
  const hideTitleOnMobile = compact && pathname === "/ration";

  return (
    <>
      <main className="app-shell mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-2.5 px-2.5 py-2.5 md:gap-6 md:px-4 md:py-8">
        <header className={`card ${compact ? "p-2.5 md:p-5" : "p-4 md:p-6"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link href={homeHref} className="inline-flex items-center gap-2 md:gap-3">
                <BrandMark size={compact ? 28 : 40} className="md:hidden" />
                <BrandMark size={compact ? 40 : 48} className="hidden md:block" />
                <span className="font-display hidden text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-[var(--accent)] md:inline md:text-sm md:tracking-[0.2em]">
                  Calorie Vision
                </span>
              </Link>
              <h1
                className={`font-display font-bold tracking-tight text-slate-900 ${
                  hideTitleOnMobile ? "mt-0 hidden md:mt-1.5 md:block md:text-2xl" : compact ? "mt-1.5 text-xl md:text-2xl" : "mt-2 text-2xl md:text-3xl"
                }`}
              >
                {title}
              </h1>
              {description ? (
                <p
                  className={`max-w-2xl text-sm text-slate-600 ${
                    compact ? "mt-0.5 hidden md:mt-1 md:block md:text-base" : "mt-1 md:mt-2 md:text-base"
                  }`}
                >
                  {description}
                </p>
              ) : null}
            </div>
            <AuthPanel />
          </div>

          {headerExtra ? <div className={compact ? "mt-2" : "mt-4"}>{headerExtra}</div> : null}

          <nav className={`hidden flex-wrap gap-2 md:flex ${compact ? "md:mt-4" : "md:mt-6"}`}>
            {APP_NAV.map((item) => {
              const active = pathname === item.href;
              const href =
                date && (item.href === "/ration" || item.href === "/stats")
                  ? withDateQuery(item.href, date)
                  : item.href;

              return (
                <Link
                  key={item.href}
                  href={href}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    active ? "bg-[var(--accent)] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
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

      <MobileTabBar date={date} />
    </>
  );
}

export function PageFallback() {
  return (
    <main className="app-shell mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 px-3 py-3 md:gap-6 md:px-4 md:py-8">
      <section className="card p-3 md:p-5">
        <div className="skeleton-line w-28" />
        <div className="mt-3 flex items-center gap-4">
          <div className="skeleton-ring" />
          <div className="flex-1 space-y-2">
            <div className="skeleton-line w-3/4" />
            <div className="skeleton-line w-1/2" />
          </div>
        </div>
      </section>
      <div className="card space-y-2 p-4">
        <div className="skeleton-line w-40" />
        <div className="h-24 animate-pulse rounded-xl bg-slate-200" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </main>
  );
}
