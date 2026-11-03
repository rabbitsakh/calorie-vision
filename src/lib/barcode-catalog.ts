import { normalizeBarcode, repairBarcodeCandidates } from "@/lib/barcode";
import {
  defaultPortionFromPack,
  type BarcodeCatalogProduct,
} from "@/lib/barcode-product";
import type { FoodRecognitionResult } from "@/lib/food-types";
import { nutritionFromPer100g } from "@/lib/open-food-facts";

export type BarcodeCatalogOrigin = "cache" | "openfoodfacts" | "ru-sku";

export type OffCatalogLookup =
  | { status: "hit"; product: BarcodeCatalogProduct }
  | { status: "miss" }
  | { status: "unavailable" };

export type BarcodeCatalogResult =
  | { status: "invalid" }
  | { status: "found"; product: BarcodeCatalogProduct; origin: BarcodeCatalogOrigin }
  | { status: "not_found" }
  | { status: "offline" };

export type BarcodeCatalogDeps = {
  readCache: (barcode: string) => Promise<BarcodeCatalogProduct | null>;
  writeCache: (product: BarcodeCatalogProduct) => Promise<void>;
  lookupOff: (barcode: string) => Promise<OffCatalogLookup>;
  lookupRuSku: (barcode: string) => BarcodeCatalogProduct | null;
};

const OFF_ATTEMPTS = 4;

export function barcodeLookupCandidates(raw: string): string[] | null {
  const primary = normalizeBarcode(raw);
  if (!primary) return null;
  return [primary, ...repairBarcodeCandidates(primary).filter((code) => code !== primary)];
}

/** Confirm-card payload. Portion defaults to the pack, or 100 g for a large pack. */
export function barcodeProductToRecognition(product: BarcodeCatalogProduct): FoodRecognitionResult {
  const portion = defaultPortionFromPack(product.packGrams);
  const per100g = {
    calories: product.kcalPer100,
    protein: product.proteinPer100,
    fat: product.fatPer100,
    carbs: product.carbsPer100,
  };
  const scaled = nutritionFromPer100g(per100g, portion);
  const brand = product.brand?.trim() || undefined;
  const dishName = [brand, product.name.trim()].filter(Boolean).join(" ").trim() || product.name;
  const source =
    product.userContributed || product.source === "user"
      ? "barcode-user"
      : product.source === "ru-sku"
        ? "ru-sku-cache"
        : "openfoodfacts-barcode";

  return {
    dishName,
    calories: scaled?.calories ?? Math.round(product.kcalPer100),
    protein: scaled?.protein ?? product.proteinPer100,
    fat: scaled?.fat ?? product.fatPer100,
    carbs: scaled?.carbs ?? product.carbsPer100,
    portionGrams: portion,
    per100g,
    barcode: product.barcode,
    brand,
    imageUrl: product.imageUrl,
    confidence: product.userContributed ? 0.62 : product.source === "ru-sku" ? 0.7 : 0.9,
    source,
    photoKind: "barcode",
  };
}

async function remember(
  deps: BarcodeCatalogDeps,
  product: BarcodeCatalogProduct,
  scanned: string,
): Promise<void> {
  const writes = [product];
  if (scanned !== product.barcode) {
    writes.push({ ...product, barcode: scanned });
  }
  for (const row of writes) {
    try {
      await deps.writeCache(row);
    } catch {
      // The shared cache is an optimization. A failed write still returns the product.
    }
  }
}

/**
 * 1) Shared MySQL cache (injected).
 * 2) Open Food Facts, world then ru (injected lookupOff).
 * 3) Local RU SKU hints when the network cannot answer.
 * A definitive miss is `not_found`. A failed network check is `offline`.
 */
export async function lookupBarcodeCatalog(
  raw: string,
  deps: BarcodeCatalogDeps,
): Promise<BarcodeCatalogResult> {
  const codes = barcodeLookupCandidates(raw);
  if (!codes || codes.length === 0) {
    return { status: "invalid" };
  }

  for (const code of codes) {
    const cached = await deps.readCache(code);
    if (cached) {
      return { status: "found", product: cached, origin: "cache" };
    }
  }

  let sawMiss = false;
  let sawUnavailable = false;
  for (const code of codes.slice(0, OFF_ATTEMPTS)) {
    const off = await deps.lookupOff(code);
    if (off.status === "hit") {
      await remember(deps, off.product, codes[0]!);
      return { status: "found", product: off.product, origin: "openfoodfacts" };
    }
    if (off.status === "miss") {
      sawMiss = true;
      continue;
    }
    sawUnavailable = true;
    break;
  }

  for (const code of codes) {
    const local = deps.lookupRuSku(code);
    if (local) {
      await remember(deps, local, codes[0]!);
      return { status: "found", product: local, origin: "ru-sku" };
    }
  }

  if (sawUnavailable) {
    return { status: "offline" };
  }
  if (sawMiss) {
    return { status: "not_found" };
  }
  return { status: "not_found" };
}
