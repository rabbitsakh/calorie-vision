"use client";

import { useCallback, useEffect, useState } from "react";
import { fieldsForKind, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import {
  durationSecToMinutesInput,
  formatDistanceKm,
  formatDurationMinutes,
  parseDistanceKm,
  parseDurationToSec,
} from "@/lib/workouts/cardio";
import {
  SET_TYPES,
  SET_TYPE_LABELS,
  SET_TYPE_SHORT,
  type SetType,
} from "@/lib/workouts/set-meta";
import { formatSuggestedKg } from "@/lib/workouts/suggested-load";

export type InlineSet = {
  id: string;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
  setType: SetType;
  completed: boolean;
  rpe: number | null;
  load: number;
};

type Props = {
  set: InlineSet;
  kind: ExerciseKind;
  index: number;
  suggestedKg?: number | null;
  busy?: boolean;
  onToggleComplete: () => void;
  onCycleType: () => void;
  onSave: (patch: {
    weightKg?: number | null;
    reps?: number | null;
    distanceKm?: number | null;
    durationSec?: number | null;
    rpe?: number | null;
  }) => Promise<void>;
  onDelete: () => void;
};

function nextType(current: SetType): SetType {
  const idx = SET_TYPES.indexOf(current);
  return SET_TYPES[(idx + 1) % SET_TYPES.length]!;
}

export function WorkoutInlineSetRow({
  set,
  kind,
  index,
  suggestedKg,
  busy,
  onToggleComplete,
  onCycleType,
  onSave,
  onDelete,
}: Props) {
  const spec = fieldsForKind(kind);
  const [editing, setEditing] = useState(false);
  const [kg, setKg] = useState("");
  const [reps, setReps] = useState("");
  const [km, setKm] = useState("");
  const [time, setTime] = useState("");
  const [rpe, setRpe] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) return;
    setKg(set.weightKg != null ? String(set.weightKg) : "");
    setReps(set.reps != null ? String(set.reps) : "");
    setKm(set.distanceKm != null && set.distanceKm > 0 ? String(set.distanceKm) : "");
    setTime(
      set.durationSec != null && set.durationSec > 0
        ? durationSecToMinutesInput(set.durationSec)
        : "",
    );
    setRpe(set.rpe != null ? String(set.rpe) : "");
  }, [set, editing]);

  const summary = (() => {
    if (kind === "cardio") {
      const d =
        set.distanceKm != null && set.distanceKm > 0
          ? `${formatDistanceKm(set.distanceKm)} км`
          : null;
      const t =
        set.durationSec != null && set.durationSec > 0
          ? formatDurationMinutes(set.durationSec)
          : null;
      return [d, t].filter(Boolean).join(" · ") || "—";
    }
    if (kind === "duration") {
      return set.durationSec != null && set.durationSec > 0
        ? formatDurationMinutes(set.durationSec)
        : "—";
    }
    if (kind === "bodyweight") return `${set.reps ?? 0} повт`;
    const prefix = kind === "assisted" ? "−" : kind === "weighted_bw" ? "+" : "";
    return `${prefix}${set.weightKg ?? 0} кг × ${set.reps ?? 0}`;
  })();

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const patch: Parameters<Props["onSave"]>[0] = {};
      if (spec.usesWeight) {
        const n = Number(kg.replace(",", "."));
        if (!Number.isFinite(n) || n < 0) return;
        patch.weightKg = n;
      }
      if (spec.usesReps) {
        const n = Number(reps);
        if (!Number.isFinite(n) || n <= 0) return;
        patch.reps = Math.round(n);
      }
      if (spec.usesDistance) {
        const n = parseDistanceKm(km || "0");
        if (n === null) return;
        patch.distanceKm = n;
      }
      if (spec.usesDuration) {
        const n = parseDurationToSec(time);
        if (n === null) return;
        patch.durationSec = n;
      }
      if (rpe.trim()) {
        const n = Number(rpe.replace(",", "."));
        patch.rpe = Number.isFinite(n) ? n : null;
      } else {
        patch.rpe = null;
      }
      await onSave(patch);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [kg, reps, km, time, rpe, spec, onSave]);

  return (
    <li
      className={`rounded-lg px-2 py-2 ${
        set.completed ? "bg-slate-50" : "bg-amber-50/80"
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          title={set.completed ? "Снять ✓" : "Отметить выполненным"}
          disabled={busy}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm font-bold ${
            set.completed
              ? "border-teal-600 bg-teal-600 text-white"
              : "border-slate-300 bg-white text-slate-400"
          }`}
          onClick={onToggleComplete}
        >
          ✓
        </button>
        <button
          type="button"
          title={`${SET_TYPE_LABELS[set.setType]} — сменить тип`}
          className="shrink-0 rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700"
          onClick={onCycleType}
        >
          {SET_TYPE_SHORT[set.setType]}
        </button>
        <button
          type="button"
          className={`min-w-0 flex-1 text-left tabular-nums ${
            set.completed ? "text-slate-800" : "text-slate-500"
          }`}
          onClick={() => setEditing((v) => !v)}
        >
          <span className="text-slate-400">№{index + 1} · </span>
          {summary}
          {set.load > 0 ? <span className="text-slate-400"> ({Math.round(set.load)})</span> : null}
          {set.rpe != null ? (
            <span className="ml-1 text-xs text-slate-400">RPE {set.rpe}</span>
          ) : null}
        </button>
        <button
          type="button"
          className="shrink-0 text-xs text-slate-400 hover:text-red-600"
          onClick={onDelete}
        >
          ✕
        </button>
      </div>

      {editing ? (
        <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-slate-200/80 pt-2">
          {spec.usesDistance ? (
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Км
              <input
                inputMode="decimal"
                className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
            </label>
          ) : null}
          {spec.usesDuration ? (
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Мин
              <input
                inputMode="decimal"
                className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          ) : null}
          {spec.usesWeight ? (
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Кг
              <input
                inputMode="decimal"
                className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
              />
            </label>
          ) : null}
          {spec.usesReps ? (
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Повт
              <input
                inputMode="numeric"
                className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-xs text-slate-500" title="RPE 1–10">
            RPE
            <input
              inputMode="decimal"
              className="w-14 rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
              value={rpe}
              onChange={(e) => setRpe(e.target.value)}
              placeholder="8"
            />
          </label>
          {suggestedKg != null && spec.usesWeight ? (
            <button
              type="button"
              className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-2 text-xs font-semibold text-teal-900"
              onClick={() => setKg(formatSuggestedKg(suggestedKg))}
            >
              → {formatSuggestedKg(suggestedKg)} кг
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => void save()}
          >
            Ок
          </button>
          <button
            type="button"
            className="rounded-lg px-2 py-2 text-sm text-slate-500"
            onClick={() => setEditing(false)}
          >
            Отмена
          </button>
        </div>
      ) : null}
    </li>
  );
}

export { nextType };
