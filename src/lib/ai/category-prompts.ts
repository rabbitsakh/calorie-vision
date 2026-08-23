/** Shared compact JSON shape for short category second-passes. */
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
- если указаны и ккал/100 мл, и кДж/100 мл — в per100g.calories только ккал (кДж ÷ 4,184), не путай с кДж
- клетчатка / пищевые волокна → fiber; сахара / of which sugars → sugar (0 если нет на этикетке)
- portionGrams: вес нетто / порции с этикетки, если указан; иначе 0
- если есть нетто и per100g — пересчитай верхние calories/БЖУ на нетто; иначе верхние calories=0 и опирайся на per100g
- items: [], alternatives: []
- не оценивай «на глаз» — только то, что читается на этикетке; нечитаемое → 0`;
}

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

/** Second-pass for bottles / cans / cups of drinks. */
export function buildDrinkVisionPrompt(): string {
  return `На фото напиток: бутылка, банка, стакан, тетрапак. Оцени объём и КБЖУ порции.

Верни JSON без markdown:
${CATEGORY_JSON_SHAPE}

Правила:
- photoKind: "package" для заводской бутылки/банки; "meal" для налитого стакана/чашки
- dishName: конкретный напиток на русском (сок, молоко, кофе латте, пиво…). Стакан/бутылка/тетрапак молока → «Молоко» с жирностью если видна; не путай с кофейными напитками
- brand: с этикетки если виден
- barcode: цифры если читаются, иначе ""
- portionGrams: объём порции в мл как число (типично 200–500 для бутылки, 150–350 для стакана). 1 мл ≈ 1 г для учёта
- calories/protein/fat/carbs/fiber/sugar — на ВЕСЬ объём portionGrams (не на 100 мл)
- sugar: особенно важен для соков/газировки/молочных напитков
- если на этикетке «на 100 мл» — заполни per100g и пересчитай верхние поля на объём
- items: [], alternatives: []
- не путай твёрдую еду с напитком`;
}
