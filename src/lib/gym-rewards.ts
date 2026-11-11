/**
 * Зал в наградах (G1/G2).
 *
 * Сундук: завершённая тренировка с настоящим подходом даёт один зачёт
 * `quest_day` на календарный день — тот же счётчик, что еда и вода.
 * Это не возврат бонуса 3.6.13: настроение не считается, пустая сессия
 * не считается, второй зачёт за тот же день не создаётся.
 * Комбо-день (тренировка + белок в цели) занимает этот же единственный
 * зачёт зала, а не добавляет третий сверху еды.
 */

import { shiftDateKeyUtc, weekStartMonday } from "@/lib/streak-utils";
import { parseSetType } from "@/lib/workouts/set-meta";
import {
  computeExercisePrs,
  describePrBeat,
  exerciseProgressKey,
  formatPrSummary,
  mergeExercisePrs,
  type ExercisePrs,
  type SessionForPrCount,
} from "@/lib/workouts/prs";

/** Та же планка, что у празднования белка: норма — нижняя граница, не дефицит. */
export const PROTEIN_IN_GOAL_RATIO = 0.92;

export type GymRewardSet = {
  completed?: boolean | null;
  setType?: string | null;
  weightKg?: number | null;
  reps?: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
};

export type GymRewardSession = SessionForPrCount & {
  /** false — черновик. Не передали — считаем сессию завершённой. */
  ended?: boolean;
};

export type GymChestKind = "workout" | "combo";

export type GymChestSkipReason =
  | "future-day"
  | "no-qualifying-session"
  | "day-already-credited"
  | "session-already-credited";

export type GymChestDecision =
  | {
      action: "grant";
      kind: GymChestKind;
      sessionId: string;
      sourceKey: string;
    }
  | { action: "skip"; reason: GymChestSkipReason };

/** Подход, за который можно дать награду: не разминка и есть работа. */
export function setQualifiesForGymReward(set: GymRewardSet): boolean {
  if (set.completed === false) return false;
  if (parseSetType(set.setType) === "warmup") return false;
  const reps = Number(set.reps) || 0;
  const distance = Number(set.distanceKm) || 0;
  const duration = Number(set.durationSec) || 0;
  return reps > 0 || distance > 0 || duration > 0;
}

export function sessionQualifiesForGymReward(
  ended: boolean,
  sets: readonly GymRewardSet[],
): boolean {
  if (!ended) return false;
  return sets.some(setQualifiesForGymReward);
}

/** Белок дотянут до дневной цели. Выше цели тоже считается: цель — нижняя планка. */
export function isProteinWithinDailyGoal(protein: number, target: number): boolean {
  if (!(target > 0) || !(protein > 0)) return false;
  return protein + 1e-9 >= target * PROTEIN_IN_GOAL_RATIO;
}

export function isComboDay(input: {
  qualifyingWorkout: boolean;
  protein: number;
  proteinTarget: number;
}): boolean {
  return input.qualifyingWorkout && isProteinWithinDailyGoal(input.protein, input.proteinTarget);
}

/** Вид (зал или комбо) в ключ не входит: иначе гонка двух запросов дала бы два зачёта. */
export function gymChestSourceKey(date: string, sessionId: string): string {
  return `gym-chest:${date}:session:${sessionId}`;
}

export function gymChestDayCredited(date: string, keys: readonly string[]): boolean {
  const prefix = `gym-chest:${date}:session:`;
  return keys.some((key) => key.startsWith(prefix));
}

export function gymChestSessionCredited(sessionId: string, keys: readonly string[]): boolean {
  const suffix = `:session:${sessionId}`;
  return keys.some((key) => key.startsWith("gym-chest:") && key.endsWith(suffix));
}

/**
 * Один зачёт на день и на сессию.
 * Сессии передавать от старых к новым: зачёт получает первая ещё не использованная.
 */
export function decideGymChestGrant(input: {
  date: string;
  today?: string | null;
  sessions: readonly GymRewardSession[];
  protein: number;
  proteinTarget: number;
  existingSourceKeys: readonly string[];
}): GymChestDecision {
  if (input.today && input.date > input.today) {
    return { action: "skip", reason: "future-day" };
  }

  const qualifying = input.sessions.filter((session) =>
    sessionQualifiesForGymReward(
      session.ended !== false,
      session.exercises.flatMap((exercise) => exercise.sets),
    ),
  );
  if (qualifying.length === 0) {
    return { action: "skip", reason: "no-qualifying-session" };
  }
  if (gymChestDayCredited(input.date, input.existingSourceKeys)) {
    return { action: "skip", reason: "day-already-credited" };
  }

  const session = qualifying.find(
    (candidate) => !gymChestSessionCredited(candidate.id, input.existingSourceKeys),
  );
  if (!session) {
    return { action: "skip", reason: "session-already-credited" };
  }

  const kind: GymChestKind = isComboDay({
    qualifyingWorkout: true,
    protein: input.protein,
    proteinTarget: input.proteinTarget,
  })
    ? "combo"
    : "workout";
  return {
    action: "grant",
    kind,
    sessionId: session.id,
    sourceKey: gymChestSourceKey(input.date, session.id),
  };
}

