/**
 * Name+brand → SKU hint from the barcode RU cache (and light per-100 scaling).
 * Complements barcode lookup when the user types a branded product name.
 */

import { RU_SKU_CACHE, type RuSkuHint } from "@/lib/barcode-ru-sku-cache";
import { normalizeFoodQueryKey } from "@/lib/food-query-parse";
import type { PackNutrition } from "@/lib/open-food-facts";

function norm(value: string): string {
  return normalizeFoodQueryKey(value);
}

function brandKey(value: string | undefined): string {
  return norm(value ?? "");
}

function scoreNameMatch(queryProduct: string, skuName: string): number {
  const q = norm(queryProduct);
  const n = norm(skuName);
  if (!q || !n) return 0;
  if (q === n) return 100;
  if (n.includes(q) || q.includes(n)) return 85;
  const qTokens = q.split(" ").filter((t) => t.length > 2);
  const nTokens = n.split(" ").filter((t) => t.length > 2);
  if (qTokens.length === 0) return 0;
  const hits = qTokens.filter((t) => nTokens.some((nt) => nt.includes(t) || t.includes(nt)));
  if (hits.length === 0) return 0;
  return Math.round((hits.length / qTokens.length) * 70);
}

function hintToPack(hint: RuSkuHint): PackNutrition | null {
  if (hint.kcalPer100 == null || !(hint.kcalPer100 >= 0)) {
    return null;
  }
  const portion = hint.portionGrams && hint.portionGrams > 0 ? hint.portionGrams : 100;
  const scale = portion / 100;
  return {
    dishName: hint.brand ? `${hint.brand} ${hint.name}` : hint.name,
    calories: Math.round(hint.kcalPer100 * scale),
    protein: undefined,
    fat: undefined,
    carbs: undefined,
    portionGrams: portion,
    explicitPackGrams: true,
    brand: hint.brand,
    barcode: hint.barcode,
    per100g: {
      calories: hint.kcalPer100,
    },
  };
}

/**
 * Find the best RU SKU cache row for a brand + optional product phrase.
 * When product is empty (brand-only), returns null — caller should list candidates.
 */
export function lookupRuNameSkuCache(
  brand: string,
  product: string,
): PackNutrition | null {
  const b = brandKey(brand);
  if (!b) return null;
  const productNorm = norm(product);
  if (!productNorm) return null;

  let best: { hint: RuSkuHint; score: number } | null = null;
  for (const hint of RU_SKU_CACHE) {
    if (brandKey(hint.brand) !== b && !brandKey(hint.name).includes(b)) {
      continue;
    }
    const score = scoreNameMatch(productNorm, hint.name);
    if (score >= 50 && (!best || score > best.score)) {
      best = { hint, score };
    }
  }
  return best ? hintToPack(best.hint) : null;
}

/** All SKU hints for a brand (for ambiguous brand-only queries). */
export function listRuNameSkuByBrand(brand: string, limit = 5): PackNutrition[] {
  const b = brandKey(brand);
  if (!b) return [];
  const out: PackNutrition[] = [];
  for (const hint of RU_SKU_CACHE) {
    if (brandKey(hint.brand) !== b) continue;
    const pack = hintToPack(hint);
    if (pack) out.push(pack);
    if (out.length >= limit) break;
  }
  return out;
}
