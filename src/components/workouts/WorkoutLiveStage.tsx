"use client";

import {
  BLOCK_MODE_LABELS,
  CIRCUIT_ROUND_REST_SEC,
  REST_PAUSE_SEC,
  type BlockMode,
} from "@/lib/workouts/block-mode";
import { fieldsForKind, kindUsesSetTypes, type ExerciseKind } from "@/lib/workouts/exercise-kind";
import { type ProgressionAdvice } from "@/lib/workouts/progression";
import { formatSuggestedKg } from "@/lib/workouts/suggested-load";
import {
  SET_TYPE_SHORT,
  type SetType,
} from "@/lib/workouts/set-meta";

export type LiveSet = {
  id: string;
  weightKg: number | null;
  reps: number | null;
  distanceKm?: number | null;
  durationSec?: number | null;
  setType: SetType;
  completed: boolean;
  rpe: number | null;
};

export type LiveExercise = {
  id: string;
  name: string;
  kind: ExerciseKind;
  supersetGroup?: string | null;
  blockMode?: BlockMode;
  circuitRounds?: number | null;
  sets: LiveSet[];
};

type Props = {
  elapsedLabel: string;
  clockStatus: "idle" | "running" | "paused" | "finished";
  exercises: LiveExercise[];
  focusExerciseId: string | null;
  restEndsAt: number | null;
  restLeft: number;
  advice: ProgressionAdvice | null;
  suggestedKg: number | null;
  draftKg: string;
  draftReps: string;
  draftKm: string;
  draftTime: string;
  draftSetType: SetType;
  draftRpe: string;
  circuitRound: number;
  prToast: string | null;
  onDraftKg: (v: string) => void;
  onDraftReps: (v: string) => void;
  onDraftKm: (v: string) => void;
  onDraftTime: (v: string) => void;
  onDraftRpe: (v: string) => void;
  onCycleSetType: () => void;
  onBumpKg: (delta: number) => void;
  onApplySuggested: () => void;
  onCompleteCurrent: () => void;
  onAddAndComplete: () => void;
  onSkipRest: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onExitStage: () => void;
  onRestPause: () => void;
  onRememberRest: () => void;
  busy?: boolean;
};

