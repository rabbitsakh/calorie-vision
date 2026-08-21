import type { FoodRecognitionResult } from "@/lib/food-types";
import { normalizeBarcode } from "@/lib/barcode";

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
  if (result.photoKind === "barcode") {
    return !normalizeBarcode(result.barcode ?? null);
  }
  // Package with unreadable/missing code — only if model claimed barcode kind earlier skipped
  return false;
}
