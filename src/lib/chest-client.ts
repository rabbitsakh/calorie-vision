import { withBasePath } from "@/lib/paths";
import { notifyChestInbox } from "@/lib/chest-inbox";
import { trackChestOpenedGoal, trackMetaChestGoal } from "@/lib/metrika-funnel";
import { isSoftCelebrationQuietBlocked } from "@/lib/soft-celebration";
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
const PENDING_META_KEY = "cv-pending-meta-chests";

let pendingMeta: ChestRewardPayload[] = [];
let hydrated = false;

function getSessionStorage(): Storage | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}

function normalizeMeta(rewards: ChestRewardPayload[] | undefined): ChestRewardPayload[] {
  if (!rewards || rewards.length === 0) return [];
  return rewards.filter((r) => Boolean(r?.key));
}

function readPendingFromStorage(): ChestRewardPayload[] {
  const storage = getSessionStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(PENDING_META_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return normalizeMeta(parsed as ChestRewardPayload[]);
  } catch {
    return [];
  }
}

function writePendingToStorage(items: ChestRewardPayload[]): void {
  const storage = getSessionStorage();
  if (!storage) return;
  try {
    if (items.length === 0) {
      storage.removeItem(PENDING_META_KEY);
    } else {
      storage.setItem(PENDING_META_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore quota / private mode
  }
}

/** Merge sessionStorage into memory once (R1e — survive tab navigation). */
export function hydratePendingMetaChests(): void {
  if (hydrated) return;
  hydrated = true;
  const stored = readPendingFromStorage();
  if (stored.length === 0) return;
  const keys = new Set(pendingMeta.map((r) => r.key));
  for (const item of stored) {
    if (!keys.has(item.key)) {
      pendingMeta.push(item);
      keys.add(item.key);
    }
  }
}

function persistPending(): void {
  writePendingToStorage(pendingMeta);
}

function dispatchMeta(rewards: ChestRewardPayload[]): void {
  if (typeof window === "undefined" || rewards.length === 0) return;
  window.dispatchEvent(new CustomEvent(META_EVENT, { detail: rewards }));
}

/**
 * Open a chest via API. Meta rewards are buffered until
 * {@link flushPendingMetaChests} (call after the primary celebration closes).
 */
export async function openChest(args: OpenChestArgs): Promise<OpenChestResult | null> {
  hydratePendingMetaChests();
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
      persistPending();
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Fire buffered meta-chest celebrations (after primary CTA / dismiss).
 * Under quiet mode → inbox toasts instead of fullscreen (R1a + R1e).
 */
export function flushPendingMetaChests(): void {
  hydratePendingMetaChests();
  if (pendingMeta.length === 0) return;
  const batch = pendingMeta;
  pendingMeta = [];
  persistPending();

  if (isSoftCelebrationQuietBlocked()) {
    for (const reward of batch) {
      notifyChestInbox({
        title: reward.title,
        subtitle: reward.description || "Мета-сундук · в коллекции",
        rewardKey: reward.key,
      });
    }
    return;
  }

  dispatchMeta(batch);
}

/**
 * Present a primary chest reward: fullscreen path via callback, or quiet inbox (R1a/R2).
 * Always flushes meta after quiet inbox; fullscreen callers flush on dismiss.
 */
export function presentChestGrant(
  reward: ChestRewardPayload | null | undefined,
  opts: {
    quiet: boolean;
    muted?: boolean;
    fallbackTitle: string;
    fallbackSubtitle?: string;
    onFullscreen: (reward: ChestRewardPayload) => void;
  },
): void {
  if (!reward) {
    if (!opts.muted) flushPendingMetaChests();
    return;
  }

  if (opts.muted) {
    flushPendingMetaChests();
    return;
  }

  if (opts.quiet) {
    notifyChestInbox({
      title: reward.title || opts.fallbackTitle,
      subtitle: reward.description || opts.fallbackSubtitle || "В коллекции · Профиль",
      rewardKey: reward.key,
    });
    flushPendingMetaChests();
    return;
  }

  opts.onFullscreen(reward);
}

/** Test helper — clear buffered meta without dispatching. */
export function resetPendingMetaChestsForTests(): void {
  pendingMeta = [];
  hydrated = false;
  writePendingToStorage([]);
}
