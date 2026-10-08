export type PhotoKind = "meal" | "package" | "label" | "barcode";

export const PHOTO_KINDS = new Set<PhotoKind>(["meal", "package", "label", "barcode"]);

export const RECOGNITION_SOURCE_LABELS: Record<string, string> = {
  gigachat: "Оценка по фото блюда",
  "gigachat-lookup": "Оценка по названию",
  "gigachat-barcode": "Оценка по штрихкоду (ИИ)",
  "openfoodfacts-barcode": "Данные из базы по штрихкоду",
  "openfoodfacts-search": "Данные из базы по названию на упаковке",
  label: "Считано с этикетки",
  "correction-memory": "Уточнено по прошлым исправлениям",
  "gigachat-plate": "Несколько блюд на тарелке",
  "ru-nutrition-table": "Типичные значения (справочник)",
  "ru-sku-cache": "Офлайн-подсказка по штрихкоду (RU)",
  "ru-name-sku": "Офлайн-подсказка по бренду (RU)",
  "custom-food": "Из ваших сохранённых продуктов",
  "off-staple-average": "Типичные значения (среднее по базе)",
};

/** Text-lookup routing: average staple vs branded pack. */
export type FoodLookupMode = "generic" | "branded";

export const FOOD_LOOKUP_MODE_LABELS: Record<FoodLookupMode, string> = {
  generic: "Типичные значения",
  branded: "По бренду",
};

export type FoodRecognitionResult = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  fiber?: number;
  sugar?: number;
  saturatedFat?: number;
  portionGrams?: number;
  confidence: number;
  alternatives?: Array<{
    dishName: string;
    calories: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fiber?: number;
    sugar?: number;
    portionGrams?: number;
  }>;
  source?: string;
  photoKind?: PhotoKind;
  /** True when post-vision OFF / nutrition enrichment hit its time budget. */
  enrichmentTimedOut?: boolean;
  barcode?: string;
  brand?: string;
  /** Set on text lookup: generic average vs branded SKU. */
  lookupMode?: FoodLookupMode;
  imageUrl?: string;
  per100g?: {
    calories: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fiber?: number;
    sugar?: number;
    saturatedFat?: number;
  };
  items?: FoodRecognitionResult[];
};
