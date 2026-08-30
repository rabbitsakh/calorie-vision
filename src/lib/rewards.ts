/**
 * Chest loot catalog — soft cosmetics, no gems / leagues.
 */

export type RewardRarity = "common" | "rare" | "festive";
export type RewardGroup = "sticker" | "cheer" | "frame";
export type ChestSource = "challenge" | "streak" | "week" | "quest" | "meta";

export type RewardDef = {
  key: string;
  title: string;
  description: string;
  rarity: RewardRarity;
  group: RewardGroup;
  /** Only granted from collection meta chests (wave 9). */
  metaOnly?: boolean;
};

/** Soft pity: after this many grants without rare+, force rare/festive. */
export const PITY_CHEST_EVERY = 4;

/** Quest-days between quest chests (wave 4). */
export const QUEST_DAYS_PER_CHEST = 3;

/** Soft collection milestones that unlock a meta chest (wave 9). */
export const META_OWNED_THRESHOLDS = [5, 10, 15] as const;

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

/** CSS ring classes for equipped avatar frames (wave 8). */
export function frameAvatarClass(key: string | null | undefined): string {
  if (!key) return "";
  const map: Record<string, string> = {
    frame_teal: "cv-avatar-frame cv-avatar-frame-teal",
    frame_amber: "cv-avatar-frame cv-avatar-frame-amber",
    frame_mint: "cv-avatar-frame cv-avatar-frame-mint",
    frame_sky: "cv-avatar-frame cv-avatar-frame-sky",
    frame_fest: "cv-avatar-frame cv-avatar-frame-fest",
  };
  return map[key] ?? "";
}

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
    key: "sticker_leaf",
    title: "Листок",
    description: "Наклейка: ещё один спокойный шаг",
    rarity: "common",
    group: "sticker",
  },
  {
    key: "sticker_berry",
    title: "Ягодка",
    description: "Наклейка: маленькая радость в дневнике",
    rarity: "common",
    group: "sticker",
  },
  {
    key: "sticker_steam",
    title: "Тёплый пар",
    description: "Наклейка: за уютный горячий напиток",
    rarity: "common",
    group: "sticker",
  },
  {
    key: "sticker_path",
    title: "Тропинка",
    description: "Наклейка: путь важнее скорости",
    rarity: "rare",
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
    key: "cheer_sip",
    title: "Глоток спокойствия",
    description: "Фраза маскота: «Вода — тоже забота о себе»",
    rarity: "common",
    group: "cheer",
  },
  {
    key: "cheer_gentle",
    title: "Мягкий старт",
    description: "Фраза маскота: «Можно начать с малого»",
    rarity: "common",
    group: "cheer",
  },
  {
    key: "cheer_festive",
    title: "Праздничный настрой",
    description: "Фраза маскота: «Сегодня можно улыбнуться чуть шире»",
    rarity: "festive",
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
    key: "frame_mint",
    title: "Мятная рамка",
    description: "Свежая рамка для аватара",
    rarity: "rare",
    group: "frame",
  },
  {
    key: "frame_sky",
    title: "Небесная рамка",
    description: "Лёгкая голубая рамка",
    rarity: "common",
    group: "frame",
  },
  {
    key: "cheer_collector",
    title: "Коллекционер",
    description: "Фраза маскота: «Смотри, какая копилка!»",
    rarity: "festive",
    group: "cheer",
    metaOnly: true,
  },
  {
    key: "sticker_star",
    title: "Звезда коллекции",
    description: "Наклейка: за полный набор группы",
    rarity: "festive",
    group: "sticker",
    metaOnly: true,
  },
  {
    key: "frame_fest",
    title: "Праздничная рамка",
    description: "Сияющая рамка за всю коллекцию",
    rarity: "festive",
    group: "frame",
    metaOnly: true,
  },
];

const BY_KEY = new Map(REWARD_DEFS.map((r) => [r.key, r]));

export function rewardDef(key: string): RewardDef | undefined {
  return BY_KEY.get(key);
}

