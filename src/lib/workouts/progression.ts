/**
 * Per-exercise progression helpers: stall detection, deload, next-set autofill.
 * Strength progress is three levers — weight / volume (tonnage) / reps — not only kg.
 */

import { formatSuggestedKg, suggestNextWeightKg } from "@/lib/workouts/suggested-load";

export type ProgressionPoint = {
  date: string;
  topWeightKg: number;
  topReps: number;
  totalLoad: number;
};

/** How to progress next session for a strength move. */
export type ProgressionLever = "weight" | "volume" | "reps";

export type ProgressionOption = {
  lever: ProgressionLever;
  label: string;
  line: string;
  suggestedKg: number | null;
  suggestedReps: number | null;
};

export type ProgressionAdvice = {
  kind: "progress" | "hold" | "stall" | "deload" | "base";
  title: string;
  detail: string;
  /** Primary kg target (weight lever or deload). */
  suggestedKg: number | null;
  /** Top working kg this session (for display «макс»). */
  basisKg?: number | null;
  basisReps?: number | null;
  primaryLever?: ProgressionLever;
  options?: ProgressionOption[];
};

/** True when last `window` sessions share the same top weight (±0.25 kg). */
export function isStalled(
  points: readonly ProgressionPoint[],
  window = 3,
): boolean {
  if (points.length < window) return false;
  const slice = points.slice(-window);
  const first = slice[0]!.topWeightKg;
  if (!Number.isFinite(first) || first <= 0) return false;
  return slice.every((p) => Math.abs(p.topWeightKg - first) < 0.26);
}

export function suggestDeloadKg(lastKg: number, factor = 0.9): number {
  if (!Number.isFinite(lastKg) || lastKg <= 0) return 0;
  return Math.round(lastKg * factor * 2) / 2;
}

export function bumpKg(kg: number, delta: number): number {
  return Math.round((kg + delta) * 2) / 2;
}

function buildStrengthOptions(input: {
  basisKg: number;
  basisReps: number | null;
  progressRate: number;
  stalled: boolean;
}): ProgressionOption[] {
  const { basisKg, basisReps, progressRate, stalled } = input;
  const kgLabel = formatSuggestedKg(basisKg);
  const nextKg =
    stalled
      ? suggestDeloadKg(basisKg)
      : suggestNextWeightKg(basisKg, progressRate) ?? basisKg;
  const nextReps =
    basisReps != null && basisReps > 0 ? basisReps + 1 : null;

  const weight: ProgressionOption = {
    lever: "weight",
    label: stalled ? "Deload" : "Вес",
    line: stalled
      ? `deload ${formatSuggestedKg(nextKg)} кг`
      : `${formatSuggestedKg(nextKg)} кг`,
    suggestedKg: nextKg,
    suggestedReps: basisReps,
  };
  const volume: ProgressionOption = {
    lever: "volume",
    label: "Тоннаж",
    line: `те же ${kgLabel} кг · +1 подход`,
    suggestedKg: basisKg,
    suggestedReps: basisReps,
  };
  const reps: ProgressionOption = {
    lever: "reps",
    label: "Повторы",
    line:
      nextReps != null
        ? `${kgLabel} кг × ${nextReps}`
        : `те же ${kgLabel} кг · +1–2 повтора`,
    suggestedKg: basisKg,
    suggestedReps: nextReps,
  };
  return [weight, volume, reps];
}

/**
 * Advice from recent timeline + session progress rate.
 * Stall (≥3 flat tops) → propose deload; else progress or hold.
 * Always attaches weight / volume / reps levers when a top working kg exists.
 *
 * `topWorkingKg` must be the session max among working sets — not the last drop.
 */
export function adviseProgression(
  points: readonly ProgressionPoint[],
  progressRate: number,
  topWorkingKg: number | null,
  topWorkingReps: number | null = null,
): ProgressionAdvice {
  if (topWorkingKg == null || topWorkingKg <= 0) {
    return {
      kind: "base",
      title: "База",
      detail: "Зафиксируйте рабочий вес — дальше подскажем прогрессию.",
      suggestedKg: null,
      basisKg: null,
      basisReps: null,
      options: [],
    };
  }
  const stalled = isStalled(points, 3);
  const options = buildStrengthOptions({
    basisKg: topWorkingKg,
    basisReps: topWorkingReps,
    progressRate,
    stalled,
  });
  if (stalled) {
    const deload = suggestDeloadKg(topWorkingKg);
    return {
      kind: "stall",
      title: "Плато",
      detail: `Макс ${formatSuggestedKg(topWorkingKg)} кг не рос ${Math.min(points.length, 3)} сессии. Deload → ${formatSuggestedKg(deload)} кг — или тоннаж/повторы на текущем весе.`,
      suggestedKg: deload,
      basisKg: topWorkingKg,
      basisReps: topWorkingReps,
      primaryLever: "weight",
      options,
    };
  }
  const rate = Number.isFinite(progressRate) ? Math.max(0, progressRate) : 0.05;
  const next = suggestNextWeightKg(topWorkingKg, rate) ?? topWorkingKg;
  if (rate <= 0) {
    return {
      kind: "hold",
      title: "Держим",
      detail: `Повторите макс ${formatSuggestedKg(topWorkingKg)} кг — или добавьте подход/повторы.`,
      suggestedKg: topWorkingKg,
      basisKg: topWorkingKg,
      basisReps: topWorkingReps,
      primaryLever: "volume",
      options,
    };
  }
  // Prefer weight when last top set already hit a solid rep band; else nudge reps first.
  const primaryLever: ProgressionLever =
    topWorkingReps != null && topWorkingReps >= 8 ? "weight" : "reps";
  return {
    kind: "progress",
    title: "Прогрессия",
    detail: `Макс ${formatSuggestedKg(topWorkingKg)} кг → можно вес (${formatSuggestedKg(next)}), тоннаж или повторы.`,
    suggestedKg: next,
    basisKg: topWorkingKg,
    basisReps: topWorkingReps,
    primaryLever,
    options,
  };
}

