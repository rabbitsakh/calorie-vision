/**
 * Collection sets. Dust and exchange are pure so tests do not need a database.
 * Seasonal items are not required to finish a set and never become dust.
 */

import type { LeafRarity } from "@/lib/leaf-chest";

export type CollectionRarity = "common" | "rare" | "epic" | "legendary";
export type CollectionGroup = "sticker" | "cheer" | "frame";
export type SetKey = "fruits" | "sport" | "sakhalin";

export type CollectionItem = {
  key: string;
  title: string;
  description: string;
  setKey: SetKey;
  rarity: CollectionRarity;
  group: CollectionGroup;
  seasonal?: boolean;
  /** Granted when the 8 base items are owned. Not in the chest roll. */
  completion?: boolean;
};

export const DUST_BY_RARITY: Record<CollectionRarity, number> = {
  common: 1,
  rare: 3,
  epic: 8,
  legendary: 20,
};

export const DUST_EXCHANGE_COST = 10;

export const WINTER_SEASON = {
  id: "winter-2026",
  title: "Зима",
  start: "2026-12-01",
  end: "2027-02-28",
};

export const COLLECTION_SETS: { key: SetKey; title: string; completionKey: string }[] = [
  { key: "fruits", title: "Фрукты", completionKey: "cheer_fruit_set" },
  { key: "sport", title: "Спорт", completionKey: "cheer_sport_set" },
  { key: "sakhalin", title: "Сахалин", completionKey: "frame_sakhalin_set" },
];

export const COLLECTION_ITEMS: CollectionItem[] = [
  item("fruit_apple", "Яблоко", "Первый плод набора", "fruits", "common", "sticker"),
  item("fruit_pear", "Груша", "Своя груша в коллекции", "fruits", "common", "sticker"),
  item("fruit_berry", "Ягода", "Мелкая и яркая", "fruits", "common", "sticker"),
  item("fruit_citrus", "Цитрус", "Кислое утро", "fruits", "common", "sticker"),
  item("fruit_plum", "Слива", "Тёмная и спокойная", "fruits", "common", "sticker"),
  item("fruit_fig", "Инжир", "Редкий плод", "fruits", "rare", "sticker"),
  item("fruit_pomegranate", "Гранат", "Много зёрен", "fruits", "rare", "sticker"),
  item("fruit_orchard", "Сад", "Эпический плод набора", "fruits", "epic", "sticker"),
  item("sport_bottle", "Бутылка", "Вода на тренировку", "sport", "common", "sticker"),
  item("sport_rope", "Скакалка", "Короткая разминка", "sport", "common", "sticker"),
  item("sport_mat", "Коврик", "Место на полу", "sport", "common", "sticker"),
  item("sport_bell", "Гиря", "Тяжёлая и простая", "sport", "common", "sticker"),
  item("sport_towel", "Полотенце", "После подхода", "sport", "common", "sticker"),
  item("sport_watch", "Секундомер", "Считал время", "sport", "rare", "sticker"),
  item("sport_medal", "Медаль", "Не за место, за день", "sport", "rare", "sticker"),
  item("sport_podium", "Помост", "Эпический зал", "sport", "epic", "sticker"),
  item("sakh_wave", "Волна", "Берег рядом", "sakhalin", "common", "sticker"),
  item("sakh_hill", "Сопка", "Дорога вверх", "sakhalin", "common", "sticker"),
  item("sakh_crab", "Краб", "На камнях", "sakhalin", "common", "sticker"),
  item("sakh_light", "Маяк", "Свет в тумане", "sakhalin", "common", "sticker"),
  item("sakh_kelp", "Ламинария", "Редкая зелень моря", "sakhalin", "rare", "sticker"),
  item("sakh_island", "Остров", "Свой кусок карты", "sakhalin", "rare", "sticker"),
  item("sakh_volcano", "Вулкан", "Эпический остров", "sakhalin", "epic", "sticker"),
  item("sakh_star", "Звезда берега", "Легенда Сахалина", "sakhalin", "legendary", "sticker"),
  item("winter_snow", "Снег", "Первый зимний", "fruits", "common", "sticker", true),
  item("winter_mitten", "Варежка", "Зимняя пара", "sport", "common", "sticker", true),
  item("winter_ice", "Лёд", "Редкая зима", "sakhalin", "rare", "sticker", true),
  item("winter_aurora", "Сияние", "Эпическая зима", "sakhalin", "epic", "sticker", true),
  item("cheer_fruit_set", "Сад собран", "Фраза за набор «Фрукты»", "fruits", "epic", "cheer", false, true),
  item("cheer_sport_set", "Зал закрыт", "Фраза за набор «Спорт»", "sport", "epic", "cheer", false, true),
  item("frame_sakhalin_set", "Берег", "Рамка за набор «Сахалин»", "sakhalin", "legendary", "frame", false, true),
];

