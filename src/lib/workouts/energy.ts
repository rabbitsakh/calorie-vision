/**
 * Оценка расхода по Компендиуму физической активности 2011
 * (Ainsworth et al., Med Sci Sports Exerc. 2011;43(8):1575–1581).
 *
 * MET в Компендиуме — gross: уже включает покой (1 MET).
 * На карточке и в надбавке к норме показываем active = (MET − 1) × кг × часы,
 * чтобы не прибавить покой второй раз к BMR.
 * Это популяционная оценка, не измерение.
 *
 * Ходьба и бег: код берётся по скорости (дистанция / длительность),
 * а не по слову «дорожка». Без скорости высокая интенсивность не ставится.
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
 * Кардио без вида и без скорости.
 * 02064 home exercise, general — 3.8 MET. Не бег и не «умеренно-высокая» велонагрузка.
 */
export const GENERIC_CARDIO_MET = 3.8;
/** 17190 ходьба 2.8–3.2 мили/ч, ровно, умеренно. */
export const WALK_MODERATE_MET = 3.5;
/** 12020 jogging, general — бег без известной скорости, не 8.3. */
export const JOG_GENERAL_MET = 7;
/** 4 мили/ч — самый медленный бег в таблице (12029). Медленнее считаем ходьбой. */
export const RUN_MIN_KMH = 4 * 1.609344;
/** 5 мили/ч — самая быстрая ровная ходьба в таблице (17231). */
export const WALK_MAX_KMH = 5 * 1.609344;
/** Оставшееся время таймера без упражнений — спокойное перемещение, не бег. */
export const GAP_MET = 2.5;

/** 40 с работы + 90 с отдыха. MET силовой уже включает паузы, поэтому цикл целиком. */
export const ESTIMATED_SET_SEC = 130;

/**
 * Точный MET справочника (Компендиум, умеренная работа).
 * Нет ключа — оценка по типу и снаряду.
 */
/**
 * Фиксированные коды только там, где скорость не различает ходьбу и бег.
 * Бег и дорожка сюда не входят: им нужен темп.
 */
