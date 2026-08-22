import { FOOD_JSON_SHAPE, FOOD_RECOGNITION_PROMPT } from "./prompt";

/** Main vision JSON without fiber/sugar — filled by post-vision enrichment. */
export const FOOD_JSON_SHAPE_SLIM = `{
  "photoKind": "meal",
  "dishName": "название на русском",
  "brand": "",
  "barcode": "",
  "calories": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "portionGrams": 0,
  "per100g": {"calories":0,"protein":0,"fat":0,"carbs":0},
  "confidence": 0.0,
  "alternatives": [],
  "items": []
}`;

export type PromptVariant = "main" | "slim" | "category-first";

export type VisionPromptHints = {
  barcodeHint?: string;
  /** width / height */
  aspectRatio?: number;
};

const CATEGORY_FIRST_PROMPT = `Ты диетолог и CV-эксперт. Проанализируй ФОТО еды.

Шаг 1 — определи photoKind: meal | package | label | barcode
- meal: готовая еда на тарелке/в контейнере
- package: заводская упаковка без крупной таблицы КБЖУ
- label: этикетка / таблица пищевой ценности
- barcode: крупно виден штрихкод

Шаг 2 — верни ТОЛЬКО JSON без markdown:
${FOOD_JSON_SHAPE_SLIM}

Правила:
- barcode: только цифры EAN/UPC если видны, иначе ""
- brand: с упаковки если виден
- dishName: продукт/блюдо на русском (не «еда»/«упаковка»). Смешанная тарелка — краткий список через запятую
- portionGrams: meal/items > 0 (типично 150–300 г/позицию). package/label/barcode — нетто с упаковки или 0
- per100g: только если явно «на 100 г»; иначе нули
- calories/protein/fat/carbs — на ВСЮ порцию portionGrams (не на 100 г)
- meal + несколько разных продуктов → items 2–8 с КБЖУ и portionGrams; иначе items []
- alternatives: 0–3 варианта с calories и protein/fat/carbs если можешь; иначе []
- не еда → dishName "Не удалось распознать еду", calories 0, confidence 0.1`;

const SLIM_PROMPT = `Ты диетолог и CV-эксперт. Проанализируй ФОТО еды.

photoKind: meal | package | label | barcode
- meal: готовая еда на тарелке/в контейнере
- package: заводская упаковка без крупной таблицы КБЖУ
- label: этикетка / таблица пищевой ценности
- barcode: крупно виден штрихкод

Верни ТОЛЬКО JSON без markdown:
${FOOD_JSON_SHAPE_SLIM}

Правила:
- barcode: только цифры EAN/UPC если видны, иначе ""
- brand: с упаковки если виден
- dishName: продукт/блюдо на русском (не «еда»/«упаковка»). Смешанная тарелка — краткий список через запятую
- portionGrams: meal/items > 0 (типично 150–300 г/позицию). package/label/barcode — нетто с упаковки или 0
- per100g: только если явно «на 100 г»; иначе нули
- calories/protein/fat/carbs — на ВСЮ порцию portionGrams (не на 100 г)
- meal + несколько разных продуктов → items 2–8 с КБЖУ и portionGrams; иначе items []
- alternatives: 0–3 варианта с calories и protein/fat/carbs если можешь; иначе []
- не еда → dishName "Не удалось распознать еду", calories 0, confidence 0.1`;

export function resolvePromptVariant(): PromptVariant {
  const env = process.env.GIGACHAT_PROMPT_VARIANT?.trim().toLowerCase();
  if (env === "slim" || env === "category-first") {
    return env;
  }
  return "main";
}

function hintLines(hints?: VisionPromptHints): string {
  if (!hints) {
    return "";
  }

  const lines: string[] = [];
  if (hints.barcodeHint) {
    lines.push(
      `- На устройстве уже прочитан штрихкод ${hints.barcodeHint} — проверь на фото и подставь в barcode если совпадает.`,
    );
  }
  if (hints.aspectRatio !== undefined && Number.isFinite(hints.aspectRatio)) {
    if (hints.aspectRatio < 0.75) {
      lines.push("- Фото вертикальное — вероятно бутылка/упаковка или этикетка крупным планом.");
    } else if (hints.aspectRatio > 1.35) {
      lines.push("- Фото горизонтальное — вероятно тарелка или несколько блюд.");
    }
  }

  if (lines.length === 0) {
    return "";
  }

  return `\n\nПодсказки клиента:\n${lines.join("\n")}`;
}

export function buildVisionPrompt(
  variant: PromptVariant = resolvePromptVariant(),
  hints?: VisionPromptHints,
): string {
  const suffix = hintLines(hints);
  switch (variant) {
    case "category-first":
      return CATEGORY_FIRST_PROMPT + suffix;
    case "slim":
      return SLIM_PROMPT + suffix;
    default:
      return FOOD_RECOGNITION_PROMPT + suffix;
  }
}

/** For offline A/B eval — token-ish length proxy. */
export function visionPromptCharLength(variant: PromptVariant): number {
  return buildVisionPrompt(variant).length;
}

/** @deprecated use FOOD_JSON_SHAPE_SLIM in new slim prompts */
export { FOOD_JSON_SHAPE };
