import { withBasePath } from "@/lib/paths";
import { notifyChestInbox } from "@/lib/chest-inbox";
import { isLikelyOfflineError } from "@/lib/connectivity";
import { trackChestOpenedGoal, trackMetaChestGoal } from "@/lib/metrika-funnel";
import type { ChestMeterModel } from "@/lib/chest-progress";
import { enqueueRewardsDraft } from "@/lib/rewards-draft-queue";
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
  readyCount?: number;
  openedQuestChests?: number;
  chest?: ChestMeterModel;
  /** C4 — calm-day mark also got a gym/evening boost credit. */
  boosted?: boolean;
  boostKind?: "gym" | "evening" | null;
  /** Wave R/O — POST queued until online. */
  queuedOffline?: boolean;
};

type OpenChestArgs = {
  /** `next` — open head of C3 unified ready queue (ChestDock). */
  source: ChestSource | "next";
  /** Quest: mark calm day (default) or open a ready chest. */
  action?: "mark" | "open";
  weekStart?: string;
  challengeKey?: string;
  milestone?: number;
  date?: string;
};

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
  } catch (err) {
    // Wave R/O — don't drop mark/open silently when the APK is offline.
    if (isLikelyOfflineError(err)) {
      enqueueRewardsDraft({
        source: args.source,
        action: args.action,
        date: args.date,
        weekStart: args.weekStart,
        challengeKey: args.challengeKey,
        milestone: args.milestone,
      });
      return {
        newlyGranted: false,
        reward: null,
        queuedOffline: true,
      };
    }
    return null;
  }
}

/**
 * Fire buffered meta-chest celebrations (after primary CTA / dismiss).
 * C4 — always inbox (no competing fullscreen MetaChestCelebration).
 */
export function flushPendingMetaChests(): void {
  hydratePendingMetaChests();
  if (pendingMeta.length === 0) return;
  const batch = pendingMeta;
  pendingMeta = [];
  persistPending();

  for (const reward of batch) {
    notifyChestInbox({
      title: reward.title,
      subtitle: reward.description || "Мета-сундук · в коллекции",
      rewardKey: reward.key,
    });
  }
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
