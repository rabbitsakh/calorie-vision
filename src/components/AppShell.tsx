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
  children: ReactNode;
};

export function AppShell({ title, description, date, headerExtra, children }: AppShellProps) {
  const pathname = usePathname();
  const homeHref = date ? withDateQuery("/ration", date) : "/ration";

  return (
    <>
      <main className="app-shell mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-4 md:gap-6 md:py-8">
        <header className="card p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link href={homeHref} className="inline-flex items-center gap-2 md:gap-3">
                <BrandMark size={40} className="md:hidden" />
                <BrandMark size={48} className="hidden md:block" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 md:text-sm md:tracking-[0.2em]">
                  Calorie Vision
                </span>
              </Link>
              <h1 className="mt-2 text-2xl font-bold md:text-3xl">{title}</h1>
              {description ? (
                <p className="mt-1 max-w-2xl text-sm text-slate-600 md:mt-2 md:text-base">{description}</p>
              ) : null}
            </div>
            <AuthPanel />
          </div>

          {headerExtra ? <div className="mt-4">{headerExtra}</div> : null}

          <nav className="mt-4 hidden flex-wrap gap-2 md:flex md:mt-6">
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
                    active ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
    <main className="app-shell mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-4 md:gap-6 md:py-8">
      <section className="card p-4 md:p-6">
        <div className="h-5 w-36 animate-pulse rounded-md bg-slate-200 md:h-6 md:w-44" />
        <div className="mt-3 h-8 w-48 animate-pulse rounded-md bg-slate-200 md:h-9 md:w-56" />
        <div className="mt-2 h-4 w-full max-w-md animate-pulse rounded bg-slate-100" />
        <div className="mt-6 hidden gap-2 md:flex">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-10 w-24 animate-pulse rounded-full bg-slate-200" />
          ))}
        </div>
      </section>
      <div className="card h-52 animate-pulse p-6 md:h-56" />
      <div className="card h-72 animate-pulse p-6" />
    </main>
  );
}
