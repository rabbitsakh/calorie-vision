"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  REWARD_GROUP_LABELS,
  RARITY_LABELS,
  frameAvatarClass,
  isFrameReward,
  type RewardGroup,
  type RewardRarity,
} from "@/lib/rewards";
import {
  getEquippedFrameKey,
  setEquippedFrameKey,
  subscribeEquippedFrame,
} from "@/lib/equipped-frame";
import { trackFrameEquippedGoal } from "@/lib/metrika-funnel";
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
  metaOnly?: boolean;
};

type FilterId = "all" | "owned" | "locked" | RewardRarity | RewardGroup;

const GROUP_ORDER: RewardGroup[] = ["sticker", "cheer", "frame"];

const RARITY_TONE: Record<RewardRarity, string> = {
  common: "border-slate-100 bg-slate-50 text-slate-700",
  rare: "border-teal-200 bg-teal-50 text-teal-900",
  festive: "border-amber-200 bg-amber-50 text-amber-950",
};

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "owned", label: "Открытые" },
  { id: "locked", label: "Закрытые" },
  { id: "common", label: RARITY_LABELS.common },
  { id: "rare", label: RARITY_LABELS.rare },
  { id: "festive", label: RARITY_LABELS.festive },
  { id: "sticker", label: REWARD_GROUP_LABELS.sticker },
  { id: "cheer", label: REWARD_GROUP_LABELS.cheer },
  { id: "frame", label: REWARD_GROUP_LABELS.frame },
];

/**
 * Profile collection of chest cosmetics (waves 2 + 7–8).
 */
export function RewardsPanel() {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [ownedCount, setOwnedCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<FilterId>("all");
  const [equipped, setEquipped] = useState<string | null>(null);

  useEffect(() => {
    setEquipped(getEquippedFrameKey());
    return subscribeEquippedFrame(setEquipped);
  }, []);

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

  const filtered = useMemo(() => {
    return rewards.filter((r) => {
      if (filter === "all") return true;
      if (filter === "owned") return r.unlocked;
      if (filter === "locked") return !r.unlocked;
      if (filter === "common" || filter === "rare" || filter === "festive") {
        return r.rarity === filter;
      }
      return r.group === filter;
    });
  }, [rewards, filter]);

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((id) => ({
      id,
      label: REWARD_GROUP_LABELS[id],
      items: filtered.filter((r) => r.group === id),
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  function toggleEquip(key: string) {
    if (!isFrameReward(key)) return;
    const next = equipped === key ? null : key;
    setEquippedFrameKey(next);
    setEquipped(next);
    if (next) trackFrameEquippedGoal();
  }

  if (rewards.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold text-slate-800">Коллекция</h2>
        <span className="text-xs text-slate-500">
          {ownedCount} / {total}
        </span>
      </div>
      <p className="mb-3 text-sm text-slate-500">
        Награды из сундуков — за челленджи, серии и спокойные недели. Без штрафов.
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5" role="toolbar" aria-label="Фильтр коллекции">
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={active}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                active
                  ? "bg-teal-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-slate-500">По этому фильтру пока пусто.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.items.map((reward) => {
                  const isFrame = reward.group === "frame";
                  const isEquipped = equipped === reward.key;
                  return (
                    <div
                      key={reward.key}
                      className={`rounded-xl border px-3 py-2.5 ${
                        reward.unlocked
                          ? RARITY_TONE[reward.rarity]
                          : "border-slate-100 bg-slate-50/80 text-slate-400"
                      }`}
                    >
                      {isFrame && reward.unlocked ? (
                        <div
                          className={`mb-2 mx-auto h-10 w-10 rounded-full bg-slate-200 ${frameAvatarClass(reward.key)}`}
                          aria-hidden
                        />
                      ) : null}
                      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                        {reward.rarityLabel}
                        {reward.metaOnly ? " · мета" : ""}
                      </p>
                      <p className={`text-sm font-semibold ${reward.unlocked ? "" : "opacity-70"}`}>
                        {reward.unlocked ? reward.title : "???"}
                      </p>
                      <p className="mt-0.5 text-xs opacity-80">
                        {reward.unlocked ? reward.description : "Откроется из сундука"}
                      </p>
                      {isFrame && reward.unlocked ? (
                        <button
                          type="button"
                          className={`mt-2 w-full rounded-lg px-2 py-1 text-xs font-semibold ${
                            isEquipped
                              ? "bg-teal-700 text-white"
                              : "bg-white/80 text-teal-800 ring-1 ring-teal-200"
                          }`}
                          onClick={() => toggleEquip(reward.key)}
                        >
                          {isEquipped ? "Надета" : "Надеть"}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