export const CATALOG_MET: Readonly<Record<string, number>> = {
  ellipse: 5,
  bike: 4.8,
  "bike-out": 4.8,
  spin: 8.5,
  "row-erg": 4.8,
  "row-water": 4.8,
  rope: 8.8,
  stepper: 9,
  swim: 6,
  "ski-erg": 6.8,
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

const MACHINE_NAME = /тренажер|смит|хаммер|кроссовер|блок/;
const COMPOUND_NAME = /присед|станов|жим лежа|тяга|выпад|румын/;

export type EnergySet = {
  completed?: boolean | null;
  durationSec?: number | null;
  distanceKm?: number | null;
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
  approximateReasons: Array<"weight" | "duration" | "gap" | "intensity">;
  /** (MET − 1) × кг × часы. Это число на карточке и в надбавке к норме. */
  cardioKcal: number;
  strengthKcal: number;
  /** MET × кг × часы, вместе с покоем. В норму не прибавляется. */
  grossKcal: number;
  paceKmh: number | null;
  /** ходьба / бег / название снаряда, если вид узнан. */
  movement: string | null;
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

type Ambulation = "walk" | "run" | "either" | "incline";

type CardioProfile = {
  met: number;
  movement: string | null;
  /** Скорость или усилие не из чего вывести — интенсивность занижена специально. */
  unspecified: boolean;
  paceKmh: number | null;
};

function kmhToMph(kmh: number): number {
  return kmh / 1.609344;
}

/** Ближайшая опубликованная точка. При равенстве — меньший MET, без интерполяции. */
function nearestMet(mph: number, points: ReadonlyArray<{ mph: number; met: number }>): number {
  let best = points[0]!;
  let bestDist = Infinity;
  for (const point of points) {
    const dist = Math.abs(point.mph - mph);
    if (dist < bestDist - 1e-9 || (Math.abs(dist - bestDist) <= 1e-9 && point.met < best.met)) {
      best = point;
      bestDist = dist;
    }
  }
  return best.met;
}

/** Ровная ходьба, таблица 17151–17231. 2.8–3.2 мили/ч — отдельный диапазон 17190, не «ближайшая точка». */
function walkingMet(mph: number): number {
  if (mph < 2) return 2;
  if (mph >= 2.8 && mph <= 3.2) return WALK_MODERATE_MET;
  return nearestMet(mph, [
    { mph: 2, met: 2.8 },
    { mph: 2.5, met: 3 },
    { mph: 3.5, met: 4.3 },
    { mph: 4, met: 5 },
    { mph: 4.5, met: 7 },
    { mph: 5, met: 8.3 },
  ]);
}

/** Бег 12029–12135. Медленнее 4 миль/ч в этой таблице нет. */
function runningMet(mph: number): number {
  return nearestMet(mph, [
    { mph: 4, met: 6 },
    { mph: 5, met: 8.3 },
    { mph: 5.2, met: 9 },
    { mph: 6, met: 9.8 },
    { mph: 6.7, met: 10.5 },
    { mph: 7, met: 11 },
    { mph: 7.5, met: 11.5 },
    { mph: 8, met: 11.8 },
    { mph: 8.6, met: 12.3 },
    { mph: 9, met: 12.8 },
    { mph: 10, met: 14.5 },
    { mph: 11, met: 16 },
    { mph: 12, met: 19 },
    { mph: 13, met: 19.8 },
    { mph: 14, met: 23 },
  ]);
}

function saysRun(key: string): boolean {
  return /(^|\s)бег(\s|$)|running|\brun\b|jogging|пробежк/.test(key);
}

/**
 * Слово «дорожка» / «беговая» само по себе — не бег.
 * «Ходьба» важнее дорожки. «Бег» как отдельное слово — явный бег, темп всё равно может его поправить.
 */
function explicitAmbulation(userName: string, catalogId: string | null): Ambulation | null {
  const key = normalizeExerciseName(userName);
  if (catalogId === "walk-incline" || /ходьба в горку|ходьба в наклоне|incline walk/.test(key)) {
    return "incline";
  }
  if (catalogId === "walk" || catalogId === "walk-tread" || /ходьб|\bwalk\b|walking/.test(key)) {
    return "walk";
  }
  if (catalogId === "interval-run" || /интервальн/.test(key)) return "run";
  if (saysRun(key) || catalogId === "run") return "run";
  if (catalogId === "treadmill" || /дорожк|treadmill|беговая/.test(key)) return "either";
  return null;
}

function modalityMet(userName: string, catalogId: string | null): Omit<CardioProfile, "paceKmh"> | null {
  const key = normalizeExerciseName(userName);
  const hit = (id: string, pattern: RegExp, met: number, movement: string, unspecified: boolean) =>
    catalogId === id || pattern.test(key) ? { met, movement, unspecified } : null;
  return (
    hit("ellipse", /эллип|elliptical/, 5, "эллипс", false) ??
    hit("spin", /сайкл|\bspin\b/, 8.5, "сайкл", false) ??
    hit("bike", /велотренаж|exercise bike/, 4.8, "вело", true) ??
    hit("bike-out", /велосипед|\bbike\b|cycling/, 4.8, "вело", true) ??
    hit("row-erg", /греб|rowing/, 4.8, "гребля", true) ??
    hit("row-water", /академическ/, 4.8, "гребля", true) ??
    hit("rope", /скакал|jump rope|\brope\b/, 8.8, "скакалка", true) ??
    hit("stepper", /степпер|stair/, 9, "степпер", false) ??
    hit("swim", /плав|swim/, 6, "плавание", true) ??
    hit("ski-erg", /лыж|\bski\b/, 6.8, "лыжи", false) ??
    hit("burpee", /берпи|burpee/, 8, "берпи", true)
  );
}

function ambulationFromPace(paceKmh: number, explicit: Ambulation): { met: number; movement: string } {
  const mph = kmhToMph(paceKmh);
  if (explicit === "incline" && mph >= 2.9 && mph <= 3.5) {
    return { met: 5.3, movement: "ходьба в горку" };
  }
  const clearlyRunning = paceKmh >= RUN_MIN_KMH && explicit !== "walk";
  const walkTooFast = explicit === "walk" && paceKmh > WALK_MAX_KMH;
  if (clearlyRunning || walkTooFast) {
    return { met: runningMet(mph), movement: "бег" };
  }
  return { met: walkingMet(mph), movement: "ходьба" };
}

function cardioProfile(exercise: EnergyExercise, paceKmh: number | null): CardioProfile | null {
  const kind = parseExerciseKind(exercise.kind);
  const row = rowFor(exercise);
  const id = row?.id ?? (exercise.catalogId || null);
  const name = exercise.name ?? "";
  const amb = explicitAmbulation(name, id);
  const modality = modalityMet(name, id);
  if (!amb && !modality && kind !== "cardio" && row?.equipment !== "cardio") return null;
  if (amb) {
    if (paceKmh != null && paceKmh > 0) {
      const decided = ambulationFromPace(paceKmh, amb);
      return { ...decided, unspecified: false, paceKmh };
    }
    if (amb === "incline") {
      return { met: 5.3, movement: "ходьба в горку", unspecified: true, paceKmh: null };
    }
    if (amb === "run") {
      return { met: JOG_GENERAL_MET, movement: "бег", unspecified: true, paceKmh: null };
    }
    return { met: WALK_MODERATE_MET, movement: "ходьба", unspecified: true, paceKmh: null };
  }
  if (modality) return { ...modality, paceKmh: null };
  return { met: GENERIC_CARDIO_MET, movement: null, unspecified: true, paceKmh: null };
}

function metFromEquipment(row: CatalogExercise, kind: ExerciseKind): number {
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
  if (kind === "cardio") return GENERIC_CARDIO_MET;
  if (kind === "duration") return DURATION_MET;
  if (kind === "assisted") return MACHINE_MET;
  if (kind === "weighted_bw") return FREE_WEIGHT_VIGOROUS_MET;
  const key = normalizeExerciseName(name);
  if (MACHINE_NAME.test(key)) return MACHINE_MET;
  if (kind === "bodyweight") return BODYWEIGHT_MET;
  if (COMPOUND_NAME.test(key)) return FREE_WEIGHT_VIGOROUS_MET;
  return FREE_WEIGHT_MET;
}

/** MET одного упражнения. Для ходьбы и бега нужен темп, иначе интенсивность не завышается. */
export function metForExercise(exercise: EnergyExercise, paceKmh?: number | null): number {
  const cardio = cardioProfile(exercise, paceKmh ?? null);
  if (cardio) return cardio.met;
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
    grossKcal: 0,
    paceKmh: null,
    movement: null,
  };
}

function positive(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function distanceKmOf(exercise: EnergyExercise): number {
  return completedSets(exercise).reduce((sum, set) => sum + positive(set.distanceKm), 0);
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

  const distanceIndexes = exercises
    .map((exercise, index) => (distanceKmOf(exercise) > 0 ? index : -1))
    .filter((index) => index >= 0);
  const soleDistance = distanceIndexes.length === 1 ? distanceIndexes[0]! : -1;

  const resolved = exercises.map((exercise, index) => {
    const kind = parseExerciseKind(exercise.kind);
    const ownSec = timedSec(exercise);
    const km = distanceKmOf(exercise);
    let paceKmh: number | null = null;
    if (km > 0 && ownSec > 0) paceKmh = km / (ownSec / 3600);
    else if (km > 0 && ownSec <= 0 && index === soleDistance && elapsed > 0) {
      paceKmh = km / (elapsed / 3600);
    }
    const cardio = cardioProfile(exercise, paceKmh);
    const met = cardio?.met ?? metForExercise(exercise, paceKmh);
    return {
      met,
      role: (cardio || kind === "cardio" ? "cardio" : "strength") as Segment["role"],
      timed: ownSec,
      sets: setCount(exercise),
      cardio,
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
  let gross = 0;
  let metSec = 0;
  let totalSec = 0;
  for (const segment of segments) {
    const active = kcalFromMet(Math.max(0, segment.met - 1), weightKg, segment.sec);
    gross += kcalFromMet(segment.met, weightKg, segment.sec);
    if (segment.role === "cardio") cardio += active;
    else strength += active;
    metSec += segment.met * segment.sec;
    totalSec += segment.sec;
  }
  const cardios = resolved.filter((row) => row.cardio);
  let movement: string | null = null;
  let paceKmh: number | null = null;
  let intensityUncertain = false;
  if (cardios.length === 1 && cardios[0]?.cardio) {
    movement = cardios[0].cardio.movement;
    paceKmh = cardios[0].cardio.paceKmh;
    intensityUncertain = cardios[0].cardio.unspecified;
  } else if (cardios.length > 1) {
    intensityUncertain = true;
  }
  const reasons: SessionEnergy["approximateReasons"] = [];
  if (!measured) reasons.push("weight");
  if (durationApproximate) reasons.push("duration");
  if (gapApproximate) reasons.push("gap");
  if (intensityUncertain) reasons.push("intensity");
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
    grossKcal: Math.round(gross),
    paceKmh,
    movement,
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

function formatPace(kmh: number): string {
  const rounded = Math.round(kmh * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
  return `${text} км/ч`;
}

/** Подпись всегда говорит, что это оценка, а не измерение. */
export function formatSessionEnergyCaption(energy: SessionEnergy): string {
  const parts = ["оценка, сверх покоя"];
  if (energy.movement && energy.paceKmh != null && energy.paceKmh > 0) {
    parts.push(`${energy.movement} ${formatPace(energy.paceKmh)}`);
  } else if (energy.movement) {
    parts.push(energy.movement);
  }
  if (energy.approximateReasons.includes("intensity")) parts.push("скорость неизвестна");
  if (energy.weightSource === "fallback") {
    parts.push(`нет веса, считаем от ${FALLBACK_BODY_WEIGHT_KG} кг`);
  } else {
    parts.push(formatKg(energy.weightKg));
  }
  if (energy.approximateReasons.includes("duration")) parts.push("время по подходам");
  if (energy.approximateReasons.includes("gap")) parts.push("часть времени без упражнений");
  if (energy.met > 0) parts.push(`MET ${formatMet(energy.met)}`);
  return parts.join(" · ");
}

export function formatSessionEnergyLine(energy: SessionEnergy): string | null {
  if (energy.kcal <= 0) return null;
  return `${formatSessionEnergyKcal(energy)} · ${formatSessionEnergyCaption(energy)}`;
}
