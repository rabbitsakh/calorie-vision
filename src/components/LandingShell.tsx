"use client";

import { useEffect, useRef, type ReactNode } from "react";

type LandingShellProps = {
  className: string;
  children: ReactNode;
};

/** Tracks page scroll for parallax (--landing-scroll-y) and progress (--landing-scroll-p). */
export function LandingShell({ className, children }: LandingShellProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      root.style.setProperty("--landing-scroll-y", "0px");
      root.style.setProperty("--landing-scroll-p", "0");
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      root.style.setProperty("--landing-scroll-y", `${y}px`);
      root.style.setProperty("--landing-scroll-p", String(Math.min(1, y / max)));
    };
    const onScroll = () => {
      if (frame !== 0) {
        return;
      }
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div ref={rootRef} className={className}>
      <div className="landing-progress" aria-hidden />
      {children}
    </div>
  );
}
