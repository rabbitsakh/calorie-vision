"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import {
  isSoftCelebrationSeen,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";
import {
  BADGE_GROUP_LABELS,
  badgeGroup,
  getBadgeProgress,
  nextBadgeHint,
  type BadgeGroupId,
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

const GROUP_ORDER: BadgeGroupId[] = [
  "streak",
  "meals",
  "water",
  "target",
  "weight",
  "challenges",
];

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
  const [stats, setStats] = useState<BadgeStatsSnapshot | null>(null);
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
          setStats(data.stats);
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

  const grouped = useMemo(() => {
    const byGroup = new Map<BadgeGroupId, BadgeItem[]>();
    for (const badge of badges) {
      const group = badgeGroup(badge.key);
      const list = byGroup.get(group) ?? [];
      list.push(badge);
      byGroup.set(group, list);
    }
    return GROUP_ORDER.map((id) => ({
      id,
      label: BADGE_GROUP_LABELS[id],
      items: byGroup.get(id) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [badges]);

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

        <div className="flex flex-col gap-4">
          {grouped.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.items.map((badge) => {
                  const progress =
                    !badge.unlocked && stats
                      ? getBadgeProgress(badge.key, stats)
                      : null;
                  const pct = progress
                    ? Math.min(100, Math.round((progress.current / progress.target) * 100))
                    : badge.unlocked
                      ? 100
                      : 0;
                  return (
                    <div
                      key={badge.key}
                      className={`rounded-xl border px-3 py-2.5 ${
                        badge.unlocked
                          ? "border-teal-200 bg-teal-50"
                          : "border-slate-100 bg-slate-50"
                      }`}
                    >
                      <p
                        className={`text-sm font-semibold ${
                          badge.unlocked ? "text-teal-900" : "text-slate-600"
                        }`}
                      >
                        {badge.title}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">{badge.description}</p>
                      {progress ? (
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] font-medium tabular-nums text-slate-500">
                            <span>
                              {progress.current}/{progress.target}
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-teal-500/80"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
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
