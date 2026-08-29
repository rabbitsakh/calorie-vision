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
      className="flex items-center justify-between gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2 text-left hover:border-teal-200"
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Близко</p>
        <p className="truncate text-sm font-medium text-teal-950">{hint.title}</p>
      </div>
      <span className="shrink-0 text-xs font-bold tabular-nums text-teal-800">
        {hint.current}/{hint.target} · {pct}%
      </span>
    </Link>
  );
}
