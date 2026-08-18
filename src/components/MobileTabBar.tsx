"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcons";
import { APP_NAV } from "@/lib/navigation";
import { withDateQuery } from "@/lib/use-selected-date";

type MobileTabBarProps = {
  date?: string;
};

export function MobileTabBar({ date }: MobileTabBarProps) {
  const pathname = usePathname();

  return (
    <nav
      className="mobile-tab-bar fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      aria-label="Основные разделы"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1">
        {APP_NAV.map((item) => {
          const active = pathname === item.href;
          const href = date && item.href === "/ration" ? withDateQuery(item.href, date) : item.href;

          return (
            <Link
              key={item.href}
              href={href}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-xs font-semibold ${
                active ? "text-teal-700" : "text-slate-500"
              }`}
            >
              <NavIcon name={item.icon} className={`h-6 w-6 ${active ? "text-teal-700" : "text-slate-400"}`} />
              <span className="truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
