"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { NavIcon } from "@/components/NavIcons";
import { APP_NAV } from "@/lib/navigation";
import { withDateQuery } from "@/lib/use-selected-date";

type MobileTabBarProps = {
  date?: string;
};

const HOST_ID = "cv-mobile-tab-bar-host";

function getTabBarHost(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const existing = document.getElementById(HOST_ID);
  if (existing) return existing;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.setAttribute("data-cv-tab-bar-host", "1");
  // Attach to <html> so body overflow-x / transforms cannot turn fixed into
  // a scrolling containing block (same approach as celebration portal).
  host.style.cssText = [
    "position:fixed",
    "left:0",
    "right:0",
    "bottom:0",
    "width:100%",
    "margin:0",
    "padding:0",
    "border:none",
    "z-index:40",
    "pointer-events:none",
  ].join(";");
  document.documentElement.appendChild(host);
  return host;
}

/**
 * Bottom tab bar — always pinned to the screen bottom.
 * Do NOT translate by visualViewport.offsetTop: on iOS that value tracks
 * scroll and drags the bar up through the page (looks like it “scrolls”).
 */
export function MobileTabBar({ date }: MobileTabBarProps) {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setHost(getTabBarHost());
  }, []);

  const bar = (
    <nav
      className="mobile-tab-bar pointer-events-auto border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
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

  // Before portal host exists, keep a fixed fallback so the bar never lands in page flow.
  if (!host) {
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 md:hidden" aria-hidden={false}>
        {bar}
      </div>
    );
  }

  return createPortal(bar, host);
}
