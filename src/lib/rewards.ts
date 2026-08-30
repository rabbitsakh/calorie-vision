/**
 * Chest loot catalog (wave 1) — soft cosmetic rewards, no gems / leagues.
 */

export type RewardRarity = "common" | "rare" | "festive";

export type RewardDef = {
  key: string;
  title: string;
  description: string;
  rarity: RewardRarity;
};

/** Wave-1 pool: stickers / cheer lines revealed from challenge chests. */
export const REWARD_DEFS: RewardDef[] = [
  {
    key: "sticker_sprout",
    title: "Росток",
    description: "Наклейка: маленький росток в дневнике",
    rarity: "common",
  },
  {
    key: "sticker_cup",
    title: "Чашка воды",
    description: "Наклейка: вода — тоже победа",
    rarity: "common",
  },
  {
    key: "sticker_sunrise",
    title: "Утренний свет",
    description: "Наклейка: за завтраки без спешки",
    rarity: "common",
  },
  {
    key: "cheer_steady",
    title: "Ровный ход",
    description: "Фраза маскота: «Главное — ритм, не идеал»",
    rarity: "rare",
  },
  {
    key: "cheer_week",
    title: "Неделя в копилку",
    description: "Фраза маскота: «Ещё одна спокойная неделя»",
    rarity: "rare",
  },
];

const BY_KEY = new Map(REWARD_DEFS.map((r) => [r.key, r]));

export function rewardDef(key: string): RewardDef | undefined {
  return BY_KEY.get(key);
}

export function challengeChestSourceKey(weekStart: string, challengeKey: string): string {
  return `challenge:${weekStart}:${challengeKey}`;
}

/**
 * Prefer an unowned cosmetic; if the user has everything, recycle by stable index.
 */
export function pickRewardKey(ownedKeys: Iterable<string>, salt = 0): string {
  const owned = new Set(ownedKeys);
  const fresh = REWARD_DEFS.filter((r) => !owned.has(r.key));
  if (fresh.length > 0) {
    return fresh[Math.abs(salt) % fresh.length]!.key;
  }
  return REWARD_DEFS[Math.abs(salt) % REWARD_DEFS.length]!.key;
}

export function serializeReward(
  def: RewardDef,
  meta?: { unlockedAt?: string | Date | null; source?: string; sourceKey?: string },
) {
  return {
    key: def.key,
    title: def.title,
    description: def.description,
    rarity: def.rarity,
    unlocked: Boolean(meta?.unlockedAt),
    unlockedAt: meta?.unlockedAt
      ? typeof meta.unlockedAt === "string"
        ? meta.unlockedAt
        : meta.unlockedAt.toISOString()
      : null,
    source: meta?.source ?? null,
    sourceKey: meta?.sourceKey ?? null,
  };
}
