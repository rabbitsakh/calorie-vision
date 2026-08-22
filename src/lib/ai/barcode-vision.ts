import type { FoodRecognitionResult } from "../food-types";
import { normalizeBarcode } from "../barcode";
import { looksLikeMultiDishName } from "./plate-vision";

/** Drop invented barcodes on plated meals; normalize elsewhere. */
export function sanitizeVisionBarcode(result: FoodRecognitionResult): FoodRecognitionResult {
  if (result.photoKind === "meal") {
    return { ...result, barcode: undefined };
  }

  const normalized = normalizeBarcode(result.barcode ?? null);
  return {
    ...result,
    barcode: normalized ?? undefined,
  };
}

/** Whether a short barcode-focused vision pass is worth it. */
export function shouldRunBarcodePass(result: FoodRecognitionResult): boolean {
  if (normalizeBarcode(result.barcode ?? null)) {
    return false;
  }

  // Mixed plate sometimes misclassified as package — don't waste a barcode pass.
  if (looksLikeMultiDishName(result.dishName)) {
    return false;
  }

  // Explicit barcode close-up, or factory package where digits were missed.
  return result.photoKind === "barcode" || result.photoKind === "package";
}
