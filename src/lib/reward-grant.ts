import { prisma } from "@/lib/prisma";
import {
  hashSalt,
  pickRewardKey,
  rewardDef,
  serializeReward,
  type ChestSource,
  type RewardDef,
} from "@/lib/rewards";

export type GrantChestResult = {
  newlyGranted: boolean;
  reward: ReturnType<typeof serializeReward>;
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
    return {
      newlyGranted: false,
      reward: serializeReward(def, {
        unlockedAt: existing.unlockedAt,
        source: existing.source,
        sourceKey: existing.sourceKey,
      }),
    };
  }

  const owned = await prisma.userReward.findMany({
    where: { userId },
    select: { rewardKey: true },
  });
  // Quest-day markers are not cosmetics — exclude from pity / owned cosmetics.
  const cosmeticOwned = owned
    .map((r) => r.rewardKey)
    .filter((k) => !k.startsWith("quest_day"));
  const priorGrantCount = await prisma.userReward.count({
    where: {
      userId,
      NOT: { rewardKey: { startsWith: "quest_day" } },
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

  return {
    newlyGranted: true,
    reward: serializeReward(def, {
      unlockedAt: created.unlockedAt,
      source: created.source,
      sourceKey: created.sourceKey,
    }),
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
