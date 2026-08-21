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

/** Second-pass when the photo is a mixed plate / container with several dishes. */
export function buildPlateVisionPrompt(): string {
  return `На фото смешанная тарелка или контейнер с НЕСКОЛЬКИМИ разными продуктами.

Верни JSON без markdown:
${CATEGORY_JSON_SHAPE}

Правила:
- photoKind: "meal"
- dishName: краткий список через запятую (2–6 названий)
- items: ОБЯЗАТЕЛЬНО 2–8 отдельных позиций. Каждая — своё блюдо/гарнир/салат
- для каждого item: dishName, calories, protein, fat, carbs, fiber, sugar, portionGrams (>0), confidence
- верхние calories/protein/fat/carbs/fiber/sugar/portionGrams = суммы по items
- barcode: "", brand: "", alternatives: [], per100g: все нули
- не сливай мясо и гарнир в один item
- не выдумывай блюда, которых нет на фото`;
}
