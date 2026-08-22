/** Compact JSON shape shared by vision prompts (keeps completions consistent). */
export const FOOD_JSON_SHAPE = `{
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
 * Main vision prompt — kept short to save GigaChat tokens.
 * Category-specific follow-ups live in later PRs / separate builders.
 */
export const FOOD_RECOGNITION_PROMPT = `Ты диетолог и CV-эксперт. Проанализируй ФОТО еды.

photoKind: meal | package | label | barcode
- meal: готовая еда на тарелке/в контейнере
- package: заводская упаковка без крупной таблицы КБЖУ
- label: этикетка / таблица пищевой ценности
- barcode: крупно виден штрихкод

Верни ТОЛЬКО JSON без markdown:
${FOOD_JSON_SHAPE}

Правила:
- barcode: только цифры EAN/UPC если видны, иначе ""
- brand: с упаковки если виден
- dishName: продукт/блюдо на русском (не «еда»/«упаковка»). Смешанная тарелка — краткий список через запятую
- portionGrams: meal/items > 0 (типично 150–300 г/позицию). package/label/barcode — нетто с упаковки или 0
- per100g: только если явно «на 100 г»; иначе нули
- calories/protein/fat/carbs — на ВСЮ порцию portionGrams (не на 100 г)
- fiber/sugar: не включай в JSON если не уверен; для мяса/рыбы/яиц можно 0
- meal + несколько разных продуктов → items 2–8 с КБЖУ и portionGrams; иначе items []
- alternatives: 0–3 варианта с calories и protein/fat/carbs если можешь; иначе []
- не еда → dishName "Не удалось распознать еду", calories 0, confidence 0.1

Пример смешанной тарелки:
{"photoKind":"meal","dishName":"Стейк, картофель, салат","brand":"","barcode":"","calories":670,"protein":46,"fat":33,"carbs":32,"fiber":5,"sugar":4,"portionGrams":430,"confidence":0.78,"alternatives":[],"items":[{"dishName":"Стейк говяжий","calories":400,"protein":40,"fat":20,"carbs":0,"fiber":0,"sugar":0,"portionGrams":150,"confidence":0.82},{"dishName":"Картофель запечённый","calories":180,"protein":4,"fat":6,"carbs":28,"fiber":3,"sugar":1,"portionGrams":200,"confidence":0.8},{"dishName":"Салат овощной","calories":90,"protein":2,"fat":7,"carbs":4,"fiber":2,"sugar":3,"portionGrams":80,"confidence":0.7}],"per100g":{"calories":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"sugar":0}}`;

/** Short retry payload — do NOT resend the full main prompt. */
export const FOOD_RECOGNITION_RETRY_PROMPT = `По фото еды верни ТОЛЬКО валидный JSON (без markdown) по схеме:
${FOOD_JSON_SHAPE}

Исправь предыдущий ответ: валидный JSON; для смешанной тарелки items 2–8 с ненулевыми calories/portionGrams; fiber/sugar — только если знаешь (не ставь 0 «на всякий случай»).`;

/** @deprecated use FOOD_RECOGNITION_RETRY_PROMPT as a full retry message */
export const FOOD_RECOGNITION_RETRY_HINT = `Предыдущий ответ был неполным или невалидным JSON.
Верни ТОЛЬКО валидный JSON по схеме. Если на тарелке несколько разных продуктов — обязательно заполни items (2–8) с ненулевыми calories/portionGrams. Укажи fiber и sugar (0 если неизвестно). Не используй markdown.`;

export function buildFoodLookupPrompt(dishName: string): string {
  return `Ты диетолог. Пользователь указал название блюда: "${dishName}".

Оцени типичную одну порцию этого блюда (домашняя/кафе, Россия) и верни ТОЛЬКО JSON без markdown:
{
  "photoKind": "meal",
  "dishName": "уточнённое название на русском",
  "brand": "",
  "barcode": "",
  "calories": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "fiber": 0,
  "sugar": 0,
  "saturatedFat": 0,
  "portionGrams": 0,
  "per100g": { "calories": 0, "protein": 0, "fat": 0, "carbs": 0, "fiber": 0, "sugar": 0, "saturatedFat": 0 },
  "confidence": 0.0,
  "alternatives": []
}

Правила:
- dishName: исправь опечатки, сделай название понятным (на русском)
- calories, protein, fat, carbs, fiber, sugar: для ВСЕЙ указанной порции (portionGrams), не на 100 г/100 мл
- portionGrams: примерный вес порции в граммах; для напитков 1 мл ≈ 1 г (бутылка 500 мл → 500)
- для пива, лимонада, сока: типичная порция — бутылка/бокал (330–500 мл); светлое пиво ~40–45 ккал/100 мл → 500 мл ≈ 200–225 ккал на всю порцию
- если указываешь КБЖУ на 100 г/100 мл — заполни per100g и пересчитай calories/БЖУ на portionGrams
- fiber и sugar ОБЯЗАТЕЛЬНЫ (ключи всегда присутствуют, числа ≥ 0). Не оставляй null и не пропускай поля
  - фрукты/ягоды/овощи/каши/хлеб: оба обычно > 0 (пример: хурма 150 г → fiber ≈ 2.5–4, sugar ≈ 18–25)
  - мясо/рыба/яйца/масло: fiber 0, sugar 0
  - 0 только если действительно нет клетчатки/сахара, а не «не знаю»
- confidence:
  - 0.9+: хорошо известное блюдо с устойчивой калорийностью
  - 0.7–0.9: типичное блюдо, вес может варьироваться
  - 0.4–0.7: расплывчатое название, данные приблизительные
- alternatives: оставь пустым массивом
- если название расплывчатое («салат», «каша») — уточни типичный вариант для России`;
}

/** Short follow-up when the main lookup omitted fiber/sugar. */
export function buildFiberSugarLookupPrompt(dishName: string, portionGrams?: number): string {
  const portion =
    portionGrams && portionGrams > 0 ? ` порция ${Math.round(portionGrams)} г` : "";
  return `Для блюда «${dishName.trim()}»${portion} оцени клетчатку и сахара.

Верни ТОЛЬКО JSON без markdown:
{"fiber": 0, "sugar": 0}

Правила:
- fiber и sugar — граммы на ВСЮ порцию (не на 100 г)
- ключи fiber и sugar обязательны
- фрукты/овощи/каши/хлеб: обычно оба > 0 (хурма ~150 г → fiber 2.5–4, sugar 18–25)
- мясо/рыба/яйца/масло: fiber 0, sugar 0`;
}
