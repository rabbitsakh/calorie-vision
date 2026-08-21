/** Shared compact JSON shape for short category passes. */
export const CATEGORY_JSON_SHAPE = `{
  "photoKind": "meal",
  "dishName": "название на русском",
  "brand": "",
  "barcode": "",
  "calories": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "fiber": 0,
  "sugar": 0,
  "portionGrams": 0,
  "per100g": {"calories":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"sugar":0},
  "confidence": 0.0,
  "alternatives": [],
  "items": []
}`;

/**
 * Second-pass focused on reading nutrition-facts table text.
 * Pair with a higher-resolution image upload — do not downscale for OCR-ish reads.
 */
export function buildLabelVisionPrompt(): string {
  return `На фото этикетка / таблица пищевой ценности (КБЖУ). Прочитай ЦИФРЫ с этикетки.

Верни JSON без markdown:
${CATEGORY_JSON_SHAPE}

Правила:
- photoKind: "label"
- dishName: название продукта с этикетки (рус/как написано)
- brand: бренд если виден, иначе ""
- barcode: только цифры если видны рядом, иначе ""
- если есть «на 100 г» / «на 100 мл» — заполни per100g (calories, protein, fat, carbs, fiber, sugar)
- клетчатка / пищевые волокна → fiber; сахара / of which sugars → sugar (0 если нет на этикетке)
- portionGrams: вес нетто / порции с этикетки, если указан; иначе 0
- если есть нетто и per100g — пересчитай верхние calories/БЖУ на нетто; иначе верхние calories=0 и опирайся на per100g
- items: [], alternatives: []
- не оценивай «на глаз» — только то, что читается на этикетке; нечитаемое → 0`;
}
