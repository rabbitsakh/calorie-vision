/**
 * Расход тренировки по MET: ккал = MET × вес_кг × часы.
 * Компендиум / ACSM. Точный MET берётся из справочника, если он задан;
 * иначе — вилка 3–6 для свободных весов и ниже для тренажёров.
 * Пустая сессия не получает константу «N ккал».
 */

import { matchExerciseName } from "@/lib/workouts/catalog-link";
import { catalogById, type CatalogExercise, type EquipmentKey } from "@/lib/workouts/exercise-catalog";
import { parseExerciseKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { normalizeExerciseName } from "@/lib/workouts/exercise-name";
import { sessionElapsedSec, type SessionClock } from "@/lib/workouts/session-clock";

/** Если в профиле нет ни одного измерения веса. */
export const FALLBACK_BODY_WEIGHT_KG = 70;

/** Свободные веса, умеренно (Компендиум 02052 ≈ 3.5, рабочая середина вилки 3–6). */
export const FREE_WEIGHT_MET = 5;
/** Базовые многосуставные со свободным весом, энергично (02050 ≈ 6). */
export const FREE_WEIGHT_VIGOROUS_MET = 6;
/** Тренажёры, блоки, помощь — ниже свободного веса. */
export const MACHINE_MET = 3.5;
/** Свой вес, умеренно (отжимания, пресс). */
export const BODYWEIGHT_MET = 3.8;
/** Подтягивания, брусья — как энергичная силовая, уже с отдыхом между подходами. */
export const BODYWEIGHT_VIGOROUS_MET = 6;
/** Удержание (планка) и прочие упражнения на время. */
export const DURATION_MET = 3.5;
/**
 * Кардио без узнаваемого вида.
 * 6.8 MET — велотренажёр, умеренно (02011). На 70 кг это ≈ 8 ккал/мин,
 * как прежняя оценка кардио, пока упражнение не распознано точнее.
 */
export const GENERIC_CARDIO_MET = 6.8;
/** Оставшееся время таймера без упражнений — спокойное перемещение, не бег. */
export const GAP_MET = 2.5;

/** 40 с работы + 90 с отдыха. MET силовой уже включает паузы, поэтому цикл целиком. */
export const ESTIMATED_SET_SEC = 130;

/**
 * Точный MET справочника (Компендиум, умеренная работа).
 * Нет ключа — оценка по типу и снаряду.
 */
export const CATALOG_MET: Readonly<Record<string, number>> = {
  run: 8.3,
  treadmill: 8.3,
  "interval-run": 9.8,
  ellipse: 5,
  bike: 6.8,
  spin: 8.8,
  "row-erg": 6,
  "row-water": 6,
  rope: 11.8,
  stepper: 9,
  swim: 6,
  "ski-erg": 7,
  burpee: 8,
};

const VIGOROUS_FREE_WEIGHT_IDS = new Set([
  "bench-press",
  "bench-close",
  "bench-incline",
  "bench-decline",
  "deadlift",
  "deadlift-sumo",
  "trap-bar",
  "squat",
  "front-squat",
  "ohp",
  "ohp-seated",
  "bb-row",
  "bb-row-under",
  "pendlay",
  "t-bar",
  "lunge-bb",
  "rdl",
  "hip-thrust",
  "farmer",
  "kb-swing",
  "kb-snatch",
]);

const VIGOROUS_BODYWEIGHT_IDS = new Set([
  "pullup",
  "chinup",
  "pullup-wide",
  "pullup-neutral",
  "dips",
  "ring-pullup",
  "ring-pushup",
]);

/** Более специфичные шаблоны раньше общих («сайкл» до «вело», «интервал» до «бег»). */
const CARDIO_NAME_MET: Array<[RegExp, number]> = [
  [/эллип|elliptical/, CATALOG_MET.ellipse!],
  [/сайкл|spin/, CATALOG_MET.spin!],
  [/вело|bike|bicycle|велосипед/, CATALOG_MET.bike!],
  [/интервал/, CATALOG_MET["interval-run"]!],
  [/бег|run|treadmill|дорожк/, CATALOG_MET.run!],
  [/греб|rowing/, CATALOG_MET["row-erg"]!],
  [/скакал|rope/, CATALOG_MET.rope!],
  [/степпер|stair/, CATALOG_MET.stepper!],
  [/плав|swim/, CATALOG_MET.swim!],
  [/лыж|ski/, CATALOG_MET["ski-erg"]!],
];

const MACHINE_NAME = /тренажер|смит|хаммер|кроссовер|блок/;
const COMPOUND_NAME = /присед|станов|жим лежа|тяга|выпад|румын/;

export type EnergySet = {
  completed?: boolean | null;
  durationSec?: number | null;
  setType?: string | null;
};

export type EnergyExercise = {
  name: string;
  kind?: string | null;
  catalogId?: string | null;
  sets?: readonly EnergySet[] | null;
};

export type SessionEnergy = {
  kcal: number;
  /** Средний MET по учтённому времени. */
  met: number;
  durationSec: number;
  weightKg: number;
  weightSource: "measured" | "fallback";
  durationSource: "clock" | "logged" | "estimated" | "none";
  approximate: boolean;
  approximateReasons: Array<"weight" | "duration" | "gap">;
  cardioKcal: number;
  strengthKcal: number;
};

const nameCache = new Map<string, string | null>();

function catalogIdFromName(name: string): string | null {
  const key = normalizeExerciseName(name);
  if (!key) return null;
  const cached = nameCache.get(key);
  if (cached !== undefined) return cached;
  const match = matchExerciseName(name);
  const id = match.status === "confident" ? match.catalogId : null;
  nameCache.set(key, id);
  return id;
}

function rowFor(exercise: EnergyExercise): CatalogExercise | null {
  if (exercise.catalogId) {
    const byId = catalogById(exercise.catalogId);
    if (byId) return byId;
  }
  const id = catalogIdFromName(exercise.name ?? "");
  return id ? catalogById(id) : null;
}

function cardioMetFromName(name: string): number | null {
  const key = normalizeExerciseName(name);
  if (!key) return null;
  for (const [re, met] of CARDIO_NAME_MET) {
    if (re.test(key)) return met;
  }
  return null;
}

function metFromEquipment(row: CatalogExercise, kind: ExerciseKind): number {
  if (kind === "cardio" || row.equipment === "cardio") {
    return cardioMetFromName(row.name) ?? GENERIC_CARDIO_MET;
  }
  if (kind === "duration") return DURATION_MET;
  if (kind === "assisted") return MACHINE_MET;
  if (kind === "weighted_bw") return FREE_WEIGHT_VIGOROUS_MET;
  const equipment: EquipmentKey = row.equipment;
  if (equipment === "machine" || equipment === "cable" || equipment === "band") return MACHINE_MET;
  if (equipment === "barbell" || equipment === "dumbbell" || equipment === "kettlebell") {
    return VIGOROUS_FREE_WEIGHT_IDS.has(row.id) ? FREE_WEIGHT_VIGOROUS_MET : FREE_WEIGHT_MET;
  }
  if (kind === "bodyweight" || equipment === "bodyweight") {
    return VIGOROUS_BODYWEIGHT_IDS.has(row.id) ? BODYWEIGHT_VIGOROUS_MET : BODYWEIGHT_MET;
  }
  return FREE_WEIGHT_MET;
}

function metWithoutCatalog(name: string, kind: ExerciseKind): number {
  const named = cardioMetFromName(name);
  if (kind === "cardio") return named ?? GENERIC_CARDIO_MET;
  if (named != null && kind !== "strength") return named;
  if (kind === "duration") return DURATION_MET;
  if (kind === "assisted") return MACHINE_MET;
  if (kind === "weighted_bw") return FREE_WEIGHT_VIGOROUS_MET;
  const key = normalizeExerciseName(name);
  if (MACHINE_NAME.test(key)) return MACHINE_MET;
  if (kind === "bodyweight") return BODYWEIGHT_MET;
  if (COMPOUND_NAME.test(key)) return FREE_WEIGHT_VIGOROUS_MET;
  return FREE_WEIGHT_MET;
}

/** MET одного упражнения: точное значение справочника или оценка ACSM. */
export function metForExercise(exercise: EnergyExercise): number {
  const kind = parseExerciseKind(exercise.kind);
  const row = rowFor(exercise);
  if (row) {
    const exact = CATALOG_MET[row.id];
    if (exact != null) return exact;
    return metFromEquipment(row, kind);
  }
  return metWithoutCatalog(exercise.name ?? "", kind);
}

export function kcalFromMet(met: number, weightKg: number, durationSec: number): number {
  if (!(met > 0) || !(weightKg > 0) || !(durationSec > 0)) return 0;
  return met * weightKg * (durationSec / 3600);
}

function completedSets(exercise: EnergyExercise): EnergySet[] {
  return (exercise.sets ?? []).filter((set) => set.completed !== false);
}

function timedSec(exercise: EnergyExercise): number {
  let sec = 0;
  for (const set of completedSets(exercise)) {
    const value = Number(set.durationSec) || 0;
    if (value > 0) sec += value;
  }
  return sec;
}

function setCount(exercise: EnergyExercise): number {
  return completedSets(exercise).length;
}

type Segment = { met: number; sec: number; role: "cardio" | "strength" };

function emptyEnergy(weightKg: number, weightSource: SessionEnergy["weightSource"]): SessionEnergy {
  return {
    kcal: 0,
    met: 0,
    durationSec: 0,
    weightKg,
    weightSource,
    durationSource: "none",
    approximate: weightSource === "fallback",
    approximateReasons: weightSource === "fallback" ? ["weight"] : [],
    cardioKcal: 0,
    strengthKcal: 0,
  };
}

export function estimateSessionEnergy(input: {
  exercises?: readonly EnergyExercise[] | null;
  elapsedSec?: number | null;
  weightKg?: number | null;
}): SessionEnergy {
  const measured =
    input.weightKg != null && Number.isFinite(input.weightKg) && input.weightKg > 0;
  const weightKg = measured ? input.weightKg! : FALLBACK_BODY_WEIGHT_KG;
  const weightSource: SessionEnergy["weightSource"] = measured ? "measured" : "fallback";
  const exercises = input.exercises ?? [];
  const elapsed = Math.max(0, Math.round(Number(input.elapsedSec) || 0));

  const resolved = exercises.map((exercise) => {
    const kind = parseExerciseKind(exercise.kind);
    return {
      met: metForExercise(exercise),
      role: (kind === "cardio" ? "cardio" : "strength") as Segment["role"],
      timed: timedSec(exercise),
      sets: setCount(exercise),
    };
  });

  const timed = resolved.filter((row) => row.timed > 0);
  const untimed = resolved.filter((row) => row.timed <= 0);
  const segments: Segment[] = [];
  let durationSource: SessionEnergy["durationSource"] = "none";
  let durationApproximate = false;
  let gapApproximate = false;

  if (elapsed > 0 && resolved.length > 0) {
    durationSource = "clock";
    const timedSum = timed.reduce((sum, row) => sum + row.timed, 0);
    if (timedSum > elapsed && timedSum > 0) {
      // Записанная длительность длиннее таймера — берём сумму времени упражнений.
      durationSource = "logged";
      for (const row of timed) {
        segments.push({ met: row.met, sec: row.timed, role: row.role });
      }
    } else {
      for (const row of timed) segments.push({ met: row.met, sec: row.timed, role: row.role });
      const remain = elapsed - timedSum;
      if (remain > 0 && untimed.length > 0) {
        const weights = untimed.map((row) => Math.max(1, row.sets));
        const sumW = weights.reduce((sum, value) => sum + value, 0);
        untimed.forEach((row, index) => {
          segments.push({
            met: row.met,
            sec: remain * (weights[index]! / sumW),
            role: row.role,
          });
        });
      } else if (remain > 0) {
        segments.push({ met: GAP_MET, sec: remain, role: "strength" });
        gapApproximate = true;
      }
    }
  } else if (timed.length > 0 || untimed.some((row) => row.sets > 0)) {
    durationSource = timed.length > 0 ? "logged" : "estimated";
    for (const row of timed) segments.push({ met: row.met, sec: row.timed, role: row.role });
    const workers = untimed.filter((row) => row.sets > 0);
    if (workers.length > 0) {
      durationApproximate = true;
      if (timed.length > 0) durationSource = "logged";
      const total = workers.reduce((sum, row) => sum + row.sets, 0) * ESTIMATED_SET_SEC;
      const sumW = workers.reduce((sum, row) => sum + row.sets, 0);
      for (const row of workers) {
        segments.push({
          met: row.met,
          sec: total * (row.sets / sumW),
          role: row.role,
        });
      }
    }
  }

  if (segments.length === 0) return emptyEnergy(weightKg, weightSource);

  let cardio = 0;
  let strength = 0;
  let metSec = 0;
  let totalSec = 0;
  for (const segment of segments) {
    const kcal = kcalFromMet(segment.met, weightKg, segment.sec);
    if (segment.role === "cardio") cardio += kcal;
    else strength += kcal;
    metSec += segment.met * segment.sec;
    totalSec += segment.sec;
  }
  const reasons: SessionEnergy["approximateReasons"] = [];
  if (!measured) reasons.push("weight");
  if (durationApproximate) reasons.push("duration");
  if (gapApproximate) reasons.push("gap");
  return {
    kcal: Math.round(cardio + strength),
    met: totalSec > 0 ? Math.round((metSec / totalSec) * 10) / 10 : 0,
    durationSec: Math.round(totalSec),
    weightKg,
    weightSource,
    durationSource,
    approximate: reasons.length > 0,
    approximateReasons: reasons,
    cardioKcal: Math.round(cardio),
    strengthKcal: Math.round(strength),
  };
}

export function estimateDbSessionEnergy(
  session: SessionClock & { exercises?: readonly EnergyExercise[] | null },
  weightKg: number | null | undefined,
  nowMs?: number,
): SessionEnergy {
  return estimateSessionEnergy({
    weightKg,
    elapsedSec: sessionElapsedSec(session, nowMs),
    exercises: session.exercises,
  });
}

function formatKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${text} кг`;
}

function formatMet(met: number): string {
  const rounded = Math.round(met * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

export function formatSessionEnergyKcal(energy: SessionEnergy): string {
  if (energy.kcal <= 0) return "";
  return `${energy.approximate ? "~" : ""}${energy.kcal} ккал`;
}

/** Короткая подпись под калориями: откуда вес и время. */
export function formatSessionEnergyCaption(energy: SessionEnergy): string {
  const missingWeight = energy.weightSource === "fallback";
  const estimatedTime = energy.approximateReasons.includes("duration");
  const gap = energy.approximateReasons.includes("gap");
  if (missingWeight && estimatedTime) {
    return `примерно: нет веса, считаем от ${FALLBACK_BODY_WEIGHT_KG} кг, время по подходам`;
  }
  if (missingWeight) {
    return `примерно: нет веса, считаем от ${FALLBACK_BODY_WEIGHT_KG} кг`;
  }
  if (estimatedTime) {
    return `примерно: время по подходам · ${formatKg(energy.weightKg)}`;
  }
  if (gap) {
    return `примерно: часть времени без упражнений · ${formatKg(energy.weightKg)}`;
  }
  return `MET ${formatMet(energy.met)} · ${formatKg(energy.weightKg)}`;
}

export function formatSessionEnergyLine(energy: SessionEnergy): string | null {
  if (energy.kcal <= 0) return null;
  return `${formatSessionEnergyKcal(energy)} · ${formatSessionEnergyCaption(energy)}`;
}
