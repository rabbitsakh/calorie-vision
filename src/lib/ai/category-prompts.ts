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

/** Second-pass for factory package front (name + brand + net weight). */
export function buildPackageVisionPrompt(): string {
  return `На фото лицевая сторона заводской упаковки продукта (пачка, банка, коробка). Прочитай название и бренд.

Верни JSON без markdown:
${CATEGORY_JSON_SHAPE}

Правила:
- photoKind: "package"
- dishName: точное название продукта с упаковки (не «упаковка», не категория)
- brand: бренд с лицевой стороны, если виден
- barcode: только если цифры штрихкода читаются; иначе ""
- portionGrams: вес/объём нетто с упаковки (г или мл как число), иначе 0
- calories/macros/fiber/sugar/per100g: 0 — питание подтянет база по названию/штрихкоду
- items: [], alternatives: []
- не выдумывай бренд или вес`;
}
