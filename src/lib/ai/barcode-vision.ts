import type { FoodRecognitionResult } from "../food-types";
import { normalizeBarcode } from "../barcode";

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

  // Explicit barcode close-up, or factory package where digits were missed.
  return result.photoKind === "barcode" || result.photoKind === "package";
}
