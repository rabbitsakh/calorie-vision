/**
 * Offline fiber/sugar lookup for common foods — skips GigaChat when we know typical values.
 * Values are per 100 g unless typicalPortionGrams is set on the entry.
 */

export type FiberSugarTableEntry = {
  keys: string[];
  fiberPer100g?: number;
  sugarPer100g?: number;
  /** Fixed fiber/sugar for a typical single portion (overrides per-100 scaling). */
  fiber?: number;
  sugar?: number;
  typicalPortionGrams?: number;
};

export const FIBER_SUGAR_TABLE: FiberSugarTableEntry[] = [
  { keys: ["яблоко", "яблоки"], fiberPer100g: 2.4, sugarPer100g: 10, typicalPortionGrams: 180 },
  { keys: ["банан", "бананы"], fiberPer100g: 2.6, sugarPer100g: 12, typicalPortionGrams: 120 },
  { keys: ["апельсин", "мандарин", "грейпфрут"], fiberPer100g: 2.4, sugarPer100g: 9, typicalPortionGrams: 150 },
  { keys: ["груша"], fiberPer100g: 3.1, sugarPer100g: 10, typicalPortionGrams: 170 },
  { keys: ["киви"], fiberPer100g: 3, sugarPer100g: 9, typicalPortionGrams: 80 },
  { keys: ["хурма"], fiberPer100g: 3.6, sugarPer100g: 12, typicalPortionGrams: 150 },
  { keys: ["виноград"], fiberPer100g: 0.9, sugarPer100g: 16, typicalPortionGrams: 150 },
  { keys: ["клубника", "земляника"], fiberPer100g: 2, sugarPer100g: 5, typicalPortionGrams: 150 },
  { keys: ["черника", "голубика"], fiberPer100g: 2.4, sugarPer100g: 10, typicalPortionGrams: 100 },
  { keys: ["овсянка", "овсяная каша"], fiberPer100g: 1.7, sugarPer100g: 0.5, typicalPortionGrams: 250 },
  { keys: ["гречка", "гречневая каша"], fiberPer100g: 1.1, sugarPer100g: 0.4, typicalPortionGrams: 200 },
  { keys: ["рис", "рис отварной"], fiberPer100g: 0.4, sugarPer100g: 0.1, typicalPortionGrams: 200 },
  { keys: ["макароны", "паста"], fiberPer100g: 1.8, sugarPer100g: 1.2, typicalPortionGrams: 200 },
  { keys: ["хлеб", "хлеб белый", "батон"], fiberPer100g: 2.7, sugarPer100g: 3.5, typicalPortionGrams: 60 },
  { keys: ["хлеб цельнозерновой", "цельнозерновой хлеб"], fiberPer100g: 7, sugarPer100g: 4, typicalPortionGrams: 60 },
  { keys: ["овсяное печенье", "печенье овсяное"], fiberPer100g: 3.5, sugarPer100g: 22, typicalPortionGrams: 40 },
  { keys: ["йогурт", "греческий йогурт"], fiberPer100g: 0, sugarPer100g: 4, typicalPortionGrams: 150 },
  { keys: ["творог", "творог 5%"], fiberPer100g: 0, sugarPer100g: 3, typicalPortionGrams: 150 },
  { keys: ["кефир"], fiberPer100g: 0, sugarPer100g: 4, typicalPortionGrams: 250 },
  { keys: ["молоко"], fiberPer100g: 0, sugarPer100g: 4.7, typicalPortionGrams: 250 },
  { keys: ["сок", "сок яблочный", "сок апельсиновый"], fiberPer100g: 0.2, sugarPer100g: 10, typicalPortionGrams: 250 },
  { keys: ["компот"], fiberPer100g: 0.3, sugarPer100g: 8, typicalPortionGrams: 250 },
  { keys: ["морковь", "морковь сырая"], fiberPer100g: 2.8, sugarPer100g: 4.7, typicalPortionGrams: 100 },
  { keys: ["свёкла", "свекла"], fiberPer100g: 2.8, sugarPer100g: 6.8, typicalPortionGrams: 150 },
  { keys: ["капуста", "капуста белокочанная"], fiberPer100g: 2, sugarPer100g: 3.2, typicalPortionGrams: 150 },
  { keys: ["огурец", "огурцы"], fiberPer100g: 0.7, sugarPer100g: 1.5, typicalPortionGrams: 100 },
  { keys: ["помидор", "томат", "черри"], fiberPer100g: 1.2, sugarPer100g: 2.6, typicalPortionGrams: 120 },
  { keys: ["авокадо"], fiberPer100g: 6.7, sugarPer100g: 0.7, typicalPortionGrams: 100 },
  { keys: ["орех", "орехи", "миндаль", "грецкий орех"], fiberPer100g: 7, sugarPer100g: 4, typicalPortionGrams: 30 },
  { keys: ["шоколад", "молочный шоколад"], fiberPer100g: 3.4, sugarPer100g: 52, typicalPortionGrams: 30 },
  { keys: ["мёд", "мед"], fiberPer100g: 0, sugarPer100g: 82, typicalPortionGrams: 20 },
  { keys: ["варенье", "джем"], fiberPer100g: 0.3, sugarPer100g: 60, typicalPortionGrams: 30 },
  { keys: ["салат", "салат овощной", "овощной салат"], fiberPer100g: 1.5, sugarPer100g: 2, typicalPortionGrams: 150 },
  { keys: ["винегрет"], fiberPer100g: 2, sugarPer100g: 4, typicalPortionGrams: 200 },
  { keys: ["борщ", "борщ с мясом"], fiberPer100g: 1.2, sugarPer100g: 3, typicalPortionGrams: 300 },
  { keys: ["овощной суп"], fiberPer100g: 0.8, sugarPer100g: 2.5, typicalPortionGrams: 300 },
];

function normalizeFiberSugarKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function entryMatches(name: string, entry: FiberSugarTableEntry): boolean {
  const key = normalizeFiberSugarKey(name);
  if (!key) {
    return false;
  }

  return entry.keys.some((candidate) => {
    const normalized = normalizeFiberSugarKey(candidate);
    return key === normalized || key.includes(normalized) || normalized.includes(key);
  });
}

function scaleMacro(value: number | undefined, grams: number, per100: boolean): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!per100) {
    return Math.round(value * 10) / 10;
  }
  return Math.round(value * (grams / 100) * 10) / 10;
}

/** Lookup fiber/sugar for a dish name; scales per-100 values to portionGrams when provided. */
export function lookupFiberSugarTable(
  dishName: string,
  portionGrams?: number,
): { fiber?: number; sugar?: number } | null {
  const entry = FIBER_SUGAR_TABLE.find((row) => entryMatches(dishName, row));
  if (!entry) {
    return null;
  }

  const grams =
    portionGrams && portionGrams > 0
      ? portionGrams
      : entry.typicalPortionGrams && entry.typicalPortionGrams > 0
        ? entry.typicalPortionGrams
        : 100;

  if (entry.fiber !== undefined || entry.sugar !== undefined) {
    return {
      fiber: entry.fiber,
      sugar: entry.sugar,
    };
  }

  return {
    fiber: scaleMacro(entry.fiberPer100g, grams, true),
    sugar: scaleMacro(entry.sugarPer100g, grams, true),
  };
}
