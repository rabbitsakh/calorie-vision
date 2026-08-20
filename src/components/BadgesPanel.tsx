"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";

type BadgeItem = {
  key: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string | null;
  newlyUnlocked: boolean;
};

export function BadgesPanel() {
  const [badges, setBadges] = useState<BadgeItem[]>([]);
  const [toast, setToast] = useState<BadgeItem | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/badges"));
        if (!resp.ok) return;
        const data = (await resp.json()) as { badges: BadgeItem[]; newlyUnlocked: BadgeItem[] };
        setBadges(data.badges);
        if (data.newlyUnlocked?.[0]) {
          setToast(data.newlyUnlocked[0]!);
          setTimeout(() => setToast(null), 4000);
        }
      } catch {
        // non-critical
      }
    })();
  }, []);

  if (badges.length === 0) return null;

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-800">Достижения</h2>
        <span className="text-xs text-slate-500">
          {unlockedCount} / {badges.length}
        </span>
      </div>
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

      {toast ? (
        <div className="fixed bottom-20 left-1/2 z-50 w-[min(90vw,22rem)] -translate-x-1/2 rounded-2xl border border-teal-200 bg-teal-900 px-4 py-3 text-center text-sm text-white shadow-lg">
          Новое достижение: <span className="font-semibold">{toast.title}</span>
        </div>
      ) : null}
    </div>
  );
}
