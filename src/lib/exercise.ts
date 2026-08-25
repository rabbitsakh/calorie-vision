/** Quick-add presets for the exercise tracker (kcal + default Russian labels). */
export type ExerciseQuickChip = {
  caloriesBurned: number;
  label: string;
};

export const EXERCISE_QUICK_CHIPS: readonly ExerciseQuickChip[] = [
  { caloriesBurned: 150, label: "Ходьба" },
  { caloriesBurned: 250, label: "Зал" },
  { caloriesBurned: 400, label: "Бег" },
  { caloriesBurned: 600, label: "Интервалы" },
] as const;

export const EXERCISE_LABEL_MAX = 80;
export const EXERCISE_CALORIES_MIN = 1;
export const EXERCISE_CALORIES_MAX = 5000;

/** Resolve label for a quick chip calorie amount; falls back to "Тренировка". */
export function defaultLabelForCalories(caloriesBurned: number): string {
  const chip = EXERCISE_QUICK_CHIPS.find((c) => c.caloriesBurned === caloriesBurned);
  return chip?.label ?? "Тренировка";
}

export function normalizeExerciseLabel(label: unknown): string | null {
  if (typeof label !== "string") return null;
  const trimmed = label.trim();
  if (trimmed.length < 1 || trimmed.length > EXERCISE_LABEL_MAX) return null;
  return trimmed;
}

export function normalizeCaloriesBurned(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  if (rounded < EXERCISE_CALORIES_MIN || rounded > EXERCISE_CALORIES_MAX) return null;
  return rounded;
}
