/**
 * Готовые программы из справочника. Веса пустые: их берёт сам человек
 * из прошлой тренировки, программа задаёт только схему.
 */

import { catalogById } from "@/lib/workouts/exercise-catalog";
import type { ExerciseKind } from "@/lib/workouts/exercise-kind";
import { muscleGroupLabel, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import type { PlannedSet } from "@/lib/workouts/routines";

export type ProgramSlot = {
  catalogId: string;
  sets: number;
  reps: number;
};

export type ProgramDay = {
  id: string;
  name: string;
  note: string;
  slots: readonly ProgramSlot[];
};

export type GymProgram = {
  id: string;
  title: string;
  summary: string;
  equipment: string;
  days: readonly ProgramDay[];
};

export type RoutineDraft = {
  name: string;
  note: string;
  muscleGroups: MuscleGroupKey[];
  exercises: Array<{
    name: string;
    kind: ExerciseKind;
    muscleGroup: string | null;
    catalogId: string;
    plannedSets: PlannedSet[];
  }>;
};

const slot = (catalogId: string, sets: number, reps: number): ProgramSlot => ({
  catalogId,
  sets,
  reps,
});

export const GYM_PROGRAMS: readonly GymProgram[] = [
  {
    id: "fullbody",
    title: "Фулбади",
    summary: "Два чередующихся дня на всё тело, по 3 подхода. Подходит, если ходите 2–3 раза в неделю.",
    equipment: "Штанга и свой вес",
    days: [
      {
        id: "a",
        name: "Фулбади · А",
        note: "Присед, жим, тяга и жим стоя. Отдых между подходами около 2 минут.",
        slots: [slot("squat", 3, 8), slot("bench-press", 3, 8), slot("bb-row", 3, 8), slot("ohp", 3, 8)],
      },
      {
        id: "b",
        name: "Фулбади · Б",
        note: "Румынская тяга, верхний блок, выпады и жим гантелей. Чередуйте с днём А.",
        slots: [slot("rdl", 3, 8), slot("lat-pulldown", 3, 10), slot("lunge-db", 3, 8), slot("db-ohp", 3, 8)],
      },
    ],
  },
  {
    id: "split",
    title: "Сплит",
    summary: "Три дня: жим, тяга, ноги. Каждую группу — раз в неделю, если есть три тренировки.",
    equipment: "Штанга, блок, тренажёры",
    days: [
      {
        id: "push",
        name: "Сплит · Жим",
        note: "Грудь, плечи и трицепс. Сначала база, потом изоляция.",
        slots: [
          slot("bench-press", 4, 6),
          slot("ohp", 3, 8),
          slot("lateral", 3, 12),
          slot("pushdown", 3, 12),
        ],
      },
      {
        id: "pull",
        name: "Сплит · Тяга",
        note: "Спина и бицепс. Тяга к поясу и вертикальная тяга.",
        slots: [
          slot("lat-pulldown", 4, 8),
          slot("bb-row", 3, 8),
          slot("face-pull", 3, 12),
          slot("bb-curl", 3, 10),
        ],
      },
      {
        id: "legs",
        name: "Сплит · Ноги",
        note: "Присед, задняя поверхность и икры. Пресс в конце, коротко.",
        slots: [
          slot("squat", 4, 6),
          slot("rdl", 3, 8),
          slot("leg-curl", 3, 10),
          slot("calf-stand", 3, 12),
          slot("crunch", 3, 12),
        ],
      },
    ],
  },
  {
    id: "five",
    title: "5×5",
    summary: "Два дня со штангой. Пять подходов по пять повторов, становая — один подход.",
    equipment: "Штанга",
    days: [
      {
        id: "a",
        name: "5×5 · День А",
        note: "Присед, жим лёжа, тяга в наклоне. Вес добавляйте, только когда все 5×5 дались чисто.",
        slots: [slot("squat", 5, 5), slot("bench-press", 5, 5), slot("bb-row", 5, 5)],
      },
      {
        id: "b",
        name: "5×5 · День Б",
        note: "Присед, жим стоя, становая на один подход. Чередуйте с днём А.",
        slots: [slot("squat", 5, 5), slot("ohp", 5, 5), slot("deadlift", 1, 5)],
      },
    ],
  },
];

export function programById(id: string): GymProgram | null {
  return GYM_PROGRAMS.find((program) => program.id === id) ?? null;
}

export function routineDraftFromDay(day: ProgramDay): RoutineDraft | null {
  const exercises: RoutineDraft["exercises"] = [];
  const muscles = new Set<MuscleGroupKey>();
  for (const item of day.slots) {
    const row = catalogById(item.catalogId);
    if (!row) return null;
    if (item.sets < 1 || item.sets > 8 || item.reps < 1 || item.reps > 30) return null;
    const muscle = row.primary[0] ?? null;
    if (muscle) muscles.add(muscle);
    exercises.push({
      name: row.name,
      kind: row.kind,
      muscleGroup: muscle,
      catalogId: row.id,
      plannedSets: Array.from({ length: item.sets }, () => ({
        weightKg: null,
        reps: item.reps,
        distanceKm: null,
        durationSec: null,
        setType: "working" as const,
      })),
    });
  }
  if (exercises.length === 0 || muscles.size === 0) return null;
  return {
    name: day.name,
    note: day.note,
    muscleGroups: [...muscles],
    exercises,
  };
}

export type ProgramSaveStep = {
  dayId: string;
  name: string;
  skip: boolean;
  draft: RoutineDraft;
};

/** Имя черновика ИИ не должно совпасть со старым шаблоном и открыть его по ошибке. */
export function uniqueDraftName(name: string, existingNames: readonly string[]): string {
  const have = new Set(existingNames.map((item) => item.trim()));
  const base = name.trim().slice(0, 110) || "Тренировка";
  if (!have.has(base)) return base;
  let n = 2;
  while (have.has(`${base} · ${n}`)) n += 1;
  return `${base} · ${n}`.slice(0, 120);
}

/** Повторное сохранение дня с тем же именем не создаёт второй шаблон. */
export function planProgramSave(
  existingNames: readonly string[],
  programId: string,
): ProgramSaveStep[] | null {
  const program = programById(programId);
  if (!program) return null;
  const have = new Set(existingNames.map((name) => name.trim()));
  const steps: ProgramSaveStep[] = [];
  for (const day of program.days) {
    const draft = routineDraftFromDay(day);
    if (!draft) return null;
    steps.push({
      dayId: day.id,
      name: draft.name,
      skip: have.has(draft.name),
      draft,
    });
  }
  return steps;
}

export function programPreviewLines(day: ProgramDay): string[] {
  return day.slots.map((item) => {
    const row = catalogById(item.catalogId);
    const name = row?.name ?? item.catalogId;
    const muscle = row?.primary[0] ? muscleGroupLabel(row.primary[0]) : "";
    return `${name} · ${item.sets}×${item.reps}${muscle ? ` · ${muscle}` : ""}`;
  });
}
