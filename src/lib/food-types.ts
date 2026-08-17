export type PhotoKind = "meal" | "package" | "label" | "barcode";

export const PHOTO_KINDS = new Set<PhotoKind>(["meal", "package", "label", "barcode"]);

export const RECOGNITION_SOURCE_LABELS: Record<string, string> = {
  gigachat: "Оценка по фото блюда",
  "gigachat-lookup": "Оценка по названию",
  "openfoodfacts-barcode": "Данные из базы по штрихкоду",
  "openfoodfacts-search": "Данные из базы по названию на упаковке",
  label: "Считано с этикетки",
};

export type FoodRecognitionResult = {
  dishName: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  portionGrams?: number;
  confidence: number;
  alternatives?: Array<{
    dishName: string;
    calories: number;
  }>;
  source?: string;
  photoKind?: PhotoKind;
  barcode?: string;
  brand?: string;
  per100g?: {
    calories: number;
    protein?: number;
    fat?: number;
    carbs?: number;
  };
};
