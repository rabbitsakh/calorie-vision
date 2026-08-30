import { withBasePath } from "@/lib/paths";
import { trackChestOpenedGoal, trackMetaChestGoal } from "@/lib/metrika-funnel";
import type { ChestSource, RewardRarity } from "@/lib/rewards";

export type ChestRewardPayload = {
  key: string;
  title: string;
  description: string;
  rarity?: RewardRarity;
  rarityLabel?: string;
};

export type OpenChestResult = {
  newlyGranted: boolean;
  reward: ChestRewardPayload | null;
  metaRewards?: ChestRewardPayload[];
  questDayCount?: number;
  nextChestIn?: number;
};

type OpenChestArgs = {
  source: ChestSource;
  weekStart?: string;
  challengeKey?: string;
  milestone?: number;
  date?: string;
};

function dispatchMeta(rewards: ChestRewardPayload[]): void {
  if (typeof window === "undefined" || rewards.length === 0) return;
  window.dispatchEvent(new CustomEvent("cv-meta-chest", { detail: rewards }));
}

export async function openChest(args: OpenChestArgs): Promise<OpenChestResult | null> {
  try {
    const resp = await fetch(withBasePath("/api/rewards"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as OpenChestResult;
    if (data.reward) {
      trackChestOpenedGoal();
    }
    if (data.metaRewards && data.metaRewards.length > 0) {
      trackMetaChestGoal();
      dispatchMeta(data.metaRewards);
    }
    return data;
  } catch {
    return null;
  }
}
