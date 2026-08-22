import type { FoodRecognitionResult } from "../food-types";
import { shouldRunBarcodePass } from "./barcode-vision";
import { shouldRunDrinkPass } from "./drink-vision";
import { shouldRunLabelPass } from "./label-vision";
import { shouldRunPackagePass } from "./package-vision";
import { shouldRunPlatePass } from "./plate-vision";
import { shouldRunStickerPass } from "./sticker-vision";

export type SpecialistPass =
  | "barcode"
  | "label"
  | "package"
  | "plate"
  | "drink"
  | "sticker";

/**
 * At most ONE specialist second-pass per photo.
 * Prevents package+sticker+plate cascades that blow GigaChat rate limits / nginx timeouts.
 */
export function pickSpecialistPass(result: FoodRecognitionResult): SpecialistPass | null {
  // Packaged goods: prefer reading the barcode before guessing the front.
  if (shouldRunBarcodePass(result)) return "barcode";
  if (shouldRunLabelPass(result)) return "label";
  if (shouldRunPackagePass(result)) return "package";
  if (shouldRunPlatePass(result)) return "plate";
  if (shouldRunDrinkPass(result)) return "drink";
  if (shouldRunStickerPass(result)) return "sticker";
  return null;
}
