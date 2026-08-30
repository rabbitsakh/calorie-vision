/**
 * Chest loot catalog — soft cosmetics, no gems / leagues.
 */

export type RewardRarity = "common" | "rare" | "festive";
export type RewardGroup = "sticker" | "cheer" | "frame";
export type ChestSource = "challenge" | "streak" | "week" | "quest";

export type RewardDef = {
  key: string;
  title: string;
  description: string;
  rarity: RewardRarity;
  group: RewardGroup;
};

/** Soft pity: after this many grants without rare+, force rare/festive. */
export const PITY_CHEST_EVERY = 4;

/** Quest-days between quest chests (wave 4). */
export const QUEST_DAYS_PER_CHEST = 3;

export const REWARD_GROUP_LABELS: Record<RewardGroup, string> = {
  sticker: "Наклейки",
  cheer: "Фразы маскота",
  frame: "Рамки",
};

export const RARITY_LABELS: Record<RewardRarity, string> = {
  common: "Обычная",
  rare: "Редкая",
  festive: "Праздничная",
};

export const REWARD_DEFS: RewardDef[] = [
  {
    key: "sticker_sprout",
    title: "Росток",
    description: "Наклейка: маленький росток в дневнике",
    rarity: "common",
    group: "sticker",
  },
  {
    key: "sticker_cup",
    title: "Чашка воды",
    description: "Наклейка: вода — тоже победа",
    rarity: "common",
    group: "sticker",
  },
  {
    key: "sticker_sunrise",
    title: "Утренний свет",
    description: "Наклейка: за завтраки без спешки",
    rarity: "common",
    group: "sticker",
  },
  {
    key: "sticker_plate",
    title: "Тёплая тарелка",
    description: "Наклейка: за спокойный обед",
    rarity: "common",
    group: "sticker",
  },
  {
    key: "sticker_moon",
    title: "Мягкий вечер",
    description: "Наклейка: день закрыт без давления",
    rarity: "common",
    group: "sticker",
  },
  {
    key: "cheer_steady",
    title: "Ровный ход",
    description: "Фраза маскота: «Главное — ритм, не идеал»",
    rarity: "rare",
    group: "cheer",
  },
  {
    key: "cheer_week",
    title: "Неделя в копилку",
    description: "Фраза маскота: «Ещё одна спокойная неделя»",
    rarity: "rare",
    group: "cheer",
  },
  {
    key: "cheer_streak",
    title: "Серия жива",
    description: "Фраза маскота: «Мы продолжаем — этого достаточно»",
    rarity: "rare",
    group: "cheer",
  },
  {
    key: "frame_teal",
    title: "Бирюзовая рамка",
    description: "Мягкая рамка для аватара",
    rarity: "rare",
    group: "frame",
  },
  {
    key: "frame_amber",
    title: "Янтарная рамка",
    description: "Тёплая рамка за долгую серию",
    rarity: "festive",
    group: "frame",
  },
  {
    key: "cheer_festive",
    title: "Праздничный настрой",
    description: "Фраза маскота: «Сегодня можно улыбнуться чуть шире»",
    rarity: "festive",
    group: "cheer",
  },
];

const BY_KEY = new Map(REWARD_DEFS.map((r) => [r.key, r]));

export function rewardDef(key: string): RewardDef | undefined {
  return BY_KEY.get(key);
}

export function challengeChestSourceKey(weekStart: string, challengeKey: string): string {
  return `challenge:${weekStart}:${challengeKey}`;
}

export function streakChestSourceKey(milestone: number): string {
  return `streak:${milestone}`;
}

export function weekChestSourceKey(weekStart: string): string {
  return `week:${weekStart}`;
}

export function questDaySourceKey(date: string): string {
  return `quest-day:${date}`;
}

export function questChestSourceKey(batchIndex: number): string {
  return `quest-chest:${batchIndex}`;
}

export type PickRewardOptions = {
  /** Total prior chest grants (for pity). */
  priorGrantCount?: number;
  /** Force rare+ when pity triggers. */
  pityEvery?: number;
};

function isRarePlus(def: RewardDef): boolean {
  return def.rarity === "rare" || def.rarity === "festive";
}

/**
 * Prefer unowned; apply soft pity for rare+; recycle when catalog complete.
 */
export function pickRewardKey(
  ownedKeys: Iterable<string>,
  salt = 0,
  opts: PickRewardOptions = {},
): string {
  const owned = new Set(ownedKeys);
  const pityEvery = opts.pityEvery ?? PITY_CHEST_EVERY;
  const prior = opts.priorGrantCount ?? 0;
  const pityHits = pityEvery > 0 && (prior + 1) % pityEvery === 0;

  let pool = REWARD_DEFS.filter((r) => !owned.has(r.key));
  if (pool.length === 0) {
    pool = [...REWARD_DEFS];
  }

  if (pityHits) {
    const rarePool = pool.filter(isRarePlus);
    if (rarePool.length > 0) {
      return rarePool[Math.abs(salt) % rarePool.length]!.key;
    }
  }

  return pool[Math.abs(salt) % pool.length]!.key;
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
    group: def.group,
    rarityLabel: RARITY_LABELS[def.rarity],
    groupLabel: REWARD_GROUP_LABELS[def.group],
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

export function hashSalt(input: string): number {
  return input.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}
