"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type LandingScrollRevealProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Fade / rise on scroll. Content stays visible by default (SSR / no-JS);
 * JS only applies the pending+visible dance when motion is allowed.
 */
export function LandingScrollReveal({ children, className = "" }: LandingScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"static" | "pending" | "visible">("static");

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setPhase("visible");
      return;
    }

    setPhase("pending");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setPhase("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" },
    );

    observer.observe(node);

    // If already in view on mount (short screens), reveal immediately.
    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) {
      setPhase("visible");
      observer.disconnect();
    }

    return () => observer.disconnect();
  }, []);

  const classes = [
    "landing-scroll-reveal",
    phase === "pending" ? "landing-scroll-reveal-pending" : "",
    phase === "visible" ? "landing-scroll-reveal-visible" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={ref} className={classes}>
      {children}
    </div>
  );
}
