import { prisma } from "@/lib/prisma";
import {
  hashSalt,
  pendingMetaMilestones,
  pickMetaRewardKey,
  pickRewardKey,
  rewardDef,
  serializeReward,
  type ChestSource,
  type RewardDef,
} from "@/lib/rewards";

export type GrantChestResult = {
  newlyGranted: boolean;
  reward: ReturnType<typeof serializeReward>;
  metaRewards?: ReturnType<typeof serializeReward>[];
};

function fallbackDef(key: string): RewardDef {
  return {
    key,
    title: "Награда",
    description: "Уже в коллекции",
    rarity: "common",
    group: "sticker",
  };
}

async function loadCosmeticKeys(userId: string): Promise<string[]> {
  const owned = await prisma.userReward.findMany({
    where: { userId },
    select: { rewardKey: true },
  });
  return owned.map((r) => r.rewardKey).filter((k) => !k.startsWith("quest_day"));
}

/**
 * Grant soft meta chests for collection milestones (wave 9).
 * Idempotent per milestone sourceKey.
 */
export async function tryGrantMetaChests(
  userId: string,
): Promise<ReturnType<typeof serializeReward>[]> {
  const rows = await prisma.userReward.findMany({
    where: { userId },
    select: { rewardKey: true, source: true, sourceKey: true },
  });
  const cosmeticKeys = rows
    .map((r) => r.rewardKey)
    .filter((k) => !k.startsWith("quest_day"));
  const metaSourceKeys = rows.filter((r) => r.source === "meta").map((r) => r.sourceKey);
  const milestones = pendingMetaMilestones(cosmeticKeys, metaSourceKeys);
  if (milestones.length === 0) return [];

  const granted: ReturnType<typeof serializeReward>[] = [];
  const owned = new Set(cosmeticKeys);

  for (const milestone of milestones) {
    const rewardKey = pickMetaRewardKey(owned, hashSalt(milestone.sourceKey));
    const def = rewardDef(rewardKey);
    if (!def) continue;

    try {
      const created = await prisma.userReward.create({
        data: {
          userId,
          rewardKey: def.key,
          source: "meta",
          sourceKey: milestone.sourceKey,
        },
      });
      owned.add(def.key);
      granted.push(
        serializeReward(def, {
          unlockedAt: created.unlockedAt,
          source: created.source,
          sourceKey: created.sourceKey,
        }),
      );
    } catch {
      // unique race — already granted
    }
  }

  return granted;
}

/**
 * Idempotent chest grant keyed by sourceKey.
 */
export async function grantChestReward(
  userId: string,
  source: ChestSource,
  sourceKey: string,
  saltInput?: string,
): Promise<GrantChestResult> {
  const existing = await prisma.userReward.findUnique({
    where: { userId_sourceKey: { userId, sourceKey } },
  });
  if (existing) {
    const def = rewardDef(existing.rewardKey) ?? fallbackDef(existing.rewardKey);
    const metaRewards = await tryGrantMetaChests(userId);
    return {
      newlyGranted: false,
      reward: serializeReward(def, {
        unlockedAt: existing.unlockedAt,
        source: existing.source,
        sourceKey: existing.sourceKey,
      }),
      metaRewards: metaRewards.length > 0 ? metaRewards : undefined,
    };
  }

  const cosmeticOwned = await loadCosmeticKeys(userId);
  const priorGrantCount = await prisma.userReward.count({
    where: {
      userId,
      NOT: [
        { rewardKey: { startsWith: "quest_day" } },
        { source: "meta" },
      ],
    },
  });

  const rewardKey = pickRewardKey(cosmeticOwned, hashSalt(saltInput ?? sourceKey), {
    priorGrantCount,
  });
  const def = rewardDef(rewardKey);
  if (!def) {
    throw new Error(`Unknown reward key: ${rewardKey}`);
  }

  const created = await prisma.userReward.create({
    data: {
      userId,
      rewardKey: def.key,
      source,
      sourceKey,
    },
  });

  const metaRewards = await tryGrantMetaChests(userId);

  return {
    newlyGranted: true,
    reward: serializeReward(def, {
      unlockedAt: created.unlockedAt,
      source: created.source,
      sourceKey: created.sourceKey,
    }),
    metaRewards: metaRewards.length > 0 ? metaRewards : undefined,
  };
}

/** Mark a daily quest day complete (idempotent). Returns new total quest-days. */
export async function markQuestDayComplete(
  userId: string,
  date: string,
  sourceKey: string,
): Promise<{ newlyMarked: boolean; questDayCount: number }> {
  const existing = await prisma.userReward.findUnique({
    where: { userId_sourceKey: { userId, sourceKey } },
  });
  if (existing) {
    const questDayCount = await prisma.userReward.count({
      where: { userId, rewardKey: "quest_day" },
    });
    return { newlyMarked: false, questDayCount };
  }

  await prisma.userReward.create({
    data: {
      userId,
      rewardKey: "quest_day",
      source: "quest",
      sourceKey,
    },
  });
  const questDayCount = await prisma.userReward.count({
    where: { userId, rewardKey: "quest_day" },
  });
  return { newlyMarked: true, questDayCount };
}
