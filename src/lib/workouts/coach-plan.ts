/**
 * Черновик тренировки от ИИ или запасной шаблон.
 * Ничего не пишет в дневник: только проверенный план.
 * Еда — осторожный контекст, не повод резко менять веса.
 */

import { catalogById, EQUIPMENT_KEYS, type EquipmentKey } from "@/lib/workouts/exercise-catalog";
import type { ExerciseKind } from "@/lib/workouts/exercise-kind";
import type { MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import type { MuscleRecoveryStatus } from "@/lib/workouts/muscle-volume";
import type { RoutineDraft } from "@/lib/workouts/programs";

export const COACH_GOALS = ["strength", "muscle", "general"] as const;
export type CoachGoal = (typeof COACH_GOALS)[number];

export const COACH_EXPERIENCE = ["new", "some", "regular"] as const;
export type CoachExperience = (typeof COACH_EXPERIENCE)[number];

export type CoachAvoid = "knee" | "back" | "shoulder" | "wrist";

export type CoachPoolItem = {
  catalogId: string;
  avoid: readonly CoachAvoid[];
  /** main — база под 5×5; assist — изоляция, ей не нужен тот же объём. */
  load: "main" | "assist";
};

/** Короткий пул, который и промпт, и проверка считают допустимым. */
export const COACH_POOL: readonly CoachPoolItem[] = [
  { catalogId: "squat", avoid: ["knee", "back"], load: "main" },
  { catalogId: "leg-press", avoid: ["knee"], load: "main" },
  { catalogId: "leg-curl", avoid: [], load: "assist" },
  { catalogId: "hip-thrust", avoid: [], load: "main" },
  { catalogId: "rdl", avoid: ["back"], load: "main" },
  { catalogId: "lunge-db", avoid: ["knee"], load: "assist" },
  { catalogId: "calf-stand", avoid: [], load: "assist" },
  { catalogId: "bench-press", avoid: ["shoulder", "wrist"], load: "main" },
  { catalogId: "db-bench", avoid: ["shoulder", "wrist"], load: "main" },
  { catalogId: "machine-press", avoid: ["shoulder"], load: "main" },
  { catalogId: "pushup", avoid: ["shoulder", "wrist"], load: "assist" },
  { catalogId: "ohp", avoid: ["shoulder"], load: "main" },
  { catalogId: "db-ohp", avoid: ["shoulder"], load: "main" },
  { catalogId: "lateral", avoid: ["shoulder"], load: "assist" },
  { catalogId: "bb-row", avoid: ["back"], load: "main" },
  { catalogId: "db-row", avoid: ["back"], load: "main" },
  { catalogId: "lat-pulldown", avoid: [], load: "main" },
  { catalogId: "seated-row", avoid: [], load: "main" },
  { catalogId: "face-pull", avoid: ["shoulder"], load: "assist" },
  { catalogId: "bb-curl", avoid: ["wrist"], load: "assist" },
  { catalogId: "pushdown", avoid: [], load: "assist" },
  { catalogId: "crunch", avoid: [], load: "assist" },
];

const COACH_AI_TIMEOUT_MS = 20_000;

export type CoachInput = {
  goal: CoachGoal;
  minutes: number;
  equipment: EquipmentKey[];
  experience: CoachExperience;
  limitations: string;
};

export type MuscleFreshness = {
  key: string;
  status: MuscleRecoveryStatus;
};

export type FoodContext = {
  mealCount: number;
  calories: number;
};

export type CoachExercise = {
  catalogId: string;
  name: string;
  kind: ExerciseKind;
  muscleGroup: string | null;
  sets: number;
  reps: number;
};

export type CoachPreview = {
  source: "ai" | "fallback";
  title: string;
  note: string;
  caution: string | null;
  minutes: number;
  muscleGroups: MuscleGroupKey[];
  exercises: CoachExercise[];
};

const SAFE_NOTE =
  "Черновик под ваши вводные. Веса не подставляем — оставьте как в прошлый раз или пустыми. Это не медицинский совет.";

const BANNED_NOTE = /диагноз|вылеч|гарантир|назнача|болезн|лекарств|терапи/i;

export function foodCaution(food: FoodContext | null): string | null {
  if (!food || food.mealCount === 0) {
    return "В дневнике за сегодня мало еды. Это не повод резко снижать или поднимать веса.";
  }
  if (food.calories > 0 && food.calories < 700 && food.mealCount < 2) {
    return "Записей еды пока немного. Один такой день не причина менять рабочие веса.";
  }
  return null;
}

export function avoidTagsFromText(text: string): Set<CoachAvoid> {
  const value = text.toLowerCase();
  const tags = new Set<CoachAvoid>();
  if (/колен|knee/.test(value)) tags.add("knee");
  if (/поясниц|спин|грыж/.test(value)) tags.add("back");
  if (/плеч|дельт|shoulder/.test(value)) tags.add("shoulder");
  if (/запяст|wrist/.test(value)) tags.add("wrist");
  return tags;
}

function setsFor(input: CoachInput, load: CoachPoolItem["load"]): { sets: number; reps: number } {
  if (input.goal === "strength" && input.experience !== "new" && load === "main") {
    return { sets: 5, reps: 5 };
  }
  if (input.experience === "new") return { sets: 2, reps: 10 };
  if (input.goal === "muscle") return { sets: 3, reps: 10 };
  return { sets: 3, reps: 8 };
}

function exerciseCount(minutes: number): number {
  if (minutes <= 30) return 4;
  if (minutes <= 50) return 5;
  return 6;
}

function allowedPool(input: CoachInput): CoachPoolItem[] {
  const avoid = avoidTagsFromText(input.limitations);
  const equipment = new Set(input.equipment);
  return COACH_POOL.filter((item) => {
    if (item.avoid.some((tag) => avoid.has(tag))) return false;
    const row = catalogById(item.catalogId);
    if (!row) return false;
    if (equipment.size === 0) return row.equipment === "bodyweight";
    return equipment.has(row.equipment) || row.equipment === "bodyweight";
  });
}

function statusScore(status: MuscleRecoveryStatus | undefined): number {
  if (status === "loaded") return 2;
  if (status === "recovering") return 1;
  return 0;
}

export function fallbackCoachPlan(
  input: CoachInput,
  freshness: readonly MuscleFreshness[],
  food: FoodContext | null,
): CoachPreview {
  const want = exerciseCount(input.minutes);
  const score = new Map(freshness.map((row) => [row.key, statusScore(row.status)]));
  const pool = allowedPool(input).sort((a, b) => {
    const left = catalogById(a.catalogId)?.primary[0];
    const right = catalogById(b.catalogId)?.primary[0];
    return (left ? score.get(left) ?? 0 : 0) - (right ? score.get(right) ?? 0 : 0);
  });
  const picked: CoachPoolItem[] = [];
  const usedMuscles = new Set<string>();
  for (const item of pool) {
    const row = catalogById(item.catalogId);
    const muscle = row?.primary[0] ?? "";
    if (muscle && usedMuscles.has(muscle)) continue;
    picked.push(item);
    if (muscle) usedMuscles.add(muscle);
    if (picked.length >= want) break;
  }
  for (const item of pool) {
    if (picked.length >= want) break;
    if (picked.some((have) => have.catalogId === item.catalogId)) continue;
    picked.push(item);
  }
  return previewFromSlots(input, picked.slice(0, want), "fallback", SAFE_NOTE, food);
}

function previewFromSlots(
  input: CoachInput,
  items: readonly CoachPoolItem[],
  source: CoachPreview["source"],
  note: string,
  food: FoodContext | null,
): CoachPreview {
  const exercises: CoachExercise[] = [];
  const muscles = new Set<MuscleGroupKey>();
  for (const item of items) {
    const row = catalogById(item.catalogId);
    if (!row) continue;
    const muscle = row.primary[0] ?? null;
    if (muscle) muscles.add(muscle);
    const scheme = setsFor(input, item.load);
    exercises.push({
      catalogId: row.id,
      name: row.name,
      kind: row.kind,
      muscleGroup: muscle,
      sets: scheme.sets,
      reps: scheme.reps,
    });
  }
  const title =
    input.goal === "strength"
      ? "Силовая на сегодня"
      : input.goal === "muscle"
        ? "Объём на сегодня"
        : "Тренировка на сегодня";
  return {
    source,
    title,
    note,
    caution: foodCaution(food),
    minutes: input.minutes,
    muscleGroups: [...muscles],
    exercises,
  };
}

export function parseCoachInput(raw: unknown): CoachInput | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as Record<string, unknown>;
  const goal = COACH_GOALS.find((item) => item === body.goal);
  const experience = COACH_EXPERIENCE.find((item) => item === body.experience);
  const minutes = Number(body.minutes);
  if (!goal || !experience || !Number.isFinite(minutes)) return null;
  const knownEquipment = new Set<string>(EQUIPMENT_KEYS);
  const equipment = Array.isArray(body.equipment)
    ? body.equipment.filter((item): item is EquipmentKey => typeof item === "string" && knownEquipment.has(item))
    : [];
  const limitations = typeof body.limitations === "string" ? body.limitations.trim().slice(0, 240) : "";
  return {
    goal,
    experience,
    minutes: Math.min(90, Math.max(20, Math.round(minutes))),
    equipment: equipment.slice(0, 8),
    limitations,
  };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function validateCoachJson(
  text: string,
  input: CoachInput,
  food: FoodContext | null,
): CoachPreview | null {
  const parsed = extractJson(text);
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as Record<string, unknown>;
  const list = Array.isArray(body.exercises) ? body.exercises : [];
  const allowed = new Set(allowedPool(input).map((item) => item.catalogId));
  const seen = new Set<string>();
  const exercises: CoachExercise[] = [];
  const muscles = new Set<MuscleGroupKey>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const catalogId = typeof row.catalogId === "string" ? row.catalogId.trim() : "";
    const sets = Number(row.sets);
    const reps = Number(row.reps);
    if (!allowed.has(catalogId) || seen.has(catalogId)) continue;
    if (!Number.isInteger(sets) || sets < 1 || sets > 6) continue;
    if (!Number.isInteger(reps) || reps < 3 || reps > 20) continue;
    const catalog = catalogById(catalogId);
    if (!catalog) continue;
    seen.add(catalogId);
    const muscle = catalog.primary[0] ?? null;
    if (muscle) muscles.add(muscle);
    exercises.push({
      catalogId: catalog.id,
      name: catalog.name,
      kind: catalog.kind,
      muscleGroup: muscle,
      sets,
      reps,
    });
    if (exercises.length >= 8) break;
  }
  if (exercises.length < 3) return null;
  const proposed = typeof body.note === "string" ? body.note.replace(/\s+/g, " ").trim().slice(0, 280) : "";
  const note = proposed && !BANNED_NOTE.test(proposed) ? proposed : SAFE_NOTE;
  const titleRaw = typeof body.title === "string" ? body.title.trim().slice(0, 80) : "";
  return {
    source: "ai",
    title: titleRaw || "Тренировка на сегодня",
    note,
    caution: foodCaution(food),
    minutes: input.minutes,
    muscleGroups: [...muscles],
    exercises,
  };
}