/** Regular chest pool — excludes meta-only cosmetics. */
export function chestPoolDefs(): RewardDef[] {
  return REWARD_DEFS.filter((r) => !r.metaOnly);
}

export function metaPoolDefs(): RewardDef[] {
  return REWARD_DEFS.filter((r) => r.metaOnly);
}

export function isFrameReward(key: string): boolean {
  return rewardDef(key)?.group === "frame";
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

export function metaCountSourceKey(threshold: number): string {
  return `meta:count:${threshold}`;
}

export function metaGroupSourceKey(group: RewardGroup): string {
  return `meta:group:${group}`;
}

export function metaCatalogSourceKey(): string {
  return "meta:catalog";
}

export type PickRewardOptions = {
  /** Total prior chest grants (for pity). */
  priorGrantCount?: number;
  /** Force rare+ when pity triggers. */
  pityEvery?: number;
  /** Include meta-only items in the pool. */
  includeMetaOnly?: boolean;
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
  const catalog = opts.includeMetaOnly ? REWARD_DEFS : chestPoolDefs();

  let pool = catalog.filter((r) => !owned.has(r.key));
  if (pool.length === 0) {
    pool = [...catalog];
  }

  if (pityHits) {
    const rarePool = pool.filter(isRarePlus);
    if (rarePool.length > 0) {
      return rarePool[Math.abs(salt) % rarePool.length]!.key;
    }
  }

  return pool[Math.abs(salt) % pool.length]!.key;
}

/** Prefer unowned meta-only; fall back to any unowned festive, then recycle. */
export function pickMetaRewardKey(ownedKeys: Iterable<string>, salt = 0): string {
  const owned = new Set(ownedKeys);
  const metaPool = metaPoolDefs().filter((r) => !owned.has(r.key));
  if (metaPool.length > 0) {
    return metaPool[Math.abs(salt) % metaPool.length]!.key;
  }
  const festive = chestPoolDefs().filter((r) => r.rarity === "festive" && !owned.has(r.key));
  if (festive.length > 0) {
    return festive[Math.abs(salt) % festive.length]!.key;
  }
  return pickRewardKey(ownedKeys, salt, { includeMetaOnly: true });
}

export type MetaMilestone = {
  sourceKey: string;
  label: string;
};

/**
 * Soft collection milestones still available for this ownership set.
 * `alreadyGranted` = meta sourceKeys already stored on UserReward.
 */
export function pendingMetaMilestones(
  ownedCosmeticKeys: Iterable<string>,
  alreadyGranted: Iterable<string>,
): MetaMilestone[] {
  const owned = new Set(ownedCosmeticKeys);
  const granted = new Set(alreadyGranted);
  const pending: MetaMilestone[] = [];

  const regularOwned = [...owned].filter((k) => {
    const def = rewardDef(k);
    return def && !def.metaOnly;
  });

  for (const threshold of META_OWNED_THRESHOLDS) {
    const key = metaCountSourceKey(threshold);
    if (regularOwned.length >= threshold && !granted.has(key)) {
      pending.push({ sourceKey: key, label: `${threshold} наград в коллекции` });
    }
  }

  for (const group of Object.keys(REWARD_GROUP_LABELS) as RewardGroup[]) {
    const groupKeys = chestPoolDefs().filter((r) => r.group === group).map((r) => r.key);
    if (groupKeys.length === 0) continue;
    const complete = groupKeys.every((k) => owned.has(k));
    const key = metaGroupSourceKey(group);
    if (complete && !granted.has(key)) {
      pending.push({
        sourceKey: key,
        label: `Набор «${REWARD_GROUP_LABELS[group]}» собран`,
      });
    }
  }

  const catalogKeys = chestPoolDefs().map((r) => r.key);
  const catalogKey = metaCatalogSourceKey();
  if (catalogKeys.every((k) => owned.has(k)) && !granted.has(catalogKey)) {
    pending.push({ sourceKey: catalogKey, label: "Вся коллекция собрана" });
  }

  return pending;
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
    metaOnly: Boolean(def.metaOnly),
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
