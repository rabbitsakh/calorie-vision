import type { FoodRecognitionResult } from "../food-types";
import { shouldRunBarcodePass } from "./barcode-vision";
import { shouldRunDrinkPass } from "./drink-vision";
import { shouldRunLabelPass } from "./label-vision";
import { isSuspiciousSoupOnPackaged } from "../package-name-guard";
import { shouldRunPackagePass } from "./package-vision";
import { looksLikeCanteenTrayName, shouldRunPlatePass } from "./plate-vision";
import { looksLikeReadyMealSticker, shouldRunStickerPass } from "./sticker-vision";

export type SpecialistPass =
  | "barcode"
  | "label"
  | "package"
  | "plate"
  | "drink"
  | "sticker";

export type SpecialistPassOptions = {
  /** Client photo context chip (столовая / тарелка / этикетка). */
  context?: "restaurant" | "plate" | "label";
};

/**
 * At most ONE specialist second-pass per photo.
 * Prevents package+sticker+plate cascades that blow GigaChat rate limits / nginx timeouts.
 *
 * Restaurant / plate context: prefer plate before label so canteen trays are not
 * wasted on nutrition-table OCR.
 */
export function pickSpecialistPass(
  result: FoodRecognitionResult,
  options?: SpecialistPassOptions,
): SpecialistPass | null {
  const context = options?.context;
  const preferPlate =
    context === "restaurant" ||
    context === "plate" ||
    looksLikeCanteenTrayName(result.dishName);

  // Cafe / ready-meal stickers: prefer sticker OCR before barcode/label (single-slot budget).
  if (looksLikeReadyMealSticker(result) && shouldRunStickerPass(result)) return "sticker";
  // Packaged goods: prefer reading the barcode before guessing the front.
  if (shouldRunBarcodePass(result)) return "barcode";
  // Oats-in-cup misread as soup — re-read front-of-pack text before label OCR.
  if (isSuspiciousSoupOnPackaged(result)) return "package";
  // Drink-like + stuck 100ml / per-100 macros: prefer drink before label (single slot).
  if (shouldRunDrinkPass(result)) return "drink";

  // Canteen / tray / plate context: split the plate before label OCR.
  if (preferPlate && shouldRunPlatePass(result)) return "plate";
  // Restaurant meal with a single weak item — still prefer plate over label.
  if (
    preferPlate &&
    context === "restaurant" &&
    (result.photoKind === "meal" || result.photoKind === undefined) &&
    (result.items?.length ?? 0) < 2 &&
    !result.barcode?.trim()
  ) {
    return "plate";
  }

  if (shouldRunLabelPass(result)) return "label";
  // Mixed plates are sometimes misclassified as package — split before package front.
  if (shouldRunPlatePass(result)) return "plate";
  if (shouldRunPackagePass(result)) return "package";
  if (shouldRunStickerPass(result)) return "sticker";
  return null;
}
