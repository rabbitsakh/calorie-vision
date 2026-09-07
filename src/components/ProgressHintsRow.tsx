"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  nextBadgeHint,
  type BadgeStatsSnapshot,
  type NextBadgeHint,
} from "@/lib/badges";
import { nextMetaProgress } from "@/lib/rewards";
import { withBasePath } from "@/lib/paths";

type ProgressHintsProps = {
  refreshKey: number;
};

/** Quiet combined «next badge / next meta» row for habits sheet. */
export function ProgressHintsRow({ refreshKey }: ProgressHintsProps) {
  const [badge, setBadge] = useState<NextBadgeHint | null>(null);
  const [meta, setMeta] = useState<ReturnType<typeof nextMetaProgress>>(null);

  const load = useCallback(async () => {
    try {
      const [badgesResp, rewardsResp] = await Promise.all([
        fetch(withBasePath("/api/badges")),
        fetch(withBasePath("/api/rewards")),
      ]);
      if (badgesResp.ok) {
        const data = (await badgesResp.json()) as {
          badges: Array<{ key: string; unlocked: boolean }>;
          stats?: BadgeStatsSnapshot;
        };
        if (data.stats) {
          const unlocked = data.badges.filter((b) => b.unlocked).map((b) => b.key);
          setBadge(nextBadgeHint(unlocked, data.stats));
        }
      }
      if (rewardsResp.ok) {
        const data = (await rewardsResp.json()) as { ownedCount?: number };
        setMeta(nextMetaProgress(typeof data.ownedCount === "number" ? data.ownedCount : 0));
      }
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const showBadge = Boolean(badge && badge.ratio > 0);
  const showMeta = Boolean(meta && meta.remaining > 0);
  if (!showBadge && !showMeta) return null;

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {showBadge && badge ? (
        <Link
          href={withBasePath("/profile#rewards")}
          className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2 text-left hover:border-teal-200"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-700">Значок</p>
          <p className="truncate text-sm font-medium text-teal-950">{badge.title}</p>
          <p className="mt-0.5 text-xs tabular-nums text-teal-800">
            {badge.current}/{badge.target}
          </p>
        </Link>
      ) : null}
      {showMeta && meta ? (
        <Link
          href={withBasePath("/profile#rewards")}
          className="rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2 text-left hover:border-amber-200"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">Мета</p>
          <p className="truncate text-sm font-medium text-amber-950">{meta.label}</p>
          <p className="mt-0.5 text-xs tabular-nums text-amber-900">
            {meta.current}/{meta.target}
          </p>
        </Link>
      ) : null}
    </div>
  );
}
