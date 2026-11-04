import { hasValidEanChecksum, normalizeBarcode } from "@/lib/barcode";
import type { FoodRecognitionResult } from "@/lib/food-types";

export type BarcodeCatalogSource = "openfoodfacts" | "user" | "ru-sku";

/** One shared cache row: nutrients are always per 100 g (or 100 ml). */
export type BarcodeCatalogProduct = {
  barcode: string;
  name: string;
  brand?: string;
  kcalPer100: number;
  proteinPer100?: number;
  fatPer100?: number;
  carbsPer100?: number;
  packGrams?: number;
  imageUrl?: string;
  source: BarcodeCatalogSource;
  userContributed: boolean;
};

const NAME_MAX = 255;
const BRAND_MAX = 120;

/**
 * Порция из веса нетто. Упаковка тяжелее 500 г не подменяется на 100 г.
 * Если веса нет — undefined: пользователь указывает порцию сам.
 */
export function defaultPortionFromPack(packGrams?: number): number | undefined {
  if (packGrams === undefined || !Number.isFinite(packGrams) || packGrams <= 0) {
    return undefined;
  }
  return Math.round(packGrams);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function readNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function readMacro(
  value: unknown,
  bounds: { required: boolean; min: number; max: number },
): { ok: true; value?: number } | { ok: false } {
  if (value === undefined || value === null || value === "") {
    return bounds.required ? { ok: false } : { ok: true };
  }
  const parsed = readNumber(value);
  if (parsed === undefined || parsed < bounds.min || parsed > bounds.max) {
    return { ok: false };
  }
  return { ok: true, value: round1(parsed) };
}

/** Validate a user-contributed pack before it enters the shared cache. */
export function parseUserBarcodeProduct(
  input: unknown,
): { ok: true; product: BarcodeCatalogProduct } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Некорректные данные продукта" };
  }
  const body = input as Record<string, unknown>;
  const barcode = typeof body.barcode === "string" ? normalizeBarcode(body.barcode) : null;
  if (!barcode || !hasValidEanChecksum(barcode)) {
    return { ok: false, error: "Укажите корректный штрихкод (EAN-8, UPC или EAN-13)" };
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > NAME_MAX) {
    return { ok: false, error: "Укажите название продукта" };
  }

  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  if (brand.length > BRAND_MAX) {
    return { ok: false, error: "Слишком длинное название бренда" };
  }

  const kcal = readMacro(body.kcalPer100, { required: true, min: 0, max: 900 });
  if (!kcal.ok || kcal.value === undefined) {
    return { ok: false, error: "Укажите калории на 100 г (0–900)" };
  }
  const protein = readMacro(body.proteinPer100, { required: true, min: 0, max: 100 });
  const fat = readMacro(body.fatPer100, { required: true, min: 0, max: 100 });
  const carbs = readMacro(body.carbsPer100, { required: true, min: 0, max: 100 });
  if (!protein.ok || !fat.ok || !carbs.ok) {
    return { ok: false, error: "Укажите белки, жиры и углеводы на 100 г (0–100)" };
  }

  let packGrams: number | undefined;
  if (body.packGrams !== undefined && body.packGrams !== null && body.packGrams !== "") {
    const parsed = readNumber(body.packGrams);
    if (parsed === undefined || parsed < 1 || parsed > 5000) {
      return { ok: false, error: "Вес упаковки — от 1 до 5000 г" };
    }
    packGrams = Math.round(parsed);
  }

  return {
    ok: true,
    product: {
      barcode,
      name,
      brand: brand || undefined,
      kcalPer100: kcal.value,
      proteinPer100: protein.value,
      fatPer100: fat.value,
      carbsPer100: carbs.value,
      packGrams,
      source: "user",
      userContributed: true,
    },
  };
}

export type BarcodeLabelDraft = {
  name: string;
  brand: string;
  kcalPer100: number;
  proteinPer100: number;
  fatPer100: number;
  carbsPer100: number;
  packGrams: string;
};

function stripLeadingBrand(name: string, brand: string): string {
  if (!brand) return name;
  if (name.toLowerCase().startsWith(brand.toLowerCase())) {
    return name.slice(brand.length).trim() || name;
  }
  return name;
}

/** Prefill the contribute form from a label photo (per 100 g, not the portion total). */
export function per100DraftFromRecognition(
  result: FoodRecognitionResult,
): BarcodeLabelDraft | null {
  const portion =
    result.portionGrams && result.portionGrams > 0 ? result.portionGrams : undefined;
  const per = result.per100g;
  let kcal: number | undefined;
  let protein: number | undefined;
  let fat: number | undefined;
  let carbs: number | undefined;

  if (per && Number.isFinite(per.calories) && per.calories > 0) {
    kcal = per.calories;
    protein = per.protein;
    fat = per.fat;
    carbs = per.carbs;
  } else if (portion && Number.isFinite(result.calories)) {
    const ratio = 100 / portion;
    kcal = result.calories * ratio;
    protein = result.protein === undefined ? undefined : result.protein * ratio;
    fat = result.fat === undefined ? undefined : result.fat * ratio;
    carbs = result.carbs === undefined ? undefined : result.carbs * ratio;
  } else if (Number.isFinite(result.calories) && result.calories >= 0) {
    kcal = result.calories;
    protein = result.protein;
    fat = result.fat;
    carbs = result.carbs;
  }

  if (kcal === undefined || !Number.isFinite(kcal) || kcal < 0) {
    return null;
  }

  const brand = result.brand?.trim() ?? "";
  const name = stripLeadingBrand(result.dishName.trim(), brand);
  if (!name) return null;

  return {
    name,
    brand,
    kcalPer100: round1(kcal),
    proteinPer100: round1(protein ?? 0),
    fatPer100: round1(fat ?? 0),
    carbsPer100: round1(carbs ?? 0),
    packGrams: portion && portion !== 100 ? String(Math.round(portion)) : "",
  };
}
