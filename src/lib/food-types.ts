export type PhotoKind = "meal" | "package" | "label" | "barcode";

export const PHOTO_KINDS = new Set<PhotoKind>(["meal", "package", "label", "barcode"]);

export const RECOGNITION_SOURCE_LABELS: Record<string, string> = {
  gigachat: "Оценка по фото блюда",
  "gigachat-lookup": "Оценка по названию",
  "openfoodfacts-barcode": "Данные из базы по штрихкоду",
  "openfoodfacts-search": "Данные из базы по названию на упаковке",
  "usda-fdc": "Данные USDA FoodData Central",
  label: "Считано с этикетки",
  "correction-memory": "Уточнено по прошлым исправлениям",
  "gigachat-plate": "Несколько блюд на тарелке",
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
  barcode?: string;
  brand?: string;
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
