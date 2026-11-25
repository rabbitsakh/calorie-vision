/**
 * Day chest: three leaves, one per date. Skip does not erase.
 * Rarity is rolled on the server when the chest becomes ready.
 * Roll is an integer 0..99. Combo lifts one step. Pity lifts after that.
 */

import { REWARD_DEFS, hashSalt, rewardDef, type RewardRarity } from "@/lib/rewards";

export const LEAVES_PER_CHEST = 3;
export const MIN_MEAL_KCAL = 80;
export const SPARK_DELAY_MS = 15 * 60 * 1000;
export const MIN_WORK_REPS = 5;
export const MIN_WORK_SEC = 5 * 60;
export const MIN_WORK_KM = 0.5;
export const MIN_SESSION_MS = 4 * 60 * 1000;

export type LeafRarity = "common" | "rare" | "gold";

export const LEAF_RARITY_LABEL: Record<LeafRarity, string> = {
  common: "Обычный",
  rare: "Редкий",
  gold: "Золотой",
};

export const LEAF_FINE_PRINT =
  "Еда от 80 ккал. Тренировка — от 5 повторов, 5 минут или полкилометра, и это не разминка. Пропустил — ничего не сгорает. Купить день нельзя.";

export const LEAF_PENDING_NOTE = "Свежая запись зачтётся через несколько минут.";

const BANNED_COPY = [
  "искра",
  "комбо",
  "живой день",
  "кладовая",
  "поинтереснее",
  "камушк",
  "хорошие дни",
];

const WEEKDAY = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"] as const;

export type LeafSpark = {
  date: string;
  food: boolean;
  workout: boolean;
  spare: boolean;
};

export type SealedChest = {
  seq: number;
  rarity: LeafRarity;
  combo: boolean;
  opened: boolean;
  rewardKey: string | null;
};

export type LeafLedger = {
  commonStreak: number;
  sinceGold: number;
  spareLeaf: boolean;
};

export type LeafWorld = {
  sparks: LeafSpark[];
  chests: SealedChest[];
  ledger: LeafLedger;
};

export type SpareDeny = "none" | "today" | "future" | "not-yesterday" | "already";

export function emptyLeafWorld(): LeafWorld {
  return {
    sparks: [],
    chests: [],
    ledger: { commonStreak: 0, sinceGold: 0, spareLeaf: false },
  };
}

export function shiftDateKeyUtc(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}

export function weekdayLeafLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return WEEKDAY[dt.getUTCDay()] ?? "";
}

export function copyHasBannedWord(text: string): string | null {
  const lower = text.toLowerCase();
  return BANNED_COPY.find((word) => lower.includes(word)) ?? null;
}

export function baseRarity(roll: number): LeafRarity {
  const n = Math.max(0, Math.min(99, Math.floor(roll)));
  if (n < 70) return "common";
  if (n < 95) return "rare";
  return "gold";
}

export function applyComboShift(rarity: LeafRarity, combo: boolean): LeafRarity {
  if (!combo) return rarity;
  if (rarity === "common") return "rare";
  if (rarity === "rare") return "gold";
  return "gold";
}

/** Pity reads the result after combo. 4th common in a row becomes rare. 12th without gold becomes gold. */
export function applyPityRaise(
  rarity: LeafRarity,
  commonStreak: number,
  sinceGold: number,
): LeafRarity {
  let next = rarity;
  if (commonStreak >= 3 && next === "common") next = "rare";
  if (sinceGold >= 11) next = "gold";
  return next;
}

export function nextPityCounters(
  rarity: LeafRarity,
  commonStreak: number,
  sinceGold: number,
): { commonStreak: number; sinceGold: number } {
  if (rarity === "gold") return { commonStreak: 0, sinceGold: 0 };
  if (rarity === "rare") return { commonStreak: 0, sinceGold: sinceGold + 1 };
  return { commonStreak: commonStreak + 1, sinceGold: sinceGold + 1 };
}

export function resolveRarity(input: {
  roll: number;
  combo: boolean;
  commonStreak: number;
  sinceGold: number;
}): { rarity: LeafRarity; commonStreak: number; sinceGold: number } {
  const shifted = applyComboShift(baseRarity(input.roll), input.combo);
  const rarity = applyPityRaise(shifted, input.commonStreak, input.sinceGold);
  const counters = nextPityCounters(rarity, input.commonStreak, input.sinceGold);
  return { rarity, ...counters };
}

export function isLeafCombo(spark: LeafSpark): boolean {
  return spark.food && spark.workout && !spark.spare;
}

export function creditReady(eventAt: Date, now: Date, delayMs = SPARK_DELAY_MS): boolean {
  return now.getTime() - eventAt.getTime() >= delayMs;
}

export function mealCountsAsPlate(calories: number): boolean {
  return calories >= MIN_MEAL_KCAL;
}

