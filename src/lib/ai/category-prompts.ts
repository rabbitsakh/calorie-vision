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
 * Second-pass for cafe / ready-meal printed stickers
 * (takeaway lids, deli boxes, supermarket salad bowls with a paper label).
 */
export function buildStickerVisionPrompt(): string {
  return `На фото готовое блюдо с НАПЕЧАТАННОЙ наклейкой / стикером (кафе, кулинария, салатница, ланчбокс). Прочитай текст стикера.

Верни JSON без markdown:
${CATEGORY_JSON_SHAPE}

Правила:
- photoKind: "label" (стикер = печатная этикетка готового блюда)
- dishName: название блюда со стикера
- brand: название кафе/магазина со стикера, если есть
- barcode: только если читаются цифры, иначе ""
- calories/protein/fat/carbs/fiber/sugar: цифры со стикера на порцию (не оценивай на глаз)
- portionGrams: вес порции со стикера (г), иначе 0
- если на стикере «на 100 г» — заполни per100g; иначе per100g нули
- items: [], alternatives: []
- если стикер нечитаем — calories 0, confidence ≤ 0.4, dishName с видимого текста или ""`;
}
