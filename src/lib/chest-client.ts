import { withBasePath } from "@/lib/paths";
import type { ChestSource } from "@/lib/rewards";

export type ChestRewardPayload = {
  key: string;
  title: string;
  description: string;
  rarity?: string;
};

export type OpenChestResult = {
  newlyGranted: boolean;
  reward: ChestRewardPayload | null;
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

export async function openChest(args: OpenChestArgs): Promise<OpenChestResult | null> {
  try {
    const resp = await fetch(withBasePath("/api/rewards"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    });
    if (!resp.ok) return null;
    return (await resp.json()) as OpenChestResult;
  } catch {
    return null;
  }
}
