/**
 * Pure layout rules for the active-workout set table (variant 3).
 * Autofill and progression pace stay in their own modules — this only
 * decides which rows, labels, and expansion the screen shows.
 */

import {
  durationSecToMinutesInput,
  formatDistanceKm,
  formatDurationMinutes,
} from "@/lib/workouts/cardio";
import { fieldsForKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { formatSuggestedKg } from "@/lib/workouts/suggested-load";

export type SetTableColumn = "index" | "previous" | "kg" | "reps" | "km" | "time" | "check";

export const SET_TABLE_COLUMN_LABEL: Record<SetTableColumn, string> = {
  index: "№",
  previous: "Прошлый",
  kg: "Кг",
  reps: "Повт.",
  km: "Км",
  time: "Мин",
  check: "",
};

export type HistorySetLike = {
  weightKg: number | null;
  reps: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
};

export type PersistedSetLike = {
  id: string;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
  setType: string;
  completed: boolean;
  rpe?: number | null;
  pendingLocal?: boolean;
};

export type TableDraftLike = {
  kg: string;
  reps: string;
  km: string;
  time: string;
  setType: string;
  rpe: string;
};

export type SetTableRowModel = {
  key: string;
  number: number;
  source: "set" | "draft";
  setId: string | null;
  /** Local «+ Подход» row, not yet posted. */
  extraId: string | null;
  previousLabel: string;
  previousKg: number | null;
  kg: string;
  reps: string;
  km: string;
  time: string;
  rpe: string;
  completed: boolean;
  pendingLocal: boolean;
  setType: string;
  /** ↑ when this kg is a step up (or less assistance) vs the same-index last time. */
  progressionUp: boolean;
};

export type ExtraDraftLike = TableDraftLike & { id: string };

const EMPTY_DRAFT: TableDraftLike = {
  kg: "",
  reps: "",
  km: "",
  time: "",
  setType: "working",
  rpe: "",
};

export function setTableColumns(kind: ExerciseKind): SetTableColumn[] {
  const spec = fieldsForKind(kind);
  const cols: SetTableColumn[] = ["index", "previous"];
  if (spec.usesDistance) cols.push("km");
  if (spec.usesDuration) cols.push("time");
  if (spec.usesWeight) cols.push("kg");
  if (spec.usesReps) cols.push("reps");
  cols.push("check");
  return cols;
}

export function setTableGridTemplate(columns: readonly SetTableColumn[]): string {
  return columns
    .map((col) => {
      if (col === "index" || col === "check") return "44px";
      if (col === "previous") return "minmax(72px, 1.1fr)";
      return "minmax(68px, 1fr)";
    })
    .join(" ");
}

export function inputModeForColumn(col: "kg" | "reps" | "km" | "time"): "decimal" | "numeric" {
  return col === "reps" ? "numeric" : "decimal";
}

export function parseTableNumber(raw: string): number | null {
  const n = Number(raw.trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Same-index last time, as weight×reps (or cardio / duration text). */
export function formatPreviousSetLabel(
  set: HistorySetLike | null | undefined,
  kind: ExerciseKind,
): string {
  if (!set) return "—";
  const spec = fieldsForKind(kind);
  if (kind === "cardio") {
    const d =
      set.distanceKm != null && set.distanceKm > 0 ? `${formatDistanceKm(set.distanceKm)} км` : null;
    const t =
      set.durationSec != null && set.durationSec > 0
        ? formatDurationMinutes(set.durationSec)
        : null;
    return [d, t].filter(Boolean).join(" / ") || "—";
  }
  if (kind === "duration") {
    return set.durationSec != null && set.durationSec > 0
      ? formatDurationMinutes(set.durationSec)
      : "—";
  }
  if (kind === "bodyweight") {
    return set.reps != null ? `${set.reps}` : "—";
  }
  if (spec.usesWeight && spec.usesReps) {
    const prefix = kind === "assisted" ? "−" : kind === "weighted_bw" ? "+" : "";
    return `${prefix}${set.weightKg ?? 0}×${set.reps ?? 0}`;
  }
  return "—";
}

/** «В прошлый раз 60 × 8» — фраза рядом с полем подхода. */
export function formatLastTimePhrase(
  set: HistorySetLike | null | undefined,
  kind: ExerciseKind,
): string | null {
  const label = formatPreviousSetLabel(set, kind);
  if (!label || label === "—") return null;
  return `В прошлый раз ${label.replace("×", " × ")}`;
}

/** ↑ when the prefilled kg is a progression step versus that row's last time. */
export function isProgressionUp(
  kind: ExerciseKind,
  currentKg: number | null,
  previousKg: number | null,
): boolean {
  if (currentKg == null || previousKg == null) return false;
  if (!Number.isFinite(currentKg) || !Number.isFinite(previousKg)) return false;
  if (kind === "assisted") return currentKg < previousKg - 0.001;
  if (kind === "strength" || kind === "weighted_bw") return currentKg > previousKg + 0.001;
  return false;
}

export function exerciseSetCounts(
  sets: ReadonlyArray<{ completed: boolean }>,
  lastSetCount: number,
): { done: number; total: number; label: string } {
  const done = sets.reduce((n, s) => n + (s.completed ? 1 : 0), 0);
  const persisted = sets.length;
  const total =
    persisted === 0 && lastSetCount <= 0
      ? 1
      : Math.max(lastSetCount, persisted, done, 1);
  return { done, total, label: `${done}/${total}` };
}

/** «80 → 82.5» when the target steps up; a single number when they match. */
export function formatBestTarget(bestKg: number | null, targetKg: number | null): string | null {
  const best =
    bestKg != null && Number.isFinite(bestKg) && bestKg >= 0 ? formatSuggestedKg(bestKg) : null;
  const target =
    targetKg != null && Number.isFinite(targetKg) && targetKg >= 0
      ? formatSuggestedKg(targetKg)
      : null;
  if (best && target && best !== target) return `${best} → ${target}`;
  if (target) return best ? best : `цель ${target}`;
  if (best) return best;
  return null;
}

function minutesField(durationSec: number | null | undefined): string {
  if (durationSec == null || !(durationSec > 0)) return "";
  return durationSecToMinutesInput(durationSec);
}

function kmField(distanceKm: number | null | undefined): string {
  if (distanceKm == null || !(distanceKm > 0)) return "";
  return String(distanceKm);
}

function rowFromValues(
  partial: Omit<SetTableRowModel, "previousLabel" | "previousKg" | "progressionUp" | "number"> & {
    number: number;
  },
  kind: ExerciseKind,
  lastSets: readonly HistorySetLike[] | null | undefined,
): SetTableRowModel {
  const prev = lastSets?.[partial.number - 1] ?? null;
  const currentKg = parseTableNumber(partial.kg);
  return {
    ...partial,
    previousLabel: formatPreviousSetLabel(prev, kind),
    previousKg: prev?.weightKg ?? null,
    progressionUp: isProgressionUp(kind, currentKg, prev?.weightKg ?? null),
  };
}

/**
 * Persisted sets, then one autofill draft when nothing is left incomplete,
 * then local «+ Подход» rows.
 */
export function buildSetTableRows(input: {
  kind: ExerciseKind;
  sets: readonly PersistedSetLike[];
  lastSets?: readonly HistorySetLike[] | null;
  draft?: TableDraftLike | null;
  extraDrafts?: readonly ExtraDraftLike[];
}): SetTableRowModel[] {
  const lastSets = input.lastSets ?? [];
  const rows: SetTableRowModel[] = input.sets.map((set, index) =>
    rowFromValues(
      {
        key: set.id,
        number: index + 1,
        source: "set",
        setId: set.id,
        extraId: null,
        kg: set.weightKg != null ? String(set.weightKg) : "",
        reps: set.reps != null ? String(set.reps) : "",
        km: kmField(set.distanceKm),
        time: minutesField(set.durationSec),
        rpe: set.rpe != null ? String(set.rpe) : "",
        completed: set.completed,
        pendingLocal: Boolean(set.pendingLocal),
        setType: set.setType || "working",
      },
      input.kind,
      lastSets,
    ),
  );

  const hasIncomplete = input.sets.some((s) => !s.completed);
  const drafts: { key: string; extraId: string | null; draft: TableDraftLike }[] = [];
  if (!hasIncomplete) {
    drafts.push({
      key: "draft",
      extraId: null,
      draft: input.draft ?? EMPTY_DRAFT,
    });
  }
  for (const extra of input.extraDrafts ?? []) {
    drafts.push({ key: `extra:${extra.id}`, extraId: extra.id, draft: extra });
  }

  drafts.forEach((item, offset) => {
    const number = input.sets.length + offset + 1;
    rows.push(
      rowFromValues(
        {
          key: item.key,
          number,
          source: "draft",
          setId: null,
          extraId: item.extraId,
          kg: item.draft.kg,
          reps: item.draft.reps,
          km: item.draft.km,
          time: item.draft.time,
          rpe: item.draft.rpe,
          completed: false,
          pendingLocal: false,
          setType: item.draft.setType || "working",
        },
        input.kind,
        lastSets,
      ),
    );
  });

  return rows;
}

export type ExerciseExpandInput = {
  id: string;
  completed: number;
  incomplete: number;
  lastSetCount: number;
};

export function isExerciseUnfinished(ex: ExerciseExpandInput): boolean {
  if (ex.incomplete > 0) return true;
  if (ex.lastSetCount > 0) return ex.completed < ex.lastSetCount;
  return ex.completed === 0;
}

/** First unfinished exercise, otherwise the first row. */
export function pickInitialExpandedId(list: readonly ExerciseExpandInput[]): string | null {
  return list.find(isExerciseUnfinished)?.id ?? list[0]?.id ?? null;
}

/** Only one row stays open: opening another closes the previous. */
export function toggleExpanded(current: string | null, id: string): string | null {
  return current === id ? null : id;
}

export function nextUnfinishedExerciseId(
  list: readonly ExerciseExpandInput[],
  finishedId: string,
): string | null {
  const idx = list.findIndex((ex) => ex.id === finishedId);
  const start = idx < 0 ? 0 : idx + 1;
  const order = [...list.slice(start), ...list.slice(0, Math.max(idx, 0))];
  for (const ex of order) {
    if (ex.id === finishedId) continue;
    if (isExerciseUnfinished(ex)) return ex.id;
  }
  return null;
}

/**
 * Advance after the set that meets the previous-session count,
 * and only when no incomplete or extra «+ Подход» rows remain.
 * No history → stay put so a free exercise can keep adding sets.
 */
export function shouldAutoExpandNext(input: {
  loggedNumber: number;
  lastSetCount: number;
  incompleteRemaining: number;
  extraDraftsRemaining: number;
}): boolean {
  if (input.incompleteRemaining > 0 || input.extraDraftsRemaining > 0) return false;
  if (input.lastSetCount <= 0) return false;
  return input.loggedNumber >= input.lastSetCount;
}
