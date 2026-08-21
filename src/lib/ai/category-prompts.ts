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

/** Short second-pass when the photo is (or looks like) a barcode close-up. */
export function buildBarcodeVisionPrompt(): string {
  return `На фото штрихкод продукта. Прочитай ТОЛЬКО цифры кода.

Верни JSON без markdown:
${CATEGORY_JSON_SHAPE}

Правила:
- photoKind: "barcode"
- barcode: только цифры EAN-8/12/13 (без пробелов). Если не читается — ""
- dishName/brand: с этикетки рядом со штрихкодом, если видны; иначе ""
- calories/macros/fiber/sugar/portionGrams/per100g: 0 (питание подтянет база по коду)
- items: [], alternatives: []
- не выдумывай цифры штрихкода`;
}
