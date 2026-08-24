import {
  CALORIE_GOAL_CORRIDOR_RATIO,
  isCalorieGoalCorridor,
  type GoalPace,
  type WeightGoal,
} from "@/lib/diet";
import { formatDateInput, parseDateInput } from "@/lib/dates";
import { pluralDays } from "@/lib/russian-text";

export type DayCalories = {
  date: string;
  calories: number;
};

export type CorridorStreakAlert = {
  direction: "above" | "below";
  days: number;
  avgDiff: number;
  message: string;
};

/** Classify a logged day vs calorie target: in / above / below the ±8% corridor. */
export function dayVsCorridor(
  calories: number,
  target: number,
): "empty" | "in" | "above" | "below" {
  if (!(calories > 0) || !(target > 0)) return "empty";
  if (isCalorieGoalCorridor(calories, target)) return "in";
  return calories > target ? "above" : "below";
}

/**
 * Find a trailing streak of days all above or all below the calorie corridor.
 * Skips empty days; requires `minDays` consecutive logged days in the same direction.
 */
export function detectCalorieCorridorStreak(
  days: DayCalories[],
  target: number | null | undefined,
  minDays = 3,
): CorridorStreakAlert | null {
  if (!target || target <= 0 || days.length === 0) return null;

  const logged = days.filter((d) => d.calories > 0);
  if (logged.length < minDays) return null;

  // Walk from the end (most recent)
  const recent = [...logged].reverse();
  const first = dayVsCorridor(recent[0]!.calories, target);
  if (first !== "above" && first !== "below") return null;

  let streak = 0;
  let diffSum = 0;
  for (const day of recent) {
    const vs = dayVsCorridor(day.calories, target);
    if (vs !== first) break;
    streak += 1;
    diffSum += day.calories - target;
  }

  if (streak < minDays) return null;

  const avgDiff = Math.round(Math.abs(diffSum) / streak);
  const direction = first;
  const message =
    direction === "above"
      ? `Уже ${streak} ${pluralDays(streak)} подряд выше цели примерно на ${avgDiff} ккал. Попробуйте чуть меньшую порцию ужина или заменить перекус на белковый.`
      : `Уже ${streak} ${pluralDays(streak)} подряд ниже цели примерно на ${avgDiff} ккал. Добавьте плотный приём или перекус, чтобы не уходить в жёсткий недобор.`;

  return { direction, days: streak, avgDiff, message };
}

export type WeekSummary = {
  daysLogged: number;
  daysInCorridor: number | null;
  avgCalories: number;
  calorieTarget: number | null;
  weightChangeKg: number | null;
  bestDay: { date: string; calories: number } | null;
  headline: string;
};

/** Compact week rollup for StatsView when period = 7 days. */
export function buildWeekSummary(
  days: Array<DayCalories & { weightKg?: number | null }>,
  calorieTarget: number | null | undefined,
): WeekSummary | null {
  if (days.length === 0) return null;

  const logged = days.filter((d) => d.calories > 0);
  if (logged.length === 0) return null;

  const avgCalories = Math.round(
    logged.reduce((s, d) => s + d.calories, 0) / logged.length,
  );

  let daysInCorridor: number | null = null;
  if (calorieTarget && calorieTarget > 0) {
    daysInCorridor = logged.filter(
      (d) => dayVsCorridor(d.calories, calorieTarget) === "in",
    ).length;
  }

  const withWeight = days.filter(
    (d): d is DayCalories & { weightKg: number } =>
      typeof d.weightKg === "number" && d.weightKg > 0,
  );
  let weightChangeKg: number | null = null;
  if (withWeight.length >= 2) {
    const first = withWeight[0]!.weightKg;
    const last = withWeight[withWeight.length - 1]!.weightKg;
    weightChangeKg = Math.round((last - first) * 10) / 10;
  }

  let bestDay: WeekSummary["bestDay"] = null;
  if (calorieTarget && calorieTarget > 0) {
    bestDay = [...logged].sort(
      (a, b) =>
        Math.abs(a.calories - calorieTarget) - Math.abs(b.calories - calorieTarget),
    )[0] ?? null;
  } else {
    bestDay = [...logged].sort((a, b) => b.calories - a.calories)[0] ?? null;
  }

  const targetPart = calorieTarget
    ? daysInCorridor != null
      ? ` · в коридоре ${daysInCorridor} из ${logged.length}`
      : ` · цель ${calorieTarget} ккал`
    : "";
  const headline = `За 7 дней: среднее ${avgCalories} ккал${targetPart}`;

  return {
    daysLogged: logged.length,
    daysInCorridor,
    avgCalories,
    calorieTarget: calorieTarget ?? null,
    weightChangeKg,
    bestDay: bestDay ? { date: bestDay.date, calories: bestDay.calories } : null,
    headline,
  };
}

export type MoodNote = { date: string; mood: number | null };