/**
 * Cardio advice from last distance/duration vs previous best pace (sec/km).
 * No kg suggestions — pace/distance language only.
 */
export function adviseCardioProgression(input: {
  lastDistanceKm: number;
  lastDurationSec: number;
  previousBestPaceSecPerKm: number | null;
}): ProgressionAdvice {
  const dist = input.lastDistanceKm;
  const dur = input.lastDurationSec;
  if (!(dist > 0) && !(dur > 0)) {
    return {
      kind: "base",
      title: "Кардио",
      detail: "Запишите км или минуты — подскажем темп в следующий раз.",
      suggestedKg: null,
    };
  }
  const pace =
    dist > 0 && dur > 0 ? Math.round(dur / dist) : null;
  if (
    pace != null &&
    input.previousBestPaceSecPerKm != null &&
    input.previousBestPaceSecPerKm > 0 &&
    pace > input.previousBestPaceSecPerKm * 1.08
  ) {
    const bestMin = Math.floor(input.previousBestPaceSecPerKm / 60);
    const bestSec = Math.round(input.previousBestPaceSecPerKm % 60)
      .toString()
      .padStart(2, "0");
    return {
      kind: "hold",
      title: "Темп",
      detail: `Сейчас спокойнее рекорда (${bestMin}:${bestSec} /км) — можно чуть ускориться или добавить 0.5 км.`,
      suggestedKg: null,
    };
  }
  if (pace != null && input.previousBestPaceSecPerKm != null && pace < input.previousBestPaceSecPerKm) {
    return {
      kind: "progress",
      title: "Темп",
      detail: "Темп лучше прошлого — зафиксируйте или добавьте дистанцию.",
      suggestedKg: null,
    };
  }
  if (dist > 0) {
    const next = Math.round((dist + 0.5) * 10) / 10;
    return {
      kind: "progress",
      title: "Дистанция",
      detail: `Цель в следующий раз: ~${next} км в том же темпе.`,
      suggestedKg: null,
    };
  }
  const nextMin = Math.round(dur / 60) + 5;
  return {
    kind: "progress",
    title: "Время",
    detail: `Цель в следующий раз: ~${nextMin} мин.`,
    suggestedKg: null,
  };
}

export type AutofillSet = {
  weightKg: number | null;
  reps: number | null;
  setType: string;
};

/** Prefer next incomplete planned set; else clone last completed with optional kg bump. */
export function autofillNextDraft(
  sets: ReadonlyArray<{
    weightKg: number | null;
    reps: number | null;
    setType?: string | null;
    completed?: boolean | null;
  }>,
  options?: { progressRate?: number; bumpAfterComplete?: boolean },
): AutofillSet | null {
  const incomplete = sets.find((s) => s.completed === false);
  if (incomplete) {
    return {
      weightKg: incomplete.weightKg,
      reps: incomplete.reps,
      setType: incomplete.setType ?? "working",
    };
  }
  const completed = [...sets].reverse().find((s) => s.completed !== false);
  if (!completed) return null;
  // Never clone a drop as the next working draft — use top working kg when bumping.
  const setType =
    completed.setType === "warmup" || completed.setType === "drop"
      ? "working"
      : (completed.setType ?? "working");
  let kg = completed.weightKg;
  if (completed.setType === "drop") {
    const top = pickTopWorkingFromSets(sets);
    if (top != null) kg = top;
  }
  if (
    options?.bumpAfterComplete &&
    kg != null &&
    Number.isFinite(kg) &&
    (options.progressRate ?? 0) > 0
  ) {
    kg = Math.round(kg * (1 + (options.progressRate ?? 0.05)) * 2) / 2;
  }
  return {
    weightKg: kg,
    reps: completed.reps,
    setType,
  };
}

function pickTopWorkingFromSets(
  sets: ReadonlyArray<{
    weightKg: number | null;
    setType?: string | null;
    completed?: boolean | null;
  }>,
): number | null {
  let top: number | null = null;
  for (const s of sets) {
    if (s.completed === false) continue;
    const t = s.setType ?? "working";
    if (t === "warmup" || t === "drop") continue;
    const w = s.weightKg;
    if (w == null || !Number.isFinite(w) || w < 0) continue;
    if (top == null || w > top) top = w;
  }
  return top;
}
