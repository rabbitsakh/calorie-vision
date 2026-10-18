/**
 * Parse «2× батончик» / «два батончика» / «батончик (2 шт)» → unit count.
 * Used to expand one recognition into N diary lines (assistant + confirm).
 */

const WORD_COUNT: Record<string, number> = {
  два: 2,
  две: 2,
  двух: 2,
  три: 3,
  трёх: 3,
  трех: 3,
  четыре: 4,
  четырёх: 4,
  четырех: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
};

export type DishUnitCount = {
  count: number;
  /** Singular-ish name without the quantity prefix/suffix. */
  unitName: string;
};

function clampCount(n: number): number | null {
  if (!Number.isFinite(n)) return null;
  const c = Math.floor(n);
  if (c < 2 || c > 8) return null;
  return c;
}

/**
 * Extract a visible unit count from a dish title.
 * Returns null when the name is a single unit (or unparseable).
 */
export function parseDishUnitCount(dishName: string | null | undefined): DishUnitCount | null {
  const raw = (dishName ?? "").trim();
  if (!raw) return null;

  // «2× батончик», «2 x батончик», «2*батончик»
  let m = /^(\d+)\s*[xх×*]\s*(.+)$/iu.exec(raw);
  if (m) {
    const count = clampCount(Number(m[1]));
    const unitName = m[2]!.trim();
    if (count && unitName) return { count, unitName };
  }

  // «батончик ×2», «батончик x 2»
  m = /^(.+?)\s*[xх×*]\s*(\d+)$/iu.exec(raw);
  if (m) {
    const count = clampCount(Number(m[2]));
    const unitName = m[1]!.trim();
    if (count && unitName) return { count, unitName };
  }

  // «2 шт батончик» / «2 штуки батончика»
  m = /^(\d+)\s*(?:шт\.?|штук[аи]?)\s+(.+)$/iu.exec(raw);
  if (m) {
    const count = clampCount(Number(m[1]));
    const unitName = m[2]!.trim();
    if (count && unitName) return { count, unitName };
  }

  // «батончик (2 шт)» / «батончик, 2 шт»
  m = /^(.+?)(?:\s*[,(]\s*|\s+)(\d+)\s*(?:шт\.?|штук[аи]?)\)?$/iu.exec(raw);
  if (m) {
    const count = clampCount(Number(m[2]));
    const unitName = m[1]!.trim().replace(/[,(]\s*$/, "").trim();
    if (count && unitName) return { count, unitName };
  }

  // «два протеиновых батончика»
  m = /^(два|две|двух|три|трёх|трех|четыре|четырёх|четырех|пять|шесть|семь|восемь)\s+(.+)$/iu.exec(
    raw,
  );
  if (m) {
    const count = WORD_COUNT[m[1]!.toLowerCase()];
    const unitName = m[2]!.trim();
    if (count && unitName) return { count, unitName };
  }

  // «2 батончика» / «2 протеиновых батончика»
  m = /^(\d+)\s+(.+)$/u.exec(raw);
  if (m) {
    const count = clampCount(Number(m[1]));
    const unitName = m[2]!.trim();
    // Avoid dates / weights: «2024 урожай», «100 г сыра»
    if (count && unitName && !/^(г|гр|кг|мл|л|ккал)\b/i.test(unitName)) {
      return { count, unitName };
    }
  }

  return null;
}

export function looksLikeCountedDishName(dishName: string | null | undefined): boolean {
  return parseDishUnitCount(dishName) != null;
}
