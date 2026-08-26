/** Default water daily target — used when user has no personal override. */
export const WATER_DAILY_TARGET_ML = 2000;

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