export function setCountsAsWorkout(set: {
  setType?: string | null;
  completed?: boolean | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceKm?: number | null;
}): boolean {
  if (set.completed === false) return false;
  if ((set.setType ?? "working") === "warmup") return false;
  const reps = set.reps ?? 0;
  const duration = set.durationSec ?? 0;
  const km = set.distanceKm ?? 0;
  return reps >= MIN_WORK_REPS || duration >= MIN_WORK_SEC || km >= MIN_WORK_KM;
}

export function sessionEffortOk(session: {
  endedAt: Date | null;
  startedAt: Date | null;
  sets: Array<{
    setType?: string | null;
    completed?: boolean | null;
    reps?: number | null;
    durationSec?: number | null;
    distanceKm?: number | null;
  }>;
}): boolean {
  if (!session.endedAt) return false;
  if (session.startedAt) {
    const span = session.endedAt.getTime() - session.startedAt.getTime();
    if (span < MIN_SESSION_MS) return false;
  }
  return session.sets.some(setCountsAsWorkout);
}

export function sessionCountsAsGym(
  session: {
    endedAt: Date | null;
    startedAt: Date | null;
    sets: Array<{
      setType?: string | null;
      completed?: boolean | null;
      reps?: number | null;
      durationSec?: number | null;
      distanceKm?: number | null;
    }>;
  },
  now: Date,
): boolean {
  if (!sessionEffortOk(session)) return false;
  return session.endedAt != null && creditReady(session.endedAt, now);
}

function sortedSparks(sparks: LeafSpark[]): LeafSpark[] {
  return [...sparks].sort((a, b) => a.date.localeCompare(b.date));
}

export function addSpark(
  world: LeafWorld,
  incoming: LeafSpark,
): { world: LeafWorld; created: boolean } {
  const existing = world.sparks.find((spark) => spark.date === incoming.date);
  if (!existing) {
    return {
      world: { ...world, sparks: [...world.sparks, { ...incoming }] },
      created: true,
    };
  }
  const food = existing.food || incoming.food;
  const workout = existing.workout || incoming.workout;
  const spare = !food && !workout && (existing.spare || incoming.spare);
  if (food === existing.food && workout === existing.workout && spare === existing.spare) {
    return { world, created: false };
  }
  return {
    world: {
      ...world,
      sparks: world.sparks.map((spark) =>
        spark.date === incoming.date ? { date: spark.date, food, workout, spare } : spark,
      ),
    },
    created: false,
  };
}

export function awardSpareLeaf(world: LeafWorld): LeafWorld {
  if (world.ledger.spareLeaf) return world;
  return { ...world, ledger: { ...world.ledger, spareLeaf: true } };
}

export function spendSpareLeaf(
  world: LeafWorld,
  targetDate: string,
  today: string,
): { ok: true; world: LeafWorld } | { ok: false; reason: SpareDeny } {
  if (!world.ledger.spareLeaf) return { ok: false, reason: "none" };
  if (targetDate > today) return { ok: false, reason: "future" };
  if (targetDate === today) return { ok: false, reason: "today" };
  const yesterday = shiftDateKeyUtc(today, -1);
  if (targetDate !== yesterday) return { ok: false, reason: "not-yesterday" };
  if (world.sparks.some((spark) => spark.date === targetDate)) {
    return { ok: false, reason: "already" };
  }
  const next = addSpark(
    { ...world, ledger: { ...world.ledger, spareLeaf: false } },
    { date: targetDate, food: false, workout: false, spare: true },
  );
  return { ok: true, world: next.world };
}

export function sealReadyChests(world: LeafWorld, roll: () => number): LeafWorld {
  const sparks = sortedSparks(world.sparks);
  const earned = Math.floor(sparks.length / LEAVES_PER_CHEST);
  const chests = [...world.chests];
  let ledger = { ...world.ledger };
  for (let seq = 1; seq <= earned; seq += 1) {
    if (chests.some((chest) => chest.seq === seq)) continue;
    const batch = sparks.slice((seq - 1) * LEAVES_PER_CHEST, seq * LEAVES_PER_CHEST);
    const combo = batch.some(isLeafCombo);
    const resolved = resolveRarity({
      roll: roll(),
      combo,
      commonStreak: ledger.commonStreak,
      sinceGold: ledger.sinceGold,
    });
    chests.push({
      seq,
      rarity: resolved.rarity,
      combo,
      opened: false,
      rewardKey: null,
    });
    ledger = {
      commonStreak: resolved.commonStreak,
      sinceGold: resolved.sinceGold,
      spareLeaf: ledger.spareLeaf,
    };
  }
  return { ...world, chests, ledger };
}

export function oldestUnopened(world: LeafWorld): SealedChest | null {
  return (
    world.chests
      .filter((chest) => !chest.opened)
      .sort((a, b) => a.seq - b.seq)[0] ?? null
  );
}

export function currentSparks(world: LeafWorld): LeafSpark[] {
  const sparks = sortedSparks(world.sparks);
  const pending = oldestUnopened(world);
  if (pending) {
    return sparks.slice((pending.seq - 1) * LEAVES_PER_CHEST, pending.seq * LEAVES_PER_CHEST);
  }
  const remainder = sparks.length % LEAVES_PER_CHEST;
  if (remainder === 0) return [];
  return sparks.slice(sparks.length - remainder);
}

