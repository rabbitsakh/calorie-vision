"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  REWARD_GROUP_LABELS,
  type RewardGroup,
  type RewardRarity,
} from "@/lib/rewards";
import { withBasePath } from "@/lib/paths";

type RewardItem = {
  key: string;
  title: string;
  description: string;
  rarity: RewardRarity;
  group: RewardGroup;
  rarityLabel: string;
  unlocked: boolean;
  unlockedAt: string | null;
};

const GROUP_ORDER: RewardGroup[] = ["sticker", "cheer", "frame"];

const RARITY_TONE: Record<RewardRarity, string> = {
  common: "border-slate-100 bg-slate-50 text-slate-700",
  rare: "border-teal-200 bg-teal-50 text-teal-900",
  festive: "border-amber-200 bg-amber-50 text-amber-950",
};

/**
 * Profile collection of chest cosmetics (wave 2).
 */
export function RewardsPanel() {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [ownedCount, setOwnedCount] = useState(0);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/rewards"));
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        rewards: RewardItem[];
        ownedCount: number;
        total: number;
      };
      setRewards(data.rewards);
      setOwnedCount(data.ownedCount);
      setTotal(data.total);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((id) => ({
      id,
      label: REWARD_GROUP_LABELS[id],
      items: rewards.filter((r) => r.group === id),
    })).filter((g) => g.items.length > 0);
  }, [rewards]);

  if (rewards.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-800">Коллекция</h2>
        <span className="text-xs text-slate-500">
          {ownedCount} / {total}
        </span>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Награды из сундуков — за челленджи, серии и спокойные недели. Без штрафов.
      </p>

      <div className="flex flex-col gap-4">
        {grouped.map((group) => (
          <div key={group.id}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {group.label}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {group.items.map((reward) => (
                <div
                  key={reward.key}
                  className={`rounded-xl border px-3 py-2.5 ${
                    reward.unlocked
                      ? RARITY_TONE[reward.rarity]
                      : "border-slate-100 bg-slate-50/80 text-slate-400"
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    {reward.rarityLabel}
                  </p>
                  <p className={`text-sm font-semibold ${reward.unlocked ? "" : "opacity-70"}`}>
                    {reward.unlocked ? reward.title : "???"}
                  </p>
                  <p className="mt-0.5 text-xs opacity-80">
                    {reward.unlocked ? reward.description : "Откроется из сундука"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
