"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { nextBadgeHint, type BadgeStatsSnapshot, type NextBadgeHint } from "@/lib/badges";
import { withBasePath } from "@/lib/paths";

type NextBadgeChipProps = {
  refreshKey: number;
};

/**
 * Quiet «почти значок» chip on ration — one hint, links to Profile achievements.
 * Label must say it’s a badge (not a weekly challenge).
 */
export function NextBadgeChip({ refreshKey }: NextBadgeChipProps) {
  const [hint, setHint] = useState<NextBadgeHint | null>(null);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/badges"));
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        badges: Array<{ key: string; unlocked: boolean }>;
        stats?: BadgeStatsSnapshot;
      };
      if (!data.stats) return;
      const unlocked = data.badges.filter((b) => b.unlocked).map((b) => b.key);
      setHint(nextBadgeHint(unlocked, data.stats));
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!hint || hint.ratio <= 0) return null;

  const pct = Math.min(100, Math.round(hint.ratio * 100));

  return (
    <Link
      href={withBasePath("/profile")}
      className="block rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5 text-left hover:border-teal-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">
            Почти значок
          </p>
          <p className="truncate text-sm font-medium text-teal-950">{hint.title}</p>
          {hint.description ? (
            <p className="mt-0.5 truncate text-xs text-teal-800/80">{hint.description}</p>
          ) : null}
        </div>
        <span className="shrink-0 pt-0.5 text-xs font-bold tabular-nums text-teal-800">
          {hint.current}/{hint.target}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-teal-100">
        <div
          className="h-full rounded-full bg-teal-500/80"
          style={{ width: `${pct}%` }}
        />
      </div>
    </Link>
  );
}
