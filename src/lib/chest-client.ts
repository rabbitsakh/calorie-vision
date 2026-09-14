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

const META_EVENT = "cv-meta-chest";

let pendingMeta: ChestRewardPayload[] = [];

function dispatchMeta(rewards: ChestRewardPayload[]): void {
  if (typeof window === "undefined" || rewards.length === 0) return;
  window.dispatchEvent(new CustomEvent(META_EVENT, { detail: rewards }));
}

function normalizeMeta(rewards: ChestRewardPayload[] | undefined): ChestRewardPayload[] {
  if (!rewards || rewards.length === 0) return [];
  return rewards.filter((r) => Boolean(r?.key));
}

/**
 * Open a chest via API. Meta rewards are buffered until
 * {@link flushPendingMetaChests} (call after the primary celebration closes).
 */
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
    const meta = normalizeMeta(data.metaRewards);
    if (meta.length > 0) {
      trackMetaChestGoal();
      pendingMeta = pendingMeta.concat(meta);
    }
    return data;
  } catch {
    return null;
  }
}

/** Fire buffered meta-chest celebrations (after primary CTA / dismiss). */
export function flushPendingMetaChests(): void {
  if (pendingMeta.length === 0) return;
  const batch = pendingMeta;
  pendingMeta = [];
  dispatchMeta(batch);
}

/** Test helper — clear buffered meta without dispatching. */
export function resetPendingMetaChestsForTests(): void {
  pendingMeta = [];
}
