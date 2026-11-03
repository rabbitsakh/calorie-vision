import { lookupBarcodeCatalog, type BarcodeCatalogResult } from "@/lib/barcode-catalog";
import { lookupOffCatalogProduct } from "@/lib/barcode-off";
import type { BarcodeCatalogProduct } from "@/lib/barcode-product";
import { readBarcodeProduct, writeBarcodeProduct } from "@/lib/barcode-product-store";
import { lookupRuSkuCache, type RuSkuHint } from "@/lib/barcode-ru-sku-cache";

export function ruSkuToCatalogProduct(hint: RuSkuHint): BarcodeCatalogProduct | null {
  if (hint.kcalPer100 === undefined || !Number.isFinite(hint.kcalPer100) || hint.kcalPer100 < 0) {
    return null;
  }
  return {
    barcode: hint.barcode,
    name: hint.name,
    brand: hint.brand,
    kcalPer100: hint.kcalPer100,
    packGrams: hint.portionGrams,
    source: "ru-sku",
    userContributed: false,
  };
}

async function readCacheSafe(barcode: string): Promise<BarcodeCatalogProduct | null> {
  try {
    return await readBarcodeProduct(barcode);
  } catch (error) {
    console.warn("barcode cache read failed", error);
    return null;
  }
}

/** MySQL cache, then Open Food Facts (world + ru), then the local RU list. */
export function lookupBarcodeCatalogLive(raw: string): Promise<BarcodeCatalogResult> {
  return lookupBarcodeCatalog(raw, {
    readCache: readCacheSafe,
    writeCache: (product) => writeBarcodeProduct(product),
    lookupOff: lookupOffCatalogProduct,
    lookupRuSku: (barcode) => {
      const hint = lookupRuSkuCache(barcode);
      return hint ? ruSkuToCatalogProduct(hint) : null;
    },
  });
}
