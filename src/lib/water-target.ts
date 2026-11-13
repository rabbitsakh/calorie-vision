/** Запасной объём, если нет ни веса, ни ручной цели. */
export const WATER_DAILY_TARGET_ML = 2000;

/**
 * Ориентир EFSA: 2,5 л у мужчины около 70 кг и 2,0 л у женщины около 60 кг.
 * Дальше линейно от веса.
 */
export const WATER_ANCHOR_ML: Record<"MALE" | "FEMALE", number> = {
  MALE: 2500,
  FEMALE: 2000,
};
export const WATER_ANCHOR_KG: Record<"MALE" | "FEMALE", number> = {
  MALE: 70,
  FEMALE: 60,
};

/** Добавка в день заметной тренировки, середина вилки 0,4–0,8 л. */
export const TRAINING_WATER_BONUS_ML = 500;

/**
 * Вода от веса. Ручную цель сюда не передают — её не перезаписываем.
 */
export function recommendWaterMl(
  weightKg: number,
  sex?: "MALE" | "FEMALE" | null,
  trainingDay = false,
): number {
  const resolved = sex === "MALE" ? "MALE" : "FEMALE";
  const mlPerKg = WATER_ANCHOR_ML[resolved] / WATER_ANCHOR_KG[resolved];
  const raw = weightKg > 0 ? weightKg * mlPerKg : WATER_DAILY_TARGET_ML;
  const withTraining = raw + (trainingDay ? TRAINING_WATER_BONUS_ML : 0);
  return Math.min(WATER_TARGET_MAX_ML, Math.max(WATER_TARGET_MIN_ML, Math.round(withTraining)));
}

/** Softer weekly habit threshold (badge/challenge “good enough” days). */
export const WATER_HABIT_DAY_ML = 1500;

const WATER_TARGET_MIN_ML = 500;
const WATER_TARGET_MAX_ML = 6000;

/** Resolve personal water goal or fall back to the shared default. */
export function resolveWaterTargetMl(override?: number | null): number {
  if (
    override != null &&
    Number.isFinite(override) &&
    override >= WATER_TARGET_MIN_ML &&
    override <= WATER_TARGET_MAX_ML
  ) {
    return Math.round(override);
  }
  return WATER_DAILY_TARGET_ML;
}

export function isValidWaterTargetMl(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= WATER_TARGET_MIN_ML &&
    value <= WATER_TARGET_MAX_ML
  );
}
