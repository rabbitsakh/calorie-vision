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
- portionGrams: meal/items > 0 (типично 150–300 г/позицию). package/label/barcode — нетто с упаковки (мл/г) или 0
- label/package: если на этикетке «100 мл» / «100 г» — заполни per100g (calories, БЖУ); calories/protein/fat/carbs на порцию = per100g × (portionGrams/100)
- meal/package без таблицы: per100g нули; calories/protein/fat/carbs — на всю порцию portionGrams
- fiber/sugar: не включай в JSON — подтянутся отдельно; для мяса/рыбы/яиц можно 0 только в items если уверен
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

/** When Open Food Facts has no hit for an EAN/UPC — ask GigaChat by barcode + optional web evidence. */
export function buildBarcodeLookupPrompt(barcode: string, webContext?: string): string {
  const code = barcode.trim();
  const webBlock = webContext?.trim()
    ? `\n\n${webContext.trim()}\n`
    : `\n\nИнтернет-подсказок нет — опирайся на знание штрихкодов РФ (префиксы 460…) и типичные товары.\n`;

  return `Ты диетолог и эксперт по фасованным продуктам из магазинов России/СНГ.
Пользователь отсканировал штрихкод (EAN-8/EAN-13/UPC): "${code}".
${webBlock}
Задача: определить КОНКРЕТНЫЙ продукт по этому штрихкоду, используя интернет-подсказки если они есть. Верни ТОЛЬКО JSON без markdown:
{
  "photoKind": "barcode",
  "dishName": "название продукта на русском",
  "brand": "бренд или пустая строка",
  "barcode": "${code}",
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
- barcode: верни ровно "${code}" без пробелов
- dishName: как на упаковке (русский). Если в title/snippet есть название — возьми его и почисти от магазинов (Ozon, WB…)
- brand: из подсказок или известный бренд
- portionGrams: вес/объём упаковки в граммах (напитки: 1 мл ≈ 1 г). Нет данных → 100
- calories/protein/fat/carbs/fiber/sugar: на ВСЮ порцию (portionGrams)
- если знаешь КБЖУ на 100 г — заполни per100g и пересчитай на portionGrams
- fiber и sugar обязательны (≥ 0)
- confidence:
  - 0.65–0.7: название подтверждено интернет-подсказками
  - 0.5–0.65: вероятный товар
  - ниже 0.5: слабые данные — всё равно заполни наиболее правдоподобный вариант
- alternatives: []
- НЕ возвращай пустой dishName и нулевые calories, если можешь оценить типичные КБЖУ для найденного названия`;
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

export function buildFiberSugarBatchLookupPrompt(
  items: Array<{ dishName: string; portionGrams?: number }>,
): string {
  const lines = items
    .map((item, index) => {
      const portion =
        item.portionGrams && item.portionGrams > 0
          ? `, порция ${Math.round(item.portionGrams)} г`
          : "";
      return `${index + 1}. ${item.dishName.trim()}${portion}`;
    })
    .join("\n");

  return `Для каждого блюда оцени клетчатку и сахара (граммы на всю порцию).

Верни ТОЛЬКО JSON-массив без markdown:
[{"dishName":"название","fiber":0,"sugar":0}]

Правила:
- порядок элементов как в списке; dishName совпадает с запросом
- fiber/sugar — граммы на всю порцию (не на 100 г)
- мясо/рыба/яйца: fiber 0, sugar 0
- фрукты/овощи/каши/хлеб: обычно оба > 0

Блюда:
${lines}`;
}
