"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AuthPanel } from "@/components/AuthPanel";
import { formatDateWords } from "@/lib/dates";
import { withDateQuery } from "@/lib/use-selected-date";

const NAV = [
  { href: "/", label: "Добавить" },
  { href: "/diary", label: "Дневник" },
  { href: "/calendar", label: "Календарь" },
  { href: "/weight", label: "Вес" },
];

type AppShellProps = {
  title: string;
  description?: string;
  date?: string;
  children: ReactNode;
};

export function AppShell({ title, description, date, children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="card p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
              Calorie Vision
            </p>
            <h1 className="mt-2 text-3xl font-bold">{title}</h1>
            {description ? <p className="mt-2 max-w-2xl text-slate-600">{description}</p> : null}
            {date ? (
              <p className="mt-2 text-sm font-medium capitalize text-teal-800">{formatDateWords(date)}</p>
            ) : null}
          </div>
          <AuthPanel />
        </div>

        <nav className="mt-6 flex flex-wrap gap-2">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={date ? withDateQuery(item.href, date) : item.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  active ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {children}
    </main>
  );
}

export function PageFallback() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="card h-40 animate-pulse p-6" />
      <div className="card h-64 animate-pulse p-6" />
    </main>
  );
}
