"use client";

import { useEffect, useRef, type ReactNode } from "react";

type LandingShellProps = {
  className: string;
  children: ReactNode;
};

/** Tracks page scroll for landing parallax layers (CSS var --landing-scroll-y). */
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
      return;
    }

    let frame = 0;
    const update = () => {
      frame = 0;
      root.style.setProperty("--landing-scroll-y", `${window.scrollY}px`);
    };
    const onScroll = () => {
      if (frame !== 0) {
        return;
      }
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div ref={rootRef} className={className}>
      {children}
    </div>
  );
}
