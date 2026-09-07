"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { nextMetaProgress } from "@/lib/rewards";
import { withBasePath } from "@/lib/paths";

type NextMetaChipProps = {
  refreshKey: number;
};

/** Quiet «ещё N до мета-сундука» on ration habits. */
export function NextMetaChip({ refreshKey }: NextMetaChipProps) {
  const [hint, setHint] = useState<ReturnType<typeof nextMetaProgress>>(null);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/rewards"));
      if (!resp.ok) return;
      const data = (await resp.json()) as { ownedCount?: number };
      const owned = typeof data.ownedCount === "number" ? data.ownedCount : 0;
      setHint(nextMetaProgress(owned));
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!hint || hint.remaining <= 0) return null;

  const pct = Math.min(100, Math.round(hint.ratio * 100));

  return (
    <Link
      href={withBasePath("/profile")}
      className="block rounded-xl border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-left hover:border-amber-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
            Мета-сундук
          </p>
          <p className="truncate text-sm font-medium text-amber-950">{hint.label}</p>
          <p className="mt-0.5 truncate text-xs text-amber-900/75">
            Коллекция {hint.current} из {hint.target}
          </p>
        </div>
        <span className="shrink-0 pt-0.5 text-xs font-bold tabular-nums text-amber-900">
          {hint.current}/{hint.target}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-100">
        <div className="h-full rounded-full bg-amber-500/80" style={{ width: `${pct}%` }} />
      </div>
    </Link>
  );
}