export type LeafSlot = {
  state: "on" | "wait" | "empty";
  label: string;
};

export type LeafPublic = {
  line: string;
  sheetHint: string;
  finePrint: string;
  filled: number;
  ready: boolean;
  readyCount: number;
  rarity: LeafRarity | null;
  rarityLabel: string | null;
  chestLook: LeafRarity;
  slots: LeafSlot[];
  spareLeaf: boolean;
  canSpendSpare: boolean;
  pendingNote: string | null;
};

function twoLeafLine(sparks: LeafSpark[], today: string): string {
  const [earlier, later] = [...sparks].sort((a, b) => a.date.localeCompare(b.date));
  if (!earlier || !later) return "Ещё один день — и сундук твой.";
  const yesterday = shiftDateKeyUtc(today, -1);
  const dayBefore = shiftDateKeyUtc(today, -2);
  if (later.date === yesterday && earlier.date === dayBefore && later.workout && earlier.food && !earlier.workout) {
    return "Вчера зал, позавчера завтрак — остался сегодняшний листок.";
  }
  if (later.date === yesterday && earlier.date === dayBefore && earlier.workout && later.food && !later.workout) {
    return "Позавчера зал, вчера завтрак — остался сегодняшний листок.";
  }
  return "Ещё один день — и сундук твой.";
}

export function stripLine(filled: number, sparks: LeafSpark[], today: string, ready: boolean): string {
  if (ready || filled >= LEAVES_PER_CHEST) return "Три дня есть. Можно открывать.";
  if (filled <= 0) return "Пока пусто. Завтрак или зал — и первый листок.";
  if (filled === 1) return "Первый листок на месте. Ещё два таких дня — и сундук твой.";
  return twoLeafLine(sparks, today);
}

export function leafView(world: LeafWorld, today: string, pendingNote: string | null = null): LeafPublic {
  const pending = oldestUnopened(world);
  const sparks = currentSparks(world);
  const ready = pending != null;
  const filled = ready ? LEAVES_PER_CHEST : sparks.length;
  const line = stripLine(filled, sparks, today, ready);
  const todaySpark = world.sparks.find((spark) => spark.date === today);
  const sheetHint =
    todaySpark?.food && !todaySpark.workout
      ? "Сделаешь и то и другое — в сундуке будет редкая вещь."
      : ready
        ? "Сундук твой. Откроем?"
        : line;
  const slots: LeafSlot[] = sparks.map((spark) => ({
    state: "on",
    label: weekdayLeafLabel(spark.date),
  }));
  if (!ready && !world.sparks.some((spark) => spark.date === today) && slots.length < LEAVES_PER_CHEST) {
    slots.push({ state: "wait", label: weekdayLeafLabel(today) });
  }
  while (slots.length < LEAVES_PER_CHEST) slots.push({ state: "empty", label: "" });

  const comboInCycle = sparks.some(isLeafCombo);
  const chestLook: LeafRarity = pending?.rarity ?? (comboInCycle ? "rare" : "common");
  const yesterday = shiftDateKeyUtc(today, -1);

  return {
    line,
    sheetHint,
    finePrint: LEAF_FINE_PRINT,
    filled,
    ready,
    readyCount: world.chests.filter((chest) => !chest.opened).length,
    rarity: pending?.rarity ?? null,
    rarityLabel: pending ? LEAF_RARITY_LABEL[pending.rarity] : null,
    chestLook,
    slots,
    spareLeaf: world.ledger.spareLeaf,
    canSpendSpare:
      world.ledger.spareLeaf && !world.sparks.some((spark) => spark.date === yesterday),
    pendingNote,
  };
}

export function leafRewardSourceKey(seq: number): string {
  return `leaf-chest:${seq}`;
}

function catalogRarity(rarity: LeafRarity): RewardRarity {
  if (rarity === "gold") return "festive";
  return rarity;
}

/** Cosmetic of the sealed chest rarity. Prefer one the person does not own yet. */
export function pickCosmeticForChest(
  ownedKeys: Iterable<string>,
  rarity: LeafRarity,
  salt = 0,
): string {
  const owned = new Set(ownedKeys);
  const want = catalogRarity(rarity);
  const pool = REWARD_DEFS.filter((def) => !def.metaOnly && def.rarity === want);
  const unowned = pool.filter((def) => !owned.has(def.key));
  const use = unowned.length > 0 ? unowned : pool.length > 0 ? pool : REWARD_DEFS.filter((def) => !def.metaOnly);
  return use[Math.abs(salt) % use.length]!.key;
}

export function cosmeticForChest(rewardKey: string): {
  key: string;
  title: string;
  description: string;
} | null {
  const def = rewardDef(rewardKey);
  if (!def) return null;
  return { key: def.key, title: def.title, description: def.description };
}

export function chestSalt(seq: number): number {
  return hashSalt(leafRewardSourceKey(seq));
}

export function dateInCreditWindow(date: string, today: string): boolean {
  return date === today || date === shiftDateKeyUtc(today, -1);
}