export function coachPrompt(input: CoachInput, freshness: readonly MuscleFreshness[]): string {
  const pool = allowedPool(input)
    .map((item) => {
      const row = catalogById(item.catalogId);
      return row ? `${row.id} | ${row.name} | ${row.equipment} | ${row.primary[0] ?? ""}` : "";
    })
    .filter(Boolean)
    .join("\n");
  const fresh = freshness
    .map((row) => `${row.key}: ${row.status}`)
    .join(", ");
  return [
    "Составь одну тренировку. Ответ — только JSON без markdown.",
    '{"title":"...","note":"...","exercises":[{"catalogId":"...","sets":3,"reps":8}]}',
    "catalogId только из списка. sets 1–6, reps 3–20, упражнений 4–6.",
    "Не ставь веса. Не обещай результат, не ставь диагнозы и не назначай лечение.",
    "Еду не используй как причину резко менять нагрузку.",
    "Ограничения человека важнее схемы: не бери движения, которые их задевают.",
    `Цель ${input.goal}, опыт ${input.experience}, минут ${input.minutes}.`,
    input.limitations ? `Ограничения: ${input.limitations}` : "Ограничений не указано.",
    fresh ? `Мышцы: ${fresh}. Свежие группы предпочтительнее.` : "",
    "Список:",
    pool,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function buildCoachPreview(input: {
  request: CoachInput;
  freshness: readonly MuscleFreshness[];
  food: FoodContext | null;
  complete: ((prompt: string) => Promise<string>) | null;
  timeoutMs?: number;
}): Promise<CoachPreview> {
  const fallback = () => fallbackCoachPlan(input.request, input.freshness, input.food);
  if (!input.complete) return fallback();
  const timeoutMs = input.timeoutMs ?? COACH_AI_TIMEOUT_MS;
  try {
    const text = await Promise.race([
      input.complete(coachPrompt(input.request, input.freshness)),
      new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]);
    return validateCoachJson(text, input.request, input.food) ?? fallback();
  } catch {
    return fallback();
  }
}

export function draftFromPreview(preview: CoachPreview): RoutineDraft | null {
  if (preview.exercises.length === 0 || preview.muscleGroups.length === 0) return null;
  return {
    name: preview.title.slice(0, 120),
    note: [preview.note, preview.caution].filter(Boolean).join(" ").slice(0, 200),
    muscleGroups: preview.muscleGroups,
    exercises: preview.exercises.map((exercise) => ({
      name: exercise.name,
      kind: exercise.kind,
      muscleGroup: exercise.muscleGroup,
      catalogId: exercise.catalogId,
      plannedSets: Array.from({ length: exercise.sets }, () => ({
        weightKg: null,
        reps: exercise.reps,
        distanceKm: null,
        durationSec: null,
        setType: "working" as const,
      })),
    })),
  };
}
