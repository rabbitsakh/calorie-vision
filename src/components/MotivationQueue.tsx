"use client";

import type { ReactNode } from "react";

/**
 * Shows only the first non-null motivation card in DOM order.
 * Put urgent cards first (streak risk → yesterday summary → evening → tip).
 */
export function MotivationQueue({ children }: { children: ReactNode }) {
  return <div className="motivation-queue flex flex-col gap-4">{children}</div>;
}
