import type { GoalPace, NutrientComparison, Sex, WeightGoal } from "@/lib/diet";
import type { FoodRecognitionResult } from "@/lib/food-types";

export type RecognitionResponse = {
  imagePath: string;
  previewUrl?: string;
  recognition: FoodRecognitionResult;
};

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  BREAKFAST: "Завтрак",
  LUNCH: "Обед",
  DINNER: "Ужин",
  SNACK: "Перекус",
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
