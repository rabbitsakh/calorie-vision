/**
 * Недельный объём и «карта восстановления» по мышцам справочника.
 * Ориентир по давности прямой нагрузки, не медицинская рекомендация.
 *
 * Тоннаж (вес × повторы рабочих подходов) и длительность кардио:
 * основные мышцы делят 100% поровну, вспомогательные — половину, тоже поровну.
 * Нет catalogId или неизвестный id — весь объём на ручную группу упражнения.
 * Ручной список групп на самой тренировке здесь не используется.
 */

import { mondayOfWeek, shiftDateKey } from "@/lib/dates";
import { catalogById } from "@/lib/workouts/exercise-catalog";
import { parseExerciseKind } from "@/lib/workouts/exercise-kind";
import { roundLoad, setLoad } from "@/lib/workouts/load";
import {
  isMuscleGroupKey,
  MUSCLE_GROUP_KEYS,
  muscleGroupLabel,
  type MuscleGroupKey,
} from "@/lib/workouts/muscle-groups";
import { setCountsTowardLoad } from "@/lib/workouts/set-meta";

/** Доля объёма, которую вместе получают вспомогательные мышцы. */
export const SECONDARY_VOLUME_SHARE = 0.5;

/**
 * Часы с последней прямой нагрузки.
 * Крупные: грудь, спина, ноги. Мелкие чуть короче. Кардио — отдельно и ещё короче.
 */
export const RECOVERY_WINDOWS = {
  large: { loadedBeforeH: 48, freshAfterH: 72 },
  small: { loadedBeforeH: 36, freshAfterH: 48 },
  cardio: { loadedBeforeH: 24, freshAfterH: 36 },
} as const;

export type RecoveryBand = keyof typeof RECOVERY_WINDOWS;
export type MuscleRecoveryStatus = "loaded" | "recovering" | "fresh";

export type MuscleVolumeSet = {
  weightKg?: number | null;
  reps?: number | null;
  durationSec?: number | null;
  distanceKm?: number | null;
  setType?: string | null;
  completed?: boolean | null;
};

export type MuscleVolumeExercise = {
  catalogId?: string | null;
  muscleGroup?: string | null;
  kind?: string | null;
  sets: readonly MuscleVolumeSet[];
};

export type MuscleVolumeSession = {
  date: string;
  endedAt?: Date | string | null;
  startedAt?: Date | string | null;
  exercises: readonly MuscleVolumeExercise[];
};

export type MuscleRecoveryRow = {
  key: MuscleGroupKey;
  label: string;
  /** кг·повт за неделю (силовые и weighted). */
  tonnage: number;
  /** Секунды кардио и упражнений «на время» за неделю. */
  durationSec: number;
  /** Прямые рабочие подходы за неделю (основные мышцы или ручная группа). */
  directSets: number;
  status: MuscleRecoveryStatus;
  /** null — прямой нагрузки ещё не было. */
  hoursSinceStrong: number | null;
};

export type MuscleRecoveryMap = {
  weekStart: string;
  weekEnd: string;
  rows: MuscleRecoveryRow[];
};

const LARGE_GROUPS = new Set<MuscleGroupKey>(["chest", "back", "legs"]);

export function recoveryBand(group: MuscleGroupKey): RecoveryBand {
  if (group === "cardio") return "cardio";
  if (LARGE_GROUPS.has(group)) return "large";
  return "small";
}

export function recoveryStatusForGroup(
  group: MuscleGroupKey,
  lastStrongAtMs: number | null,
  nowMs: number,
): MuscleRecoveryStatus {
  if (lastStrongAtMs == null || !Number.isFinite(lastStrongAtMs) || !Number.isFinite(nowMs)) {
    return "fresh";
  }
  const hours = (nowMs - lastStrongAtMs) / 3_600_000;
  if (hours < 0) return "loaded";
  const window = RECOVERY_WINDOWS[recoveryBand(group)];
  if (hours < window.loadedBeforeH) return "loaded";
  if (hours < window.freshAfterH) return "recovering";
  return "fresh";
}

type Stimulus = {
  tonnage: number;
  durationSec: number;
  directUnits: number;
};

function exerciseStimulus(exercise: MuscleVolumeExercise): Stimulus {
  const kind = parseExerciseKind(exercise.kind);
  const working = exercise.sets.filter((set) => setCountsTowardLoad(set));
  if (kind === "cardio" || kind === "duration") {
    let durationSec = 0;
    let directUnits = 0;
    for (const set of working) {
      const seconds = Number(set.durationSec) || 0;
      const distance = Number(set.distanceKm) || 0;
      if (seconds > 0) {
        durationSec += seconds;
        directUnits += 1;
      } else if (kind === "cardio" && distance > 0) {
        directUnits += 1;
      }
    }
    return { tonnage: 0, durationSec, directUnits };
  }
  if (kind === "bodyweight" || kind === "assisted") {
    let directUnits = 0;
    for (const set of working) {
      if ((Number(set.reps) || 0) > 0) directUnits += 1;
    }
    return { tonnage: 0, durationSec: 0, directUnits };
  }
  let tonnage = 0;
  let directUnits = 0;
  for (const set of working) {
    const load = setLoad(set);
    if (load > 0) {
      tonnage += load;
      directUnits += 1;
    }
  }
  return { tonnage, durationSec: 0, directUnits };
}

