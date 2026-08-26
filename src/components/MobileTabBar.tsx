"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type RefObject } from "react";
import { NavIcon } from "@/components/NavIcons";
import { APP_NAV } from "@/lib/navigation";
import { withDateQuery } from "@/lib/use-selected-date";

type MobileTabBarProps = {
  date?: string;
};

/**
 * Keep the tab bar glued to the bottom of the *visual* viewport.
 * On iOS Safari/PWA, layout viewport and visual viewport diverge while
 * scrolling (URL bar / rubber-band), which makes position:fixed bottom
 * chrome appear to “pull up” with the page.
 */
function useVisualViewportBottomPin(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => {
      const vv = window.visualViewport;
      if (!vv) {
        el.style.transform = "translateZ(0)";
        return;
      }
      const bottomGap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.transform = `translate3d(0, ${-bottomGap}px, 0)`;
    };

    sync();
    const vv = window.visualViewport;
    window.addEventListener("resize", sync);
    vv?.addEventListener("resize", sync);
    vv?.addEventListener("scroll", sync);
    return () => {
      window.removeEventListener("resize", sync);
      vv?.removeEventListener("resize", sync);
      vv?.removeEventListener("scroll", sync);
    };
  }, [ref]);
}

export function MobileTabBar({ date }: MobileTabBarProps) {
  const pathname = usePathname();
  const barRef = useRef<HTMLElement>(null);
  useVisualViewportBottomPin(barRef);

  return (
    <nav
      ref={barRef}
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
              className={`flex min-h-11 min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-xs font-semibold transition-colors ${
                active ? "text-[var(--accent)]" : "text-slate-500"
              }`}
            >
              <div
                className={`flex h-8 w-full max-w-[4.5rem] items-center justify-center rounded-full transition-colors ${
                  active ? "bg-teal-50" : ""
                }`}
              >
                <NavIcon name={item.icon} className={`h-5 w-5 ${active ? "text-[var(--accent)]" : "text-slate-500"}`} />
              </div>
              <span className="truncate">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
