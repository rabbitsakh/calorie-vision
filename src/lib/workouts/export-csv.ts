import { isValidIanaTimezone } from "@/lib/device-timezone";
import { formatTimeShort } from "@/lib/dates";
import { decodeHtmlEntities } from "@/lib/html-text";
import { formatDurationMinutes } from "@/lib/workouts/cardio";
import { kindLabel } from "@/lib/workouts/exercise-kind";
import { muscleGroupLabel, normalizeGroupKeys } from "@/lib/workouts/muscle-groups";
import { SET_TYPE_LABELS, parseSetType } from "@/lib/workouts/set-meta";

/** Product default when the profile has no usable IANA zone (same as reminders). */
export const WORKOUT_EXPORT_FALLBACK_TIMEZONE = "Europe/Moscow";

export function resolveWorkoutExportTimezone(timezone: string | null | undefined): string {
  const trimmed = timezone?.trim();
  if (trimmed && isValidIanaTimezone(trimmed)) return trimmed;
  return WORKOUT_EXPORT_FALLBACK_TIMEZONE;
}

export type WorkoutExportSet = {
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
  setType: string | null;
  completed: boolean | null;
  rpe: number | null;
  sortOrder: number;
};

export type WorkoutExportExercise = {
  name: string;
  kind: string | null;
  note: string | null;
  sortOrder: number;
  sets: WorkoutExportSet[];
};

export type WorkoutExportSession = {
  date: string;
  note: string | null;
  startedAt: Date | string | null;
  endedAt: Date | string | null;
  /** Muscle-group keys (chest, back, …). */
  muscles: string[];
  exercises: WorkoutExportExercise[];
};

export type WorkoutCsvRow = {
  date: string;
  start: string;
  end: string;
  title: string;
  muscles: string;
  exercise: string;
  kind: string;
  setNumber: string;
  setType: string;
  weightKg: string;
  reps: string;
  distanceKm: string;
  durationSec: string;
  rpe: string;
  completed: string;
  sessionNote: string;
  exerciseNote: string;
};

const COLUMNS: Array<{ header: string; key: keyof WorkoutCsvRow }> = [
  { header: "Дата", key: "date" },
  { header: "Начало", key: "start" },
  { header: "Окончание", key: "end" },
  { header: "Тренировка", key: "title" },
  { header: "Группы мышц", key: "muscles" },
  { header: "Упражнение", key: "exercise" },
  { header: "Тип упражнения", key: "kind" },
  { header: "№ подхода", key: "setNumber" },
  { header: "Тип подхода", key: "setType" },
  { header: "Вес кг", key: "weightKg" },
  { header: "Повторы", key: "reps" },
  { header: "Дистанция км", key: "distanceKm" },
  { header: "Время сек", key: "durationSec" },
  { header: "Усилие (RPE)", key: "rpe" },
  { header: "Выполнен", key: "completed" },
  { header: "Заметка тренировки", key: "sessionNote" },
  { header: "Заметка упражнения", key: "exerciseNote" },
];

export const WORKOUT_CSV_HEADERS = COLUMNS.map((column) => column.header);

export function escCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatExportNumber(value: number | null | undefined, digits = 3): string {
  if (value == null || !Number.isFinite(value)) return "";
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return String(rounded);
}

function plainText(value: string | null | undefined): string {
  if (!value) return "";
  return decodeHtmlEntities(value).replace(/\r\n/g, "\n").trim();
}

export function formatWorkoutExportClock(
  value: Date | string | null | undefined,
  timezone: string,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatTimeShort(date, timezone);
}

export function workoutMuscleLabelList(keys: readonly string[]): string {
  return normalizeGroupKeys(keys).map(muscleGroupLabel).join(" · ");
}

/** Note when the user named the session, otherwise the muscle groups. */
export function workoutExportTitle(session: Pick<WorkoutExportSession, "note" | "muscles">): string {
  const note = plainText(session.note);
  if (note) return note;
  return workoutMuscleLabelList(session.muscles);
}

function sortExercises(exercises: readonly WorkoutExportExercise[]): WorkoutExportExercise[] {
  return [...exercises].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru"));
}

