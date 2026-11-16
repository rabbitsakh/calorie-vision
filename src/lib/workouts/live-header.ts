/**
 * Шапка живой тренировки: тоннаж, сравнение с прошлой завершённой,
 * подходы от плана и «Прогрессия N из M».
 * Считает из уже загруженных сессий и шаблонов, без новой схемы.
 */

import { exerciseSetCounts, formatBestTarget } from "@/lib/workouts/active-set-table";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { fieldsForKind, parseExerciseKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { loadDeltaPct, roundLoad, sessionTotalLoad, type LoadSet } from "@/lib/workouts/load";
import { sameGroupSet } from "@/lib/workouts/muscle-groups";
import { parseSetType } from "@/lib/workouts/set-meta";

export type LiveHeaderSet = LoadSet & {
  reps?: number | null;
};

export type LiveHeaderExercise = {
  kind?: string | null;
  sets: readonly LiveHeaderSet[];
  /** Сколько подходов было в прошлый раз — план, если своих ещё меньше. */
  lastSetCount: number;
  bestKg: number | null;
  targetKg: number | null;
};

export type LiveCompareMatch = "template" | "type";

export type LiveCompare = {
  matchedBy: LiveCompareMatch;
  previousTonnage: number;
  previousElapsedSec: number;
  previousDate: string | null;
};

export type PreviousWorkoutCandidate = {
  id: string;
  date: string;
  createdAt: string | Date;
  muscleKeys: readonly string[];
  totalLoad: number;
  elapsedSec: number;
  finished: boolean;
  exerciseNames: readonly string[];
};

export type LiveHeaderView = {
  tonnageLabel: string;
  previousTonnageLabel: string | null;
  deltaLabel: string | null;
  deltaTone: "up" | "down" | "flat" | null;
  setsLabel: string;
  durationLabel: string | null;
  progressionLabel: string;
  progressionDone: number;
  progressionTotal: number;
  prCount: number;
};

const KG_EPS = 0.26;

/** «8,4 т» от 1000 кг, иначе «840 кг». */
export function formatTonnageKg(kg: number): string {
  if (!Number.isFinite(kg) || kg <= 0) return "0 кг";
  const roundedKg = Math.round(kg);
  if (roundedKg >= 1000) {
    const text = (roundedKg / 1000).toLocaleString("ru-RU", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${text} т`;
  }
  return `${roundedKg.toLocaleString("ru-RU")} кг`;
}

/** Подпись упражнения у счётчика «8/8». Пусто, если тоннажа нет. */
export function formatExerciseTonnage(kg: number): string | null {
  if (!Number.isFinite(kg) || kg <= 0) return null;
  return formatTonnageKg(kg);
}

export function exerciseNameSignature(names: readonly string[]): string {
  return names
    .map((name) => normalizeExerciseName(name))
    .filter((name) => name.length > 0)
    .sort()
    .join("\n");
}

function createdAtMs(value: string | Date): number {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function recentFirst(a: PreviousWorkoutCandidate, b: PreviousWorkoutCandidate): number {
  const byDate = b.date.localeCompare(a.date);
  if (byDate !== 0) return byDate;
  const byTime = createdAtMs(b.createdAt) - createdAtMs(a.createdAt);
  if (byTime !== 0) return byTime;
  return b.id.localeCompare(a.id);
}

/**
 * Прошлая завершённая тренировка.
 * Если состав упражнений совпал с шаблоном или днём программы — только такие.
 * Иначе та же связка групп («Ноги»). Незавершённые не берём.
 */
export function pickPreviousWorkout(input: {
  currentId: string;
  muscleKeys: readonly string[];
  exerciseNames: readonly string[];
  templateExerciseNames: readonly (readonly string[])[];
  history: readonly PreviousWorkoutCandidate[];
}): (LiveCompare & { previousId: string }) | null {
  const currentSig = exerciseNameSignature(input.exerciseNames);
  const templateSigs = new Set(
    input.templateExerciseNames.map((names) => exerciseNameSignature(names)).filter((sig) => sig.length > 0),
  );
  const byTemplate = currentSig.length > 0 && templateSigs.has(currentSig);
  const finished = input.history
    .filter((row) => row.finished && row.id !== input.currentId)
    .slice()
    .sort(recentFirst);

  const match = byTemplate
    ? finished.find((row) => exerciseNameSignature(row.exerciseNames) === currentSig)
    : input.muscleKeys.length > 0
      ? finished.find((row) => sameGroupSet(row.muscleKeys, input.muscleKeys))
      : undefined;
  if (!match) return null;
  return {
    matchedBy: byTemplate ? "template" : "type",
    previousId: match.id,
    previousTonnage: roundLoad(match.totalLoad),
    previousElapsedSec: Math.max(0, Math.round(match.elapsedSec) || 0),
    previousDate: match.date,
  };
}

export function liveTonnageKg(exercises: readonly LiveHeaderExercise[]): number {
  return roundLoad(
    sessionTotalLoad(
      exercises.map((exercise) => ({
        kind: parseExerciseKind(exercise.kind),
        sets: exercise.sets.map((set) => ({ ...set })),
      })),
    ),
  );
}

export function liveSetPlan(exercises: readonly LiveHeaderExercise[]): { done: number; plan: number } {
  let done = 0;
  let plan = 0;
  for (const exercise of exercises) {
    const counts = exerciseSetCounts(
      exercise.sets.map((set) => ({ completed: set.completed === true })),
      exercise.lastSetCount,
    );
    done += counts.done;
    plan += counts.total;
  }
  return { done, plan };
}

function hitsTargetWeight(
  kind: ExerciseKind,
  bestKg: number | null,
  targetKg: number,
  weightKg: number,
): boolean {
  const downward = kind === "assisted" || (bestKg != null && targetKg < bestKg - KG_EPS);
  if (downward) return weightKg <= targetKg + KG_EPS;
  return weightKg + KG_EPS >= targetKg;
}

/** Рабочий подход на целевом весе. Разминка и дроп не засчитываются. */
export function workingSetHitsTarget(
  kind: ExerciseKind,
  bestKg: number | null,
  targetKg: number,
  sets: readonly LiveHeaderSet[],
): boolean {
  if (!fieldsForKind(kind).usesWeight) return false;
  return sets.some((set) => {
    if (set.completed !== true) return false;
    const type = parseSetType(set.setType);
    if (type === "warmup" || type === "drop") return false;
    const weight = Number(set.weightKg);
    if (!Number.isFinite(weight)) return false;
    return hitsTargetWeight(kind, bestKg, targetKg, weight);
  });
}

/** M — упражнения с подписью «100 → 105». N — уже есть рабочий подход на цели. */
export function progressionCounts(exercises: readonly LiveHeaderExercise[]): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const exercise of exercises) {
    const kind = parseExerciseKind(exercise.kind);
    if (!fieldsForKind(kind).usesWeight) continue;
    const label = formatBestTarget(exercise.bestKg, exercise.targetKg);
    if (!label?.includes("→") || exercise.targetKg == null) continue;
    total += 1;
    if (workingSetHitsTarget(kind, exercise.bestKg, exercise.targetKg, exercise.sets)) done += 1;
  }
  return { done, total };
}

export function formatTonnageDelta(
  currentKg: number,
  previousKg: number,
): { label: string; tone: "up" | "down" | "flat" } | null {
  const pct = loadDeltaPct(currentKg, previousKg);
  if (pct == null) return null;
  const tone = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  const abs = Math.abs(pct);
  const rounded = Number.isInteger(abs) ? String(abs) : String(abs).replace(".", ",");
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return { label: `${sign}${rounded}%`, tone };
}

/** Разница длительности в минутах. Нет часов у прошлой — не с чем сравнивать. */
export function formatDurationDelta(currentSec: number, previousSec: number): string | null {
  if (!(previousSec > 0) || !Number.isFinite(currentSec) || currentSec < 0) return null;
  const deltaMin = Math.round((currentSec - previousSec) / 60);
  if (deltaMin === 0) return "0 мин";
  const sign = deltaMin > 0 ? "+" : "−";
  return `${sign}${Math.abs(deltaMin)} мин`;
}

export function formatRecordBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  const n = Math.floor(count);
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? "рекорд"
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? "рекорда"
        : "рекордов";
  return `${n} ${word}`;
}

export function buildLiveHeaderView(input: {
  exercises: readonly LiveHeaderExercise[];
  previous: { tonnage: number; elapsedSec: number } | null;
  elapsedSec: number;
  prCount: number;
}): LiveHeaderView {
  const tonnage = liveTonnageKg(input.exercises);
  const sets = liveSetPlan(input.exercises);
  const progression = progressionCounts(input.exercises);
  const delta = input.previous ? formatTonnageDelta(tonnage, input.previous.tonnage) : null;
  const prCount = Number.isFinite(input.prCount) && input.prCount > 0 ? Math.floor(input.prCount) : 0;
  return {
    tonnageLabel: formatTonnageKg(tonnage),
    previousTonnageLabel: input.previous ? `было ${formatTonnageKg(input.previous.tonnage)}` : null,
    deltaLabel: delta?.label ?? null,
    deltaTone: delta?.tone ?? null,
    setsLabel: `${sets.done} из ${sets.plan}`,
    durationLabel: input.previous
      ? formatDurationDelta(input.elapsedSec, input.previous.elapsedSec)
      : null,
    progressionLabel: `Прогрессия ${progression.done} из ${progression.total}`,
    progressionDone: progression.done,
    progressionTotal: progression.total,
    prCount,
  };
}