function item(
  key: string,
  title: string,
  description: string,
  setKey: SetKey,
  rarity: CollectionRarity,
  group: CollectionGroup,
  seasonal = false,
  completion = false,
): CollectionItem {
  return { key, title, description, setKey, rarity, group, seasonal, completion };
}

const BY_KEY = new Map(COLLECTION_ITEMS.map((entry) => [entry.key, entry]));

export function collectionItem(key: string): CollectionItem | undefined {
  return BY_KEY.get(key);
}

export function setTitle(setKey: string): string {
  return COLLECTION_SETS.find((set) => set.key === setKey)?.title ?? setKey;
}

export function baseItems(setKey: SetKey): CollectionItem[] {
  return COLLECTION_ITEMS.filter((entry) => entry.setKey === setKey && !entry.seasonal && !entry.completion);
}

export function seasonItems(): CollectionItem[] {
  return COLLECTION_ITEMS.filter((entry) => entry.seasonal);
}

/** festive and gold read as legendary. Anything unknown reads as rare. */
export function publicRarity(raw: string): CollectionRarity {
  if (raw === "common") return "common";
  if (raw === "epic") return "epic";
  if (raw === "gold" || raw === "festive" || raw === "legendary") return "legendary";
  return "rare";
}

export function tierToRarity(tier: LeafRarity): CollectionRarity {
  if (tier === "gold") return "legendary";
  return tier;
}

export function isWinterSeason(dateKey: string): boolean {
  return dateKey >= WINTER_SEASON.start && dateKey <= WINTER_SEASON.end;
}

export function wardrobeKeys(ownedKeys: Iterable<string>): string[] {
  const owned = new Set(ownedKeys);
  return [...owned].filter((key) => !BY_KEY.has(key));
}

export type DropResult =
  | { kind: "item"; key: string; setKey: SetKey }
  | { kind: "dust"; setKey: SetKey; amount: number; duplicateKey: string };

export function pickCollectionDrop(input: {
  tier: LeafRarity;
  ownedKeys: Iterable<string>;
  salt: number;
  today: string;
}): DropResult {
  const rarity = tierToRarity(input.tier);
  const owned = new Set(input.ownedKeys);
  const seasonal = isWinterSeason(input.today);
  const pool = COLLECTION_ITEMS.filter((entry) => {
    if (entry.completion || entry.rarity !== rarity || owned.has(entry.key)) return false;
    if (entry.seasonal) return seasonal;
    return true;
  });
  if (pool.length > 0) {
    const chosen = pool[Math.abs(input.salt) % pool.length]!;
    return { kind: "item", key: chosen.key, setKey: chosen.setKey };
  }
  const dupes = COLLECTION_ITEMS.filter(
    (entry) => !entry.seasonal && !entry.completion && entry.rarity === rarity && owned.has(entry.key),
  );
  const fallback = dupes[Math.abs(input.salt) % Math.max(1, dupes.length)] ?? baseItems("fruits")[0]!;
  return {
    kind: "dust",
    setKey: fallback.setKey,
    amount: DUST_BY_RARITY[rarity],
    duplicateKey: fallback.key,
  };
}

export function setFilled(setKey: SetKey, ownedKeys: Iterable<string>): { filled: number; total: number } {
  const owned = new Set(ownedKeys);
  const items = baseItems(setKey);
  return { filled: items.filter((entry) => owned.has(entry.key)).length, total: items.length };
}

export function completionReady(setKey: SetKey, ownedKeys: Iterable<string>): string | null {
  const progress = setFilled(setKey, ownedKeys);
  if (progress.filled < progress.total) return null;
  const key = COLLECTION_SETS.find((set) => set.key === setKey)?.completionKey ?? null;
  if (!key) return null;
  if (new Set(ownedKeys).has(key)) return null;
  return key;
}

export type ExchangeResult =
  | { ok: true; dustLeft: number; rewardKey: string }
  | { ok: false; reason: "dust" | "owned" | "unknown" | "closed" };

export function exchangeDust(input: {
  setKey: string;
  rewardKey: string;
  dust: number;
  ownedKeys: Iterable<string>;
}): ExchangeResult {
  const reward = collectionItem(input.rewardKey);
  if (!reward || reward.setKey !== input.setKey || reward.seasonal || reward.completion) {
    return { ok: false, reason: "unknown" };
  }
  if (new Set(input.ownedKeys).has(reward.key)) return { ok: false, reason: "owned" };
  if (input.dust < DUST_EXCHANGE_COST) return { ok: false, reason: "dust" };
  return { ok: true, dustLeft: input.dust - DUST_EXCHANGE_COST, rewardKey: reward.key };
}
