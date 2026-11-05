/**
 * Привязка пользовательского названия к справочнику.
 * Уверенное совпадение можно склеить. Сомнительное только попадает в отчёт.
 */

import type { ExerciseKind } from "@/lib/workouts/exercise-kind";
import { parseExerciseKind } from "@/lib/workouts/exercise-kind";
import {
  catalogById,
  EXERCISE_CATALOG,
  type CatalogExercise,
} from "@/lib/workouts/exercise-catalog";
import { exerciseNameSimilarity, normalizeExerciseName } from "@/lib/workouts/exercise-name";

export type MatchVerdict =
  | { status: "confident"; catalogId: string; name: string; score: number }
  | { status: "uncertain"; catalogId: string; name: string; score: number; reason: string }
  | { status: "none" };

const CONFIDENT_SIMILARITY = 0.93;
const UNCERTAIN_SIMILARITY = 0.82;

type Scored = { row: CatalogExercise; score: number; exact: boolean };

function scoreRow(queryNorm: string, row: CatalogExercise): Scored {
  if (queryNorm === row.nameNorm || row.synonymNorms.includes(queryNorm)) {
    return { row, score: 1, exact: true };
  }
  let best = exerciseNameSimilarity(queryNorm, row.nameNorm);
  for (const syn of row.synonymNorms) {
    const sim = exerciseNameSimilarity(queryNorm, syn);
    if (sim > best) best = sim;
  }
  return { row, score: best, exact: false };
}

/** Классификация одного названия. Короткие и неоднозначные не склеиваются. */
export function matchExerciseName(
  name: string,
  catalog: readonly CatalogExercise[] = EXERCISE_CATALOG,
): MatchVerdict {
  const key = normalizeExerciseName(name);
  if (!key) return { status: "none" };

  const ranked = catalog
    .map((row) => scoreRow(key, row))
    .filter((s) => s.exact || s.score >= UNCERTAIN_SIMILARITY)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return { status: "none" };

  const best = ranked[0]!;
  const second = ranked[1];
  const exacts = ranked.filter((s) => s.exact);
  if (exacts.length > 1) {
    return {
      status: "uncertain",
      catalogId: best.row.id,
      name: best.row.name,
      score: 1,
      reason: "несколько точных синонимов",
    };
  }
  if (exacts.length === 1) {
    return {
      status: "confident",
      catalogId: exacts[0]!.row.id,
      name: exacts[0]!.row.name,
      score: 1,
    };
  }

  const gap = second ? best.score - second.score : 1;
  const longEnough = key.length >= 8 && best.row.nameNorm.length >= 8;
  if (best.score >= CONFIDENT_SIMILARITY && gap >= 0.06 && longEnough) {
    return {
      status: "confident",
      catalogId: best.row.id,
      name: best.row.name,
      score: Math.round(best.score * 1000) / 1000,
    };
  }
  if (best.score >= UNCERTAIN_SIMILARITY) {
    const reason = !longEnough
      ? "короткое название"
      : gap < 0.06
        ? "рядом есть похожее упражнение"
        : "сходство ниже порога склейки";
    return {
      status: "uncertain",
      catalogId: best.row.id,
      name: best.row.name,
      score: Math.round(best.score * 1000) / 1000,
      reason,
    };
  }
  return { status: "none" };
}

export type LoggedExerciseInput = {
  name: string;
  kind: ExerciseKind;
  muscleGroup: string | null;
};

export type LoggedExerciseResolved = LoggedExerciseInput & {
  catalogId: string | null;
  defaultRestSec: number | null;
};

/**
 * Уверенное совпадение подменяет название на каноническое.
 * Явно выбранный тип (не «силовое» по умолчанию) сохраняется.
 */
export function resolveLoggedExercise(input: LoggedExerciseInput): LoggedExerciseResolved {
  const match = matchExerciseName(input.name);
  if (match.status !== "confident") {
    return { ...input, name: input.name.trim().slice(0, 120), catalogId: null, defaultRestSec: null };
  }
  const row = catalogById(match.catalogId);
  if (!row) {
    return { ...input, catalogId: null, defaultRestSec: null };
  }
  const kind =
    input.kind === row.kind || input.kind === "strength" ? row.kind : input.kind;
  return {
    name: row.name,
    kind: parseExerciseKind(kind, row.kind),
    muscleGroup: input.muscleGroup ?? row.primary[0] ?? null,
    catalogId: row.id,
    defaultRestSec: row.defaultRestSec,
  };
}