function sortSets(sets: readonly WorkoutExportSet[]): WorkoutExportSet[] {
  return [...sets].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function flattenWorkoutExport(
  sessions: readonly WorkoutExportSession[],
  timezone: string,
): WorkoutCsvRow[] {
  const rows: WorkoutCsvRow[] = [];
  for (const session of sessions) {
    const base = {
      date: session.date,
      start: formatWorkoutExportClock(session.startedAt, timezone),
      end: formatWorkoutExportClock(session.endedAt, timezone),
      title: workoutExportTitle(session),
      muscles: workoutMuscleLabelList(session.muscles),
      sessionNote: plainText(session.note),
    };
    const exercises = sortExercises(session.exercises);
    if (exercises.length === 0) {
      rows.push({
        ...base,
        exercise: "",
        kind: "",
        setNumber: "",
        setType: "",
        weightKg: "",
        reps: "",
        distanceKm: "",
        durationSec: "",
        rpe: "",
        completed: "",
        exerciseNote: "",
      });
      continue;
    }
    for (const exercise of exercises) {
      const exerciseName = plainText(exercise.name);
      const exerciseNote = plainText(exercise.note);
      const kind = exercise.kind ? kindLabel(exercise.kind) : "";
      const sets = sortSets(exercise.sets);
      if (sets.length === 0) {
        rows.push({
          ...base,
          exercise: exerciseName,
          kind,
          setNumber: "",
          setType: "",
          weightKg: "",
          reps: "",
          distanceKm: "",
          durationSec: "",
          rpe: "",
          completed: "",
          exerciseNote,
        });
        continue;
      }
      sets.forEach((set, index) => {
        rows.push({
          ...base,
          exercise: exerciseName,
          kind,
          setNumber: String(index + 1),
          setType: SET_TYPE_LABELS[parseSetType(set.setType)],
          weightKg: formatExportNumber(set.weightKg),
          reps: set.reps != null && Number.isFinite(set.reps) ? String(Math.trunc(set.reps)) : "",
          distanceKm: formatExportNumber(set.distanceKm),
          durationSec:
            set.durationSec != null && Number.isFinite(set.durationSec)
              ? String(Math.trunc(set.durationSec))
              : "",
          rpe: formatExportNumber(set.rpe, 1),
          completed: set.completed === false ? "нет" : "да",
          exerciseNote,
        });
      });
    }
  }
  return rows;
}

/** UTF-8 BOM, comma separator, CRLF — same spreadsheet shape as the meal diary. */
export function buildWorkoutCsv(sessions: readonly WorkoutExportSession[], timezone: string): string {
  const header = WORKOUT_CSV_HEADERS.join(",");
  const lines = flattenWorkoutExport(sessions, timezone).map((row) =>
    COLUMNS.map((column) => escCsv(row[column.key])).join(","),
  );
  return `\uFEFF${[header, ...lines].join("\r\n")}`;
}

export function formatWorkoutSetPdfLine(set: WorkoutExportSet, index: number): string {
  const bits: string[] = [];
  const weight = formatExportNumber(set.weightKg);
  const reps = set.reps != null && Number.isFinite(set.reps) ? String(Math.trunc(set.reps)) : "";
  if (weight && reps) bits.push(`${weight} кг × ${reps}`);
  else if (weight) bits.push(`${weight} кг`);
  else if (reps) bits.push(`${reps} повт.`);
  const distance = formatExportNumber(set.distanceKm);
  if (distance) bits.push(`${distance} км`);
  if (set.durationSec != null && Number.isFinite(set.durationSec) && set.durationSec > 0) {
    bits.push(formatDurationMinutes(set.durationSec));
  }
  bits.push(SET_TYPE_LABELS[parseSetType(set.setType)]);
  const rpe = formatExportNumber(set.rpe, 1);
  if (rpe) bits.push(`усилие ${rpe}`);
  if (set.completed === false) bits.push("не выполнен");
  return `    ${index}. ${bits.join(" · ")}`;
}

export type WorkoutPdfBlock = {
  heading: string;
  muscles: string;
  lines: string[];
};

export function buildWorkoutPdfBlocks(
  sessions: readonly WorkoutExportSession[],
  timezone: string,
): WorkoutPdfBlock[] {
  return sessions.map((session) => {
    const start = formatWorkoutExportClock(session.startedAt, timezone);
    const end = formatWorkoutExportClock(session.endedAt, timezone);
    const clock = start || end ? `  ${start || "—"}${end ? `–${end}` : ""}` : "";
    const title = workoutExportTitle(session);
    const heading = `${session.date}${clock}${title ? `  ${title}` : ""}`;
    const lines: string[] = [];
    const exercises = sortExercises(session.exercises);
    if (exercises.length === 0) {
      lines.push("  Нет упражнений");
    }
    for (const exercise of exercises) {
      const kind = exercise.kind ? kindLabel(exercise.kind) : "";
      const name = plainText(exercise.name) || "Упражнение";
      lines.push(`  ${name}${kind ? ` · ${kind}` : ""}`);
      const note = plainText(exercise.note);
      if (note) lines.push(`    Заметка: ${note}`);
      const sets = sortSets(exercise.sets);
      if (sets.length === 0) {
        lines.push("    Нет подходов");
        continue;
      }
      sets.forEach((set, index) => {
        lines.push(formatWorkoutSetPdfLine(set, index + 1));
      });
    }
    return {
      heading,
      muscles: workoutMuscleLabelList(session.muscles),
      lines,
    };
  });
}

export function workoutExportDateWhere(
  from: string | null,
  to: string | null,
): { gte: string; lte: string } | { gte: string } | { lte: string } | undefined {
  if (from && to) return { gte: from, lte: to };
  if (from) return { gte: from };
  if (to) return { lte: to };
  return undefined;
}
