import { normalizeBarcode } from "@/lib/barcode";
import type { BarcodeCatalogProduct } from "@/lib/barcode-product";
import {
  lookupOpenFoodFactsRegions,
  type PackNutrition,
} from "@/lib/open-food-facts";
import type { OffCatalogLookup } from "@/lib/barcode-catalog";

export function packToCatalogProduct(
  pack: PackNutrition,
  fallbackBarcode: string,
): BarcodeCatalogProduct | null {
  const kcal = pack.per100g?.calories;
  if (kcal === undefined || !Number.isFinite(kcal) || kcal < 0) {
    return null;
  }
  const barcode = normalizeBarcode(pack.barcode) ?? normalizeBarcode(fallbackBarcode);
  if (!barcode) return null;

  const brand = pack.brand?.trim() || undefined;
  let name = pack.dishName.trim();
  if (brand && name.toLowerCase().startsWith(brand.toLowerCase())) {
    const rest = name.slice(brand.length).trim();
    if (rest) name = rest;
  }
  if (!name) return null;

  return {
    barcode,
    name,
    brand,
    kcalPer100: kcal,
    proteinPer100: pack.per100g?.protein,
    fatPer100: pack.per100g?.fat,
    carbsPer100: pack.per100g?.carbs,
    packGrams: pack.explicitPackGrams ? pack.packGrams : undefined,
    imageUrl: pack.imageUrl,
    source: "openfoodfacts",
    userContributed: false,
  };
}

export async function lookupOffCatalogProduct(barcode: string): Promise<OffCatalogLookup> {
  const result = await lookupOpenFoodFactsRegions(barcode);
  if (result.status !== "hit") {
    return result;
  }
  const product = packToCatalogProduct(result.product, barcode);
  if (!product) {
    return { status: "miss" };
  }
  return { status: "hit", product };
}
