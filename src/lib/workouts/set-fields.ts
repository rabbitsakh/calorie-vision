/** Shared parsers for workout set create/update bodies. */

import {
  fieldsForKind,
  type ExerciseKind,
} from "@/lib/workouts/exercise-kind";

export function parseStrengthWeight(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1000) return null;
  return n;
}

export function parseStrengthReps(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 500) return null;
  const whole = Math.floor(n);
  if (whole !== n) return null;
  return whole;
}

export function parseCardioDistanceKm(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 500) return null;
  return Math.round(n * 1000) / 1000;
}

export function parseCardioDurationSec(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 24 * 3600) return null;
  return Math.round(n);
}

export type ParsedSetFields = {
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
};

export type ParseSetResult =
  | { ok: true; fields: ParsedSetFields }
  | { ok: false; error: string };

export type SetPatchFields = {
  weightKg?: number | null;
  reps?: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
};

export type ParseSetPatchResult =
  | { ok: true; fields: SetPatchFields }
  | { ok: false; error: string };

/**
 * Validate and normalize set payload for create (all required fields for kind).
 */
export function parseSetCreateForKind(
  kind: ExerciseKind,
  body: {
    weightKg?: unknown;
    reps?: unknown;
    distanceKm?: unknown;
    durationSec?: unknown;
  },
): ParseSetResult {
  const spec = fieldsForKind(kind);

  if (kind === "cardio") {
    const distanceKm = parseCardioDistanceKm(body.distanceKm ?? 0);
    const durationSec = parseCardioDurationSec(body.durationSec);
    if (distanceKm === null || durationSec === null) {
      return { ok: false, error: "Укажите дистанцию (км) и время (мин → сек)" };
    }
    return {
      ok: true,
      fields: { weightKg: null, reps: null, distanceKm, durationSec },
    };
  }

  if (kind === "duration") {
    const durationSec = parseCardioDurationSec(body.durationSec);
    if (durationSec === null) {
      return { ok: false, error: "Укажите время (сек)" };
    }
    return {
      ok: true,
      fields: { weightKg: null, reps: null, distanceKm: null, durationSec },
    };
  }

  if (kind === "bodyweight") {
    const reps = parseStrengthReps(body.reps);
    if (reps === null) {
      return { ok: false, error: "Укажите число повторений" };
    }
    return {
      ok: true,
      fields: { weightKg: null, reps, distanceKm: null, durationSec: null },
    };
  }

  // strength | weighted_bw | assisted
  const weightKg = parseStrengthWeight(body.weightKg);
  const reps = parseStrengthReps(body.reps);
  if (weightKg === null || reps === null) {
    return {
      ok: false,
      error: spec.usesWeight
        ? "Укажите кг и число повторений"
        : "Укажите число повторений",
    };
  }
  return {
    ok: true,
    fields: { weightKg, reps, distanceKm: null, durationSec: null },
  };
}

/**
 * Partial update for PATCH — only validates provided metric fields.
 * Always clears columns unused by this kind.
 */
export function parseSetPatchForKind(
  kind: ExerciseKind,
  body: {
    weightKg?: unknown;
    reps?: unknown;
    distanceKm?: unknown;
    durationSec?: unknown;
  },
): ParseSetPatchResult {
  const spec = fieldsForKind(kind);
  const fields: SetPatchFields = {};

  if (!spec.usesWeight) fields.weightKg = null;
  else if (body.weightKg !== undefined) {
    const weightKg = parseStrengthWeight(body.weightKg);
    if (weightKg === null) return { ok: false, error: "Некорректный вес" };
    fields.weightKg = weightKg;
  }

  if (!spec.usesReps) fields.reps = null;
  else if (body.reps !== undefined) {
    const reps = parseStrengthReps(body.reps);
    if (reps === null) return { ok: false, error: "Некорректные повторения" };
    fields.reps = reps;
  }

  if (!spec.usesDistance) fields.distanceKm = null;
  else if (body.distanceKm !== undefined) {
    const distanceKm = parseCardioDistanceKm(body.distanceKm);
    if (distanceKm === null) return { ok: false, error: "Некорректная дистанция" };
    fields.distanceKm = distanceKm;
  }

  if (!spec.usesDuration) fields.durationSec = null;
  else if (body.durationSec !== undefined) {
    const durationSec = parseCardioDurationSec(body.durationSec);
    if (durationSec === null) return { ok: false, error: "Некорректное время" };
    fields.durationSec = durationSec;
  }

  return { ok: true, fields };
}
