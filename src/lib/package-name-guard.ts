import type { FoodRecognitionResult } from "./food-types";

const SOUP_NAME_RE =
  /\bсуп\b|том[\s-]*ям|tom[\s-]*yum|борщ|солянк|рассольник|уха\b|окрошк|грибной\s+суп|куриный\s+суп/i;

const GRAIN_PACK_RE =
  /овсян|геркулес|хлопья|мюсли|granola|muesli|oatmeal|каша\s+быстр|porridge|гречк|манк|перлов/i;

const INSTANT_CUP_GRAMS_MAX = 120;
const DENSE_KCAL_PER_100_MIN = 250;

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/ё/g, "е");
}

/** kcal per 100 g/ml from portion or per100g block. */
export function estimateKcalPer100(result: FoodRecognitionResult): number | null {
  if (result.per100g && result.per100g.calories > 0) {
    return result.per100g.calories;
  }
  if (result.calories > 0 && result.portionGrams && result.portionGrams > 0) {
    return (result.calories / result.portionGrams) * 100;
  }
  return null;
}

export function looksLikeSoupName(name: string): boolean {
  const n = normalize(name);
  return n.length >= 3 && SOUP_NAME_RE.test(n);
}

export function looksLikeGrainPackName(name: string): boolean {
  const n = normalize(name);
  return n.length >= 3 && GRAIN_PACK_RE.test(n);
}

/** Soup name on a small dense portion — typical cup-of-soup vs instant-oats confusion. */
export function isSuspiciousSoupOnPackaged(result: FoodRecognitionResult): boolean {
  if (!looksLikeSoupName(result.dishName)) {
    return false;
  }

  const packaged =
    result.photoKind === "package" ||
    result.photoKind === "label" ||
    result.photoKind === "barcode";
  const portion = result.portionGrams ?? 0;
  const kcal100 = estimateKcalPer100(result);

  if (looksLikeGrainPackName(result.brand ?? "")) {
    return true;
  }

  if (packaged && portion > 0 && portion <= INSTANT_CUP_GRAMS_MAX && kcal100 !== null && kcal100 >= DENSE_KCAL_PER_100_MIN) {
    return true;
  }

  if (
    packaged &&
    portion > 0 &&
    portion <= INSTANT_CUP_GRAMS_MAX &&
    result.calories >= 100
  ) {
    return true;
  }

  return false;
}

/** Worth a package-front specialist pass to re-read large print on the pack. */
export function needsPackageIdentityPass(result: FoodRecognitionResult): boolean {
  if (isSuspiciousSoupOnPackaged(result)) {
    return true;
  }

  if (result.photoKind !== "package") {
    return false;
  }

  const weakName =
    !result.dishName.trim() ||
    /не удалось распознать/i.test(result.dishName) ||
    /^(еда|продукт|упаковка|food|package)$/i.test(result.dishName.trim());
  const missingBrand = !result.brand?.trim();
  const missingNet =
    result.portionGrams === undefined || result.portionGrams <= 0 || result.portionGrams === 100;

  return weakName || (missingBrand && missingNet);
}

/** Prefer grain/alternative names when soup on a pack is obviously wrong. */
export function repairPackagedMislabel(result: FoodRecognitionResult): FoodRecognitionResult {
  if (!isSuspiciousSoupOnPackaged(result)) {
    return result;
  }

  const brand = result.brand?.trim();
  if (brand && looksLikeGrainPackName(brand)) {
    return {
      ...result,
      dishName: brand,
      photoKind: result.photoKind ?? "package",
      confidence: Math.min(result.confidence, 0.72),
    };
  }

  for (const alt of result.alternatives ?? []) {
    const name = alt.dishName?.trim();
    if (!name || looksLikeSoupName(name) || !looksLikeGrainPackName(name)) {
      continue;
    }
    return {
      ...result,
      dishName: name,
      calories: alt.calories > 0 ? alt.calories : result.calories,
      protein: alt.protein ?? result.protein,
      fat: alt.fat ?? result.fat,
      carbs: alt.carbs ?? result.carbs,
      photoKind: result.photoKind ?? "package",
      confidence: Math.max(0.55, Math.min(result.confidence, alt.confidence ?? 0.75)),
    };
  }

  const portion = result.portionGrams ?? 0;
  const kcal100 = estimateKcalPer100(result);
  if (
    portion > 0 &&
    portion <= INSTANT_CUP_GRAMS_MAX &&
    kcal100 !== null &&
    kcal100 >= DENSE_KCAL_PER_100_MIN
  ) {
    return {
      ...result,
      dishName: "Овсянка быстрого приготовления",
      photoKind: result.photoKind ?? "package",
      confidence: Math.min(result.confidence, 0.68),
    };
  }

  return result;
}