function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Full-screen one-hand logger for the current exercise / circuit group. */
export function WorkoutLiveStage({
  elapsedLabel,
  clockStatus,
  exercises,
  focusExerciseId,
  restEndsAt,
  restLeft,
  advice,
  suggestedKg,
  draftKg,
  draftReps,
  draftKm,
  draftTime,
  draftSetType,
  draftRpe,
  circuitRound,
  prToast,
  onDraftKg,
  onDraftReps,
  onDraftKm,
  onDraftTime,
  onDraftRpe,
  onCycleSetType,
  onBumpKg,
  onApplySuggested,
  onCompleteCurrent,
  onAddAndComplete,
  onSkipRest,
  onPrev,
  onNext,
  onPause,
  onResume,
  onFinish,
  onExitStage,
  onRestPause,
  onRememberRest,
  busy,
}: Props) {
  const focus =
    exercises.find((e) => e.id === focusExerciseId) ?? exercises[0] ?? null;
  if (!focus) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 px-4 py-6 text-white">
        <p className="text-lg">Нет упражнений</p>
        <button type="button" className="mt-4 text-teal-300" onClick={onExitStage}>
          Назад
        </button>
      </div>
    );
  }

  const group = focus.supersetGroup
    ? exercises.filter((e) => e.supersetGroup === focus.supersetGroup)
    : [focus];
  const mode: BlockMode = focus.blockMode ?? "normal";
  const targetRounds = focus.circuitRounds ?? 3;
  const currentSet =
    focus.sets.find((s) => !s.completed) ?? focus.sets[focus.sets.length - 1] ?? null;
  const doneCount = focus.sets.filter((s) => s.completed).length;
  const spec = fieldsForKind(focus.kind);
  const allDone = exercises.every((e) => e.sets.length > 0 && e.sets.every((s) => s.completed));
  const showSetMeta = kindUsesSetTypes(focus.kind);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="text-sm text-slate-300" onClick={onExitStage}>
          ← Список
        </button>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{elapsedLabel}</p>
        <div className="flex gap-2">
          {clockStatus === "running" ? (
            <button type="button" className="text-sm text-amber-300" onClick={onPause}>
              Пауза
            </button>
          ) : null}
          {clockStatus === "paused" ? (
            <button type="button" className="text-sm text-teal-300" onClick={onResume}>
              Дальше
            </button>
          ) : null}
        </div>
      </div>

      {prToast ? (
        <div className="mx-4 rounded-xl bg-amber-400 px-3 py-2 text-center text-sm font-bold text-slate-950">
          {prToast}
        </div>
      ) : null}

      {restEndsAt ? (
        <div className="mx-4 rounded-2xl border border-teal-400/40 bg-teal-950/80 px-4 py-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-teal-300">Отдых</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums">{formatRest(restLeft)}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold"
              onClick={onSkipRest}
            >
              Пропустить
            </button>
            <button
              type="button"
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold"
              onClick={onRememberRest}
            >
              Запомнить для упр.
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="text-slate-400" onClick={onPrev} disabled={busy}>
            ←
          </button>
          <div className="min-w-0 text-center">
            {focus.supersetGroup ? (
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
                {mode === "circuit" ? "Круг" : "Суперсет"} {focus.supersetGroup}
                {mode === "circuit" ? ` · ${circuitRound}/${targetRounds}` : ""}
              </p>
            ) : mode !== "normal" ? (
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-400">
                {BLOCK_MODE_LABELS[mode]}
              </p>
            ) : null}
            <h2 className="truncate text-2xl font-semibold leading-tight">{focus.name}</h2>
            <p className="mt-1 text-sm text-slate-400">
              {doneCount}/{focus.sets.length || "—"} подходов
              {showSetMeta && currentSet ? ` · ${SET_TYPE_SHORT[currentSet.setType]}` : ""}
            </p>
          </div>
          <button type="button" className="text-slate-400" onClick={onNext} disabled={busy}>
            →
          </button>
        </div>

        {group.length > 1 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {group.map((g) => (
              <span
                key={g.id}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  g.id === focus.id ? "bg-teal-600 text-white" : "bg-white/10 text-slate-300"
                }`}
              >
                {g.name}
              </span>
            ))}
          </div>
        ) : null}

        {advice ? (
          <p
            className={`mt-3 rounded-xl px-3 py-2 text-center text-sm ${
              advice.kind === "stall"
                ? "bg-amber-500/20 text-amber-100"
                : "bg-white/5 text-slate-200"
            }`}
          >
            <span className="font-semibold">{advice.title}.</span> {advice.detail}
          </p>
        ) : null}

        {showSetMeta ? (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
              onClick={onCycleSetType}
            >
              {SET_TYPE_SHORT[draftSetType]}
            </button>
            <label className="flex items-center gap-1.5 text-xs text-slate-400">
              RPE
              <input
                inputMode="decimal"
                className="w-12 rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-center text-sm font-semibold text-white outline-none focus:border-teal-400"
                value={draftRpe}
                onChange={(e) => onDraftRpe(e.target.value)}
                placeholder="—"
              />
            </label>
          </div>
        ) : null}

        {spec.usesWeight || spec.usesReps || spec.usesDistance || spec.usesDuration ? (
          <div className="mt-6 flex flex-col items-center gap-4">
            {spec.usesWeight ? (
              <div className="flex items-end gap-3">
                <button
                  type="button"
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xl font-bold"
                  onClick={() => onBumpKg(-2.5)}
                >
                  −
                </button>
                <label className="flex flex-col items-center gap-1">
                  <span className="text-xs uppercase tracking-wide text-slate-400">кг</span>
                  <input
                    inputMode="decimal"
                    className="w-28 rounded-2xl border border-white/20 bg-white/5 px-3 py-3 text-center text-3xl font-semibold tabular-nums text-white outline-none focus:border-teal-400"
                    value={draftKg}
                    onChange={(e) => onDraftKg(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xl font-bold"
                  onClick={() => onBumpKg(2.5)}
                >
                  +
                </button>
              </div>
            ) : null}
            {spec.usesReps ? (
              <label className="flex flex-col items-center gap-1">
                <span className="text-xs uppercase tracking-wide text-slate-400">повт</span>
                <input
                  inputMode="numeric"
                  className="w-24 rounded-2xl border border-white/20 bg-white/5 px-3 py-3 text-center text-3xl font-semibold tabular-nums text-white outline-none focus:border-teal-400"
                  value={draftReps}
                  onChange={(e) => onDraftReps(e.target.value)}
                />
              </label>
            ) : null}
            {spec.usesDistance ? (
              <label className="flex flex-col items-center gap-1">
                <span className="text-xs uppercase tracking-wide text-slate-400">км</span>
                <input
                  inputMode="decimal"
                  className="w-28 rounded-2xl border border-white/20 bg-white/5 px-3 py-3 text-center text-3xl font-semibold tabular-nums text-white outline-none focus:border-teal-400"
                  value={draftKm}
                  onChange={(e) => onDraftKm(e.target.value)}
                />
              </label>
            ) : null}
            {spec.usesDuration ? (
              <label className="flex flex-col items-center gap-1">
                <span className="text-xs uppercase tracking-wide text-slate-400">мин</span>
                <input
                  inputMode="decimal"
                  className="w-28 rounded-2xl border border-white/20 bg-white/5 px-3 py-3 text-center text-3xl font-semibold tabular-nums text-white outline-none focus:border-teal-400"
                  value={draftTime}
                  onChange={(e) => onDraftTime(e.target.value)}
                />
              </label>
            ) : null}
            {suggestedKg != null && spec.usesWeight ? (
              <button
                type="button"
                className="text-sm font-semibold text-teal-300"
                onClick={onApplySuggested}
              >
                Взять {formatSuggestedKg(suggestedKg)} кг
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-8 text-center text-slate-400">Отметьте подход ✓</p>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-8">
          {currentSet && !currentSet.completed ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-2xl bg-teal-500 py-4 text-xl font-bold text-slate-950 disabled:opacity-40"
              onClick={onCompleteCurrent}
            >
              ✓ Готово
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              className="rounded-2xl bg-teal-500 py-4 text-xl font-bold text-slate-950 disabled:opacity-40"
              onClick={onAddAndComplete}
            >
              + Подход и ✓
            </button>
          )}
          <div className="flex gap-2">
            {focus.kind !== "cardio" &&
            (mode === "rest_pause" || focus.kind === "strength") ? (
              <button
                type="button"
                disabled={busy}
                className="flex-1 rounded-2xl border border-white/20 py-3 text-sm font-semibold"
                onClick={onRestPause}
              >
                Rest-pause {REST_PAUSE_SEC}с
              </button>
            ) : null}
            {mode === "circuit" ? (
              <button
                type="button"
                disabled={busy}
                className="flex-1 rounded-2xl border border-white/20 py-3 text-sm font-semibold"
                onClick={onSkipRest}
                title={`${CIRCUIT_ROUND_REST_SEC}с между кругами`}
              >
                Круг {circuitRound}/{targetRounds}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy || !allDone}
              className="flex-1 rounded-2xl bg-white py-3 text-sm font-bold text-slate-950 disabled:opacity-30"
              onClick={onFinish}
            >
              Завершить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
