"use client";

import { useEffect, useState } from "react";
import { formatArmedRecoveryChromeLine } from "@/lib/workouts/lever-session-apply";
import {
  listArmedRecoveries,
  type LeverMemoryEntry,
} from "@/lib/workouts/progression-lever-memory";

/**
 * O/P/Q — soft strip of armed L recovery on Today, History, and Live.
 */
export function LeverRecoveryStrip({ className = "" }: { className?: string }) {
  const [items, setItems] = useState<LeverMemoryEntry[]>([]);

  useEffect(() => {
    setItems(listArmedRecoveries(3));
  }, []);

  if (items.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`.trim()}
      aria-label="Восстановление после мимо"
    >
      {items.map((entry) => {
        const line = formatArmedRecoveryChromeLine(entry);
        if (!line) return null;
        return (
          <span
            key={`${entry.name}-${entry.recovery}`}
            className="inline-flex max-w-full items-center gap-1 rounded-lg border border-[var(--border-quiet)] bg-[var(--accent-soft)]/70 px-2 py-1 text-[11px] font-semibold text-[var(--accent-ink)]"
            title={line}
          >
            <span className="truncate">{line}</span>
          </span>
        );
      })}
    </div>
  );
}
