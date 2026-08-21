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

/** Second-pass for bottles / cans / cups of drinks. */
export function buildDrinkVisionPrompt(): string {
  return `На фото напиток: бутылка, банка, стакан, тетрапак. Оцени объём и КБЖУ порции.

Верни JSON без markdown:
${CATEGORY_JSON_SHAPE}

Правила:
- photoKind: "package" для заводской бутылки/банки; "meal" для налитого стакана/чашки
- dishName: конкретный напиток на русском (сок, молоко, кофе латте, пиво…)
- brand: с этикетки если виден
- barcode: цифры если читаются, иначе ""
- portionGrams: объём порции в мл как число (типично 200–500 для бутылки, 150–350 для стакана). 1 мл ≈ 1 г для учёта
- calories/protein/fat/carbs/fiber/sugar — на ВЕСЬ объём portionGrams (не на 100 мл)
- sugar: особенно важен для соков/газировки/молочных напитков
- если на этикетке «на 100 мл» — заполни per100g и пересчитай верхние поля на объём
- items: [], alternatives: []
- не путай твёрдую еду с напитком`;
}
