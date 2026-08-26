import type { GoalPace, NutrientComparison, Sex, WeightGoal } from "@/lib/diet";
import type { FoodRecognitionResult } from "@/lib/food-types";

export type RecognitionResponse = {
  imagePath: string;
  previewUrl?: string;
  recognition: FoodRecognitionResult;
  /** True while post-vision enrichment (OFF / fiber-sugar) is still running. */
  enriching?: boolean;
};

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: "Завтрак",
  LUNCH: "Обед",
  DINNER: "Ужин",
  SNACK: "Перекус",
};

/** Compact diary chips — keep one row on narrow phones. */
export const MEAL_TYPE_SHORT_LABELS: Record<MealType, string> = {
  BREAKFAST: "Завтр.",
  LUNCH: "Обед",
  DINNER: "Ужин",
  SNACK: "Перек.",
};

export type MealEntry = {
  id: string;
  date: string;
  dishName: string;
  calories: number;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber?: number | null;
  sugar?: number | null;
  portionGrams: number | null;
  confidence: number | null;
  imagePath: string | null;
  mealGroupId: string | null;
  mealType: MealType | null;
  wasCorrected: boolean;
  originalDish: string | null;
  originalCalories: number | null;
  recognitionSource?: string | null;
  photoKind?: string | null;
  barcode?: string | null;
  createdAt: string;
};

export type DietTarget = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber?: number;
  sugar?: number;
};

export type DayMealsResponse = {
  entries: MealEntry[];
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalFiber?: number;
  totalSugar?: number;
  goal: WeightGoal | null;
  goalPace: GoalPace | null;
  dietLabel: string | null;
  sex: Sex | null;
  weightKg: number | null;
  target: DietTarget | null;
  /** BMR → TDEE → goal explanation when targets are available. */
  calorieExplanation?: string | null;
  comparison: {
    calories: NutrientComparison;
    protein: NutrientComparison;
    fat: NutrientComparison;
    carbs: NutrientComparison;
    fiber?: NutrientComparison;
    sugar?: NutrientComparison;
  } | null;
  calorieTone: "good" | "warn" | "ok" | null;
};
