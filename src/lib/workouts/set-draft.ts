import {
  parseDistanceKm,
  parseDurationToSec,
} from "@/lib/workouts/cardio";
import { fieldsForKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";

export type SetDraftFields = {
  kg: string;
  reps: string;
  km: string;
  time: string;
};

export type DraftFieldKey = "km" | "time" | "kg" | "reps";

export type DraftValidation =
  | { ok: true; body: Record<string, number> }
  | { ok: false; message: string; field: DraftFieldKey };

/**
 * Client-side validation for the add-set / +отрезок draft row.
 * Returns which field to focus when invalid.
 */
export function validateSetDraft(
  kind: ExerciseKind,
  draft: SetDraftFields,
): DraftValidation {
  const spec = fieldsForKind(kind);
  const body: Record<string, number> = {};

  if (spec.usesDistance) {
    const distanceKm = parseDistanceKm(draft.km || "0");
    if (distanceKm === null) {
      return { ok: false, message: "Укажите км", field: "km" };
    }
    body.distanceKm = distanceKm;
  }
  if (spec.usesDuration) {
    const durationSec = parseDurationToSec(draft.time);
    if (durationSec === null) {
      return { ok: false, message: "Укажите время в минутах", field: "time" };
    }
    body.durationSec = durationSec;
  }
  if (spec.usesWeight) {
    const weightKg = Number(draft.kg.replace(",", "."));
    if (!Number.isFinite(weightKg) || weightKg < 0) {
      return { ok: false, message: "Укажите кг", field: "kg" };
    }
    body.weightKg = weightKg;
  }
  if (spec.usesReps) {
    const reps = Number(draft.reps);
    if (!Number.isFinite(reps) || reps <= 0) {
      return { ok: false, message: "Укажите повторения", field: "reps" };
    }
    body.reps = reps;
  }

  return { ok: true, body };
}
