"use client";

import { useCallback, useEffect, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import {
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";
import {
  nextBadgeHint,
  type BadgeStatsSnapshot,
  type NextBadgeHint,
} from "@/lib/badges";
import { unlockPendingBadges } from "@/lib/badge-unlock-client";
import { withBasePath } from "@/lib/paths";
import { toDateKey } from "@/lib/dates";

type BadgeItem = {
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
  newlyUnlocked: boolean;
};

function NextBadgeSection({ hint }: { hint: NextBadgeHint }) {
  const pct = Math.min(100, Math.round(hint.ratio * 100));
  return (
    <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
        Следующий значок
      </p>
      <p className="mt-1 text-sm font-semibold text-teal-950">{hint.title}</p>
      <p className="mt-0.5 text-xs text-teal-800">{hint.description}</p>
      <div className="mt-2 flex items-center justify-between text-xs font-medium text-teal-900">
        <span className="tabular-nums">
          {hint.current} / {hint.target}
        </span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-teal-200/90"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`До следующего значка: ${pct}%`}
      >
        <div
          className="h-full rounded-full bg-teal-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function BadgesPanel() {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [nextHint, setNextHint] = useState<NextBadgeHint | null>(null);
  const [unlock, setUnlock] = useState<BadgeItem | null>(null);
  const todayKey = toDateKey(new Date());

  const closeUnlock = useCallback(() => setUnlock(null), []);

  useEffect(() => {
    void (async () => {
      try {
        const { newlyUnlocked, ok } = await unlockPendingBadges();
        const listResp = await fetch(withBasePath("/api/badges"));
        if (!listResp.ok) return;
        const data = (await listResp.json()) as {
          badges: BadgeItem[];
          stats?: BadgeStatsSnapshot;
        };
        setBadges(data.badges);
        if (data.stats) {
          setNextHint(
            nextBadgeHint(
              data.badges.filter((b) => b.unlocked).map((b) => b.key),
              data.stats,
            ),
          );
        }

        if (!ok) return;
        const next = newlyUnlocked[0];
        if (!next) return;
        if (isSoftCelebrationSeen("badge-unlock", next.key)) return;
        markSoftCelebrationSeen("badge-unlock", next.key);
        setUnlock({
          key: next.key,
          title: next.title,
          description: next.description,
          unlocked: true,
          unlockedAt: null,
          newlyUnlocked: true,
        });
      } catch {
        // non-critical
      }
    })();
  }, []);

  if (badges.length === 0) return null;

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-800">Достижения</h2>
          <span className="text-xs text-slate-500">
            {unlockedCount} / {badges.length}
          </span>
        </div>

        {nextHint ? <NextBadgeSection hint={nextHint} /> : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {badges.map((badge) => (
            <div
              key={badge.key}
              className={`rounded-xl border px-3 py-2.5 ${
                badge.unlocked
                  ? "border-teal-200 bg-teal-50"
                  : "border-slate-100 bg-slate-50 opacity-60"
              }`}
            >
              <p className={`text-sm font-semibold ${badge.unlocked ? "text-teal-900" : "text-slate-500"}`}>
                {badge.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{badge.description}</p>
            </div>
          ))}
        </div>
      </div>

      <SoftCelebration
        open={unlock != null}
        variant="badge"
        pose="cheer"
        title={unlock?.title ?? "Новое достижение!"}
        subtitle={unlock?.description}
        badge="★"
        durationMs={0}
        ctaLabel="Круто!"
        muteDate={todayKey}
        onClose={closeUnlock}
      />
    </>
  );
}
