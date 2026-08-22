import type { FoodRecognitionResult } from "../food-types";

function isFailedName(name: string): boolean {
  return /не удалось распознать/i.test(name) || /^(еда|продукт|упаковка|food|package)$/i.test(name.trim());
}

/** Whether a package-front specialist pass is worth another call. */
export function shouldRunPackagePass(result: FoodRecognitionResult): boolean {
  if (result.photoKind !== "package") return false;

  const weakName = !result.dishName.trim() || isFailedName(result.dishName);
  const missingBrand = !result.brand?.trim();
  const missingNet =
    result.portionGrams === undefined || result.portionGrams <= 0 || result.portionGrams === 100;

  // Run when name is weak, or brand+net both missing (common front-of-pack miss).
  return weakName || (missingBrand && missingNet);
}

/** Prefer candidate with a clearer product name / brand / net weight. */
export function isBetterPackageResult(
  current: FoodRecognitionResult,
  candidate: FoodRecognitionResult,
): boolean {
  const score = (r: FoodRecognitionResult) => {
    let s = 0;
    if (r.dishName.trim() && !isFailedName(r.dishName)) s += 2;
    if (r.brand?.trim()) s += 1;
    if (r.portionGrams && r.portionGrams > 0 && r.portionGrams !== 100) s += 1;
    if (r.barcode?.trim()) s += 1;
    return s;
  };
  return score(candidate) > score(current);
}