export type GymRewardSummary = {
  gymSessionCount: number;
  gymPrBeats: number;
  gymBestWeekSessions: number;
  comboDates: string[];
  comboDayCount: number;
  comboStreakBest: number;
};

function sessionCreatedAt(session: GymRewardSession): number {
  const value = session.createdAt;
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function chronological(sessions: readonly GymRewardSession[]): GymRewardSession[] {
  return [...sessions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const delta = sessionCreatedAt(a) - sessionCreatedAt(b);
    if (delta !== 0) return delta;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function qualifyingSessions(sessions: readonly GymRewardSession[]): GymRewardSession[] {
  return chronological(sessions).filter((session) =>
    sessionQualifiesForGymReward(
      session.ended !== false,
      session.exercises.flatMap((exercise) => exercise.sets),
    ),
  );
}

/** Сколько раз упражнение побило уже записанный рекорд, не считая первой отметки. */
export function countBeatenGymRecords(sessions: readonly GymRewardSession[]): number {
  const bestByExercise = new Map<string, ExercisePrs>();
  let beats = 0;

  for (const session of qualifyingSessions(sessions)) {
    const grouped = new Map<string, { name: string; kind?: string | null; sets: GymRewardSet[] }>();
    for (const exercise of session.exercises) {
      const key = exerciseProgressKey(exercise);
      if (!key) continue;
      const prev = grouped.get(key);
      if (!prev) {
        grouped.set(key, { name: exercise.name, kind: exercise.kind, sets: [...exercise.sets] });
      } else {
        prev.sets.push(...exercise.sets);
      }
    }

    for (const [key, exercise] of grouped) {
      const after = computeExercisePrs(exercise.kind, exercise.sets);
      if (!formatPrSummary(after)) continue;
      const before = bestByExercise.get(key) ?? null;
      if (before && describePrBeat(before, after)) beats += 1;
      const merged = before ? mergeExercisePrs([before, after]) : after;
      if (merged) bestByExercise.set(key, merged);
    }
  }

  return beats;
}

export function bestWeekSessionCount(dates: readonly string[]): number {
  const counts = new Map<string, number>();
  let best = 0;
  for (const date of dates) {
    const week = weekStartMonday(date);
    const next = (counts.get(week) ?? 0) + 1;
    counts.set(week, next);
    if (next > best) best = next;
  }
  return best;
}

export function longestDateStreak(dates: readonly string[]): number {
  const unique = [...new Set(dates)].sort();
  let best = 0;
  let run = 0;
  let prev = "";
  for (const date of unique) {
    run = prev && shiftDateKeyUtc(prev, 1) === date ? run + 1 : 1;
    if (run > best) best = run;
    prev = date;
  }
  return best;
}

export function summarizeGymRewards(input: {
  sessions: readonly GymRewardSession[];
  proteinByDate: Readonly<Record<string, number>>;
  proteinTargetByDate: Readonly<Record<string, number>>;
}): GymRewardSummary {
  const sessions = qualifyingSessions(input.sessions);
  const byDate = new Map<string, GymRewardSession[]>();
  for (const session of sessions) {
    const list = byDate.get(session.date) ?? [];
    list.push(session);
    byDate.set(session.date, list);
  }

  const comboDates: string[] = [];
  for (const [date] of byDate) {
    if (
      isComboDay({
        qualifyingWorkout: true,
        protein: input.proteinByDate[date] ?? 0,
        proteinTarget: input.proteinTargetByDate[date] ?? 0,
      })
    ) {
      comboDates.push(date);
    }
  }
  comboDates.sort();

  return {
    gymSessionCount: sessions.length,
    gymPrBeats: countBeatenGymRecords(sessions),
    gymBestWeekSessions: bestWeekSessionCount(sessions.map((session) => session.date)),
    comboDates,
    comboDayCount: comboDates.length,
    comboStreakBest: longestDateStreak(comboDates),
  };
}
