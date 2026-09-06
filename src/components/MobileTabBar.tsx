"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NavIcon } from "@/components/NavIcons";
import { APP_NAV } from "@/lib/navigation";
import { countOfflineQueue, subscribeMealDraftQueue } from "@/lib/meal-draft-queue";
import { withDateQuery } from "@/lib/use-selected-date";

type MobileTabBarProps = {
  date?: string;
};

/**
 * Bottom tab bar — in-flow flex child of `.cv-app-frame` (not position:fixed).
 * Fixed + visualViewport pin caused the bar to jump mid-page on iOS Stats.
 */
export function MobileTabBar({ date }: MobileTabBarProps) {
  const pathname = usePathname();
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    const refresh = () => setQueueCount(countOfflineQueue());
    refresh();
    return subscribeMealDraftQueue(refresh);
  }, []);

  return (
    <nav
      className="mobile-tab-bar shrink-0 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
      aria-label="Основные разделы"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1">
        {APP_NAV.map((item) => {
          const active = pathname === item.href;
          const href =
            date && (item.href === "/ration" || item.href === "/stats")
              ? withDateQuery(item.href, date)
              : item.href;
          const showQueueBadge = item.href === "/ration" && queueCount > 0;

          return (
            <Link
              key={item.href}
              href={href}
              className={`flex min-h-11 min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-xs font-semibold transition-colors ${
                active ? "text-[var(--accent)]" : "text-slate-500"
              }`}
              aria-label={
                showQueueBadge ? `${item.label}: ${queueCount} в офлайн-очереди` : item.label
              }
            >
              <div
                className={`relative flex h-8 w-full max-w-[4.5rem] items-center justify-center rounded-full transition-colors ${
                  active ? "bg-teal-50" : ""
                }`}
              >
                <NavIcon
                  name={item.icon}
                  className={`h-5 w-5 ${active ? "text-[var(--accent)]" : "text-slate-500"}`}
                />
                {showQueueBadge ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold leading-none text-white">
                    {queueCount > 9 ? "9+" : queueCount}
                  </span>
                ) : null}
              </div>
              <span className="truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
