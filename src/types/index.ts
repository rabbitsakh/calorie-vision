export type RecognitionResponse = {
  imagePath: string;
  previewUrl?: string;
  recognition: {
    dishName: string;
    calories: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    portionGrams?: number;
    confidence: number;
    alternatives?: Array<{ dishName: string; calories: number }>;
  };
};

export type MealEntry = {
  id: string;
  date: string;
  dishName: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  portionGrams: number | null;
  confidence: number | null;
  imagePath: string | null;
  wasCorrected: boolean;
  originalDish: string | null;
  originalCalories: number | null;
  createdAt: string;
};

export type DayMealsResponse = {
  entries: MealEntry[];
  totalCalories: number;
};