type MuscleTarget = { group: MuscleGroupKey; role: "primary" | "secondary" };

function exerciseTargets(exercise: MuscleVolumeExercise): MuscleTarget[] {
  const catalogId = exercise.catalogId?.trim();
  if (catalogId) {
    const row = catalogById(catalogId);
    if (row && (row.primary.length > 0 || row.secondary.length > 0)) {
      const primary = row.primary.filter((group, index) => row.primary.indexOf(group) === index);
      const secondary = row.secondary.filter(
        (group, index) => row.secondary.indexOf(group) === index && !primary.includes(group),
      );
      return [
        ...primary.map((group) => ({ group, role: "primary" as const })),
        ...secondary.map((group) => ({ group, role: "secondary" as const })),
      ];
    }
  }
  const manual = exercise.muscleGroup?.trim() ?? "";
  if (isMuscleGroupKey(manual)) {
    return [{ group: manual, role: "primary" }];
  }
  return [];
}

function sessionInstantMs(session: MuscleVolumeSession): number {
  const raw = session.endedAt ?? session.startedAt;
  if (raw instanceof Date && Number.isFinite(raw.getTime())) return raw.getTime();
  if (typeof raw === "string") {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  const noon = Date.parse(`${session.date}T12:00:00`);
  return Number.isFinite(noon) ? noon : 0;
}

type GroupAccum = {
  tonnage: number;
  durationSec: number;
  directSets: number;
  lastStrongMs: number | null;
};

function emptyAccum(): GroupAccum {
  return { tonnage: 0, durationSec: 0, directSets: 0, lastStrongMs: null };
}

export function buildMuscleRecoveryMap(
  sessions: readonly MuscleVolumeSession[],
  options: { weekOf: string; now: Date },
): MuscleRecoveryMap {
  const weekStart = mondayOfWeek(options.weekOf);
  const weekEnd = shiftDateKey(weekStart, 6);
  const nowMs = options.now.getTime();
  const groups = new Map<MuscleGroupKey, GroupAccum>();

  const touch = (key: MuscleGroupKey): GroupAccum => {
    const prev = groups.get(key);
    if (prev) return prev;
    const created = emptyAccum();
    groups.set(key, created);
    return created;
  };

  for (const session of sessions) {
    const inWeek = session.date >= weekStart && session.date <= weekEnd;
    const at = sessionInstantMs(session);
    for (const exercise of session.exercises) {
      const stimulus = exerciseStimulus(exercise);
      if (stimulus.tonnage <= 0 && stimulus.durationSec <= 0 && stimulus.directUnits <= 0) {
        continue;
      }
      const targets = exerciseTargets(exercise);
      if (targets.length === 0) continue;
      const primaries = targets.filter((target) => target.role === "primary");
      const secondaries = targets.filter((target) => target.role === "secondary");
      const primaryShare = primaries.length > 0 ? 1 / primaries.length : 0;
      const secondaryShare =
        secondaries.length > 0 ? SECONDARY_VOLUME_SHARE / secondaries.length : 0;

      for (const target of primaries) {
        const bucket = touch(target.group);
        if (stimulus.directUnits > 0 && (bucket.lastStrongMs == null || at >= bucket.lastStrongMs)) {
          bucket.lastStrongMs = at;
        }
        if (!inWeek) continue;
        bucket.tonnage += stimulus.tonnage * primaryShare;
        bucket.durationSec += stimulus.durationSec * primaryShare;
        bucket.directSets += stimulus.directUnits;
      }
      if (!inWeek) continue;
      for (const target of secondaries) {
        const bucket = touch(target.group);
        bucket.tonnage += stimulus.tonnage * secondaryShare;
        bucket.durationSec += stimulus.durationSec * secondaryShare;
      }
    }
  }

  const rows: MuscleRecoveryRow[] = [];
  for (const key of MUSCLE_GROUP_KEYS) {
    const bucket = groups.get(key);
    if (!bucket) continue;
    const hasWeek = bucket.tonnage > 0 || bucket.durationSec > 0 || bucket.directSets > 0;
    if (!hasWeek && bucket.lastStrongMs == null) continue;
    const hours =
      bucket.lastStrongMs == null ? null : Math.round(((nowMs - bucket.lastStrongMs) / 3_600_000) * 10) / 10;
    rows.push({
      key,
      label: muscleGroupLabel(key),
      tonnage: roundLoad(bucket.tonnage),
      durationSec: Math.round(bucket.durationSec),
      directSets: bucket.directSets,
      status: recoveryStatusForGroup(key, bucket.lastStrongMs, nowMs),
      hoursSinceStrong: hours != null && hours < 0 ? 0 : hours,
    });
  }

  const statusOrder: Record<MuscleRecoveryStatus, number> = {
    loaded: 0,
    recovering: 1,
    fresh: 2,
  };
  rows.sort(
    (a, b) =>
      statusOrder[a.status] - statusOrder[b.status] ||
      b.tonnage - a.tonnage ||
      b.durationSec - a.durationSec ||
      MUSCLE_GROUP_KEYS.indexOf(a.key) - MUSCLE_GROUP_KEYS.indexOf(b.key),
  );

  return { weekStart, weekEnd, rows };
}