/** Actionable mood ↔ food tip (not only a correlation sentence). */
export function buildMoodFoodInsight(
  diaryNotes: MoodNote[],
  mealByDate: Map<string, number>,
  calorieTarget: number | null | undefined,
): string | null {
  if (!calorieTarget || diaryNotes.length < 3) return null;

  const highMoodDays = diaryNotes.filter((n) => (n.mood ?? 0) >= 4);
  const lowMoodDays = diaryNotes.filter((n) => (n.mood ?? 0) <= 2);

  const onTarget = (date: string) => {
    const cal = mealByDate.get(date) ?? 0;
    if (cal <= 0) return false;
    return Math.abs(cal - calorieTarget) <= calorieTarget * 0.1;
  };

  const highOnTarget = highMoodDays.filter((n) => onTarget(n.date)).length;
  const lowOnTarget = lowMoodDays.filter((n) => onTarget(n.date)).length;
  const highPct = highMoodDays.length > 0 ? highOnTarget / highMoodDays.length : 0;
  const lowPct = lowMoodDays.length > 0 ? lowOnTarget / lowMoodDays.length : 0;

  if (highMoodDays.length >= 2 && highPct >= 0.5 && highPct > lowPct + 0.15) {
    return `В дни с настроением 4–5 вы чаще попадали в цель (${highOnTarget} из ${highMoodDays.length}). Замечайте, что помогало — сон, прогулка, привычный завтрак — и повторяйте это в «сложные» дни.`;
  }

  if (lowMoodDays.length >= 2 && lowPct < highPct) {
    return `В дни с низким настроением цель достигалась реже. Заранее подготовьте простой «план Б»: белковый перекус или готовый обед, чтобы не решать всё с нуля, когда тяжело.`;
  }

  // Low mood + overeating pattern
  if (lowMoodDays.length >= 2) {
    const lowOver = lowMoodDays.filter((n) => {
      const cal = mealByDate.get(n.date) ?? 0;
      return cal > calorieTarget * (1 + CALORIE_GOAL_CORRIDOR_RATIO);
    }).length;
    if (lowOver / lowMoodDays.length >= 0.5) {
      return `В дни с настроением 1–2 калории чаще уходили выше цели. Попробуйте короткий чек-in до ужина: вода + белок, и только потом решать про «награду».`;
    }
  }

  const avgMood =
    diaryNotes.reduce((s, n) => s + (n.mood ?? 0), 0) / diaryNotes.length;
  return `За период отмечено ${diaryNotes.length} ${pluralDays(diaryNotes.length)} с настроением (среднее ${avgMood.toFixed(1)}/5). Отмечайте вечерний чек-in — так проще заметить, какие дни еда и самочувствие идут рука об руку.`;
}

/** Typical kg/week by pace when there is no measured trend yet. */
export function expectedKgPerWeek(
  goal: WeightGoal,
  pace: GoalPace | null | undefined,
): number | null {
  if (goal === "MAINTAIN") return null;
  const sign = goal === "LOSE" ? -1 : 1;
  const mag =
    pace === "SIMPLE" ? 0.25 : pace === "FAST" ? 0.75 : 0.5; // HEALTHY default
  return sign * mag;
}

export type WeightForecast = {
  forecastDate: string;
  weeksRemaining: number;
  kgPerWeek: number;
  source: "trend" | "pace";
  message: string;
};

/**
 * Forecast when target weight is reached from recent trend, falling back to pace.
 * `kgPerWeek` is signed (negative = losing).
 */
export function forecastGoalDate(params: {
  currentKg: number;
  targetKg: number;
  goal: WeightGoal;
  pace?: GoalPace | null;
  /** Observed kg change over the span (newest − oldest). */
  observedChangeKg?: number | null;
  /** Calendar days spanning the observed change (≥ 7 preferred). */
  observedDays?: number | null;
  today?: Date;
}): WeightForecast | null {
  const {
    currentKg,
    targetKg,
    goal,
    pace = null,
    observedChangeKg = null,
    observedDays = null,
    today = new Date(),
  } = params;

  if (goal === "MAINTAIN") return null;
  if (!(currentKg > 0) || !(targetKg > 0)) return null;

  const remaining = targetKg - currentKg;
  // Wrong direction relative to goal → no forecast
  if (goal === "LOSE" && remaining >= -0.05) return null; // already at/below target
  if (goal === "GAIN" && remaining <= 0.05) return null;
  if (goal === "LOSE" && remaining > 0) return null; // target above current while losing
  if (goal === "GAIN" && remaining < 0) return null;

  const absRemaining = Math.abs(remaining);
  if (absRemaining < 0.1) return null;

  let kgPerWeek: number | null = null;
  let source: "trend" | "pace" = "pace";

  if (
    observedChangeKg != null &&
    observedDays != null &&
    observedDays >= 7 &&
    Math.abs(observedChangeKg) >= 0.2
  ) {
    const weekly = (observedChangeKg / observedDays) * 7;
    // Trend must move toward the target
    const towardTarget =
      (goal === "LOSE" && weekly < -0.05) || (goal === "GAIN" && weekly > 0.05);
    if (towardTarget) {
      kgPerWeek = Math.round(weekly * 100) / 100;
      source = "trend";
    }
  }

  if (kgPerWeek == null) {
    kgPerWeek = expectedKgPerWeek(goal, pace);
    source = "pace";
  }
  if (kgPerWeek == null || Math.abs(kgPerWeek) < 0.05) return null;

  const weeksRemaining = Math.max(1, Math.ceil(absRemaining / Math.abs(kgPerWeek)));
  // Cap absurd forecasts
  if (weeksRemaining > 104) return null;

  const forecast = new Date(today);
  forecast.setHours(12, 0, 0, 0);
  forecast.setDate(forecast.getDate() + weeksRemaining * 7);
  const forecastDate = formatDateInput(forecast);

  const rateLabel = `${kgPerWeek > 0 ? "+" : "−"}${Math.abs(kgPerWeek).toFixed(2)} кг/нед`;
  const sourceLabel =
    source === "trend" ? "по вашему темпу" : "при выбранном темпе цели";
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDateInput(forecastDate));
  const weekWord = pluralWeeks(weeksRemaining);

  return {
    forecastDate,
    weeksRemaining,
    kgPerWeek,
    source,
    message: `Прогноз ${sourceLabel} (${rateLabel}): около ${dateLabel} — ещё ~${weeksRemaining} ${weekWord}`,
  };
}

function pluralWeeks(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return "недель";
  if (mod10 === 1) return "неделя";
  if (mod10 >= 2 && mod10 <= 4) return "недели";
  return "недель";
}
