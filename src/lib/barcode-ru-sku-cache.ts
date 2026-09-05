/**
 * Small offline RU barcode → product hint cache for common SKUs.
 * Used as a last-resort lookup when Open Food Facts / network is unavailable.
 */

export type RuSkuHint = {
  barcode: string;
  name: string;
  brand?: string;
  /** kcal per 100 g/ml when known */
  kcalPer100?: number;
  portionGrams?: number;
};

/** Curated starter set — extend over time; keep entries conservative. */
export const RU_SKU_CACHE: RuSkuHint[] = [
  {
    barcode: "4607025390055",
    name: "Творог 5%",
    brand: "Простоквашино",
    kcalPer100: 121,
    portionGrams: 180,
  },
  {
    barcode: "4607025231266",
    name: "Кефир 3.2%",
    brand: "Простоквашино",
    kcalPer100: 56,
    portionGrams: 900,
  },
  {
    barcode: "4600605020959",
    name: "Гречневая крупа ядрица",
    brand: "Увелка",
    kcalPer100: 313,
    portionGrams: 100,
  },
  {
    barcode: "4605246001234",
    name: "Овсяные хлопья Геркулес",
    brand: "Русский продукт",
    kcalPer100: 350,
    portionGrams: 40,
  },
  {
    barcode: "4600494660159",
    name: "Молоко 2.5%",
    brand: "Домик в деревне",
    kcalPer100: 52,
    portionGrams: 1000,
  },
];

const BY_CODE = new Map(RU_SKU_CACHE.map((row) => [row.barcode, row]));

export function lookupRuSkuCache(barcode: string): RuSkuHint | null {
  const normalized = barcode.replace(/\D/g, "");
  if (!normalized) return null;
  return BY_CODE.get(normalized) ?? null;
}
