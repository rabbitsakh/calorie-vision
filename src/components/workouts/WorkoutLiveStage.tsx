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
import type { LiveGoalChrome } from "@/lib/workouts/live-goal-chrome";
import {
  EFFORT_FIELD_ARIA,
  EFFORT_FIELD_LABEL,
  SET_TYPE_SHORT,
  type SetType,
} from "@/lib/workouts/set-meta";
import { exerciseDoneShare, nextExerciseLine } from "@/lib/workouts/live-stage-lines";
import { GymCollectionWear } from "@/components/workouts/GymCollectionWear";
import { LeverRecoveryStrip } from "@/components/workouts/LeverRecoveryStrip";

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
  /** G2 — max / lever / target chrome above the logger. */
  liveGoal?: LiveGoalChrome | null;
  draftKg: string;
  draftReps: string;
  draftKm: string;
  draftTime: string;
  draftSetType: SetType;
  draftRpe: string;
  /** Inline validation near draft fields (e.g. empty cardio minutes). */
  draftError?: string | null;
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

function setChipLabel(set: LiveSet, kind: ExerciseKind): string {
  const spec = fieldsForKind(kind);
  if (spec.usesWeight && set.weightKg != null && set.reps != null) {
    return `${formatSuggestedKg(set.weightKg)}×${set.reps}`;
  }
  if (spec.usesReps && set.reps != null) return `×${set.reps}`;
  if (spec.usesDuration && set.durationSec != null) return `${Math.round(set.durationSec / 60)} мин`;
  if (spec.usesDistance && set.distanceKm != null) return `${set.distanceKm} км`;
  return "—";
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
  liveGoal = null,
  draftKg,
  draftReps,
  draftKm,
  draftTime,
  draftSetType,
  draftRpe,
  draftError,
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
      <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)] px-4 py-6 text-[var(--foreground)]">
        <p className="text-lg">Нет упражнений</p>
        <button type="button" className="mt-4 text-[var(--accent)]" onClick={onExitStage}>
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
  const focusIndex = Math.max(0, exercises.findIndex((e) => e.id === focus.id));
  const currentSetIndex = currentSet ? focus.sets.indexOf(currentSet) : -1;
  const nextLine = nextExerciseLine(exercises, focus.id);
  const live = clockStatus === "running" || clockStatus === "paused";
  const bumpReps = (delta: number) => {
    const n = Number.parseInt(draftReps, 10);
    const base = Number.isFinite(n) ? n : 0;
    onDraftReps(String(Math.max(0, base + delta)));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" className="text-sm text-[var(--muted-strong)]" onClick={onExitStage}>
          ← Список
        </button>
        <p className="font-display text-3xl font-bold tabular-nums tracking-tight">{elapsedLabel}</p>
        <div className="flex gap-2">
          {clockStatus === "running" ? (
            <button type="button" className="text-sm font-semibold text-[var(--accent-streak)]" onClick={onPause}>
              Пауза
            </button>
          ) : null}
          {clockStatus === "paused" ? (
            <button type="button" className="text-sm font-semibold text-[var(--accent)]" onClick={onResume}>
              Дальше
            </button>
          ) : null}
        </div>
      </div>

      {/* R7 + Q: wear and armed recovery on live stage */}
      <div className="flex flex-col gap-1.5 px-4 pb-1">
        <GymCollectionWear tone="stage" />
        <LeverRecoveryStrip />
      </div>

      {live ? (
        <p
          className="mx-4 mb-1 rounded-[14px] border border-[rgba(217,119,6,0.2)] bg-[var(--accent-streak-soft)] px-3 py-2 text-[12.5px] font-bold text-[#92510a]"
          data-testid="gym-quiet-banner"
        >
          Режим зала: еда и напоминания на паузе до конца тренировки
        </p>
      ) : null}

      {exercises.length > 1 ? (
        <div className="flex gap-1 px-4 pb-1" aria-label={`Упражнение ${focusIndex + 1} из ${exercises.length}`}>
          {exercises.map((ex) => (
            <span key={ex.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e4e0d7]">
              <span
                className="block h-full rounded-full bg-[var(--accent)]"
                style={{ width: `${Math.round(exerciseDoneShare(ex) * 100)}%` }}
              />
            </span>
          ))}
        </div>
      ) : null}

      {prToast ? (
        <div className="mx-4 rounded-xl bg-[var(--accent-streak)] px-3 py-2 text-center text-sm font-bold text-white">
          {prToast}
        </div>
      ) : null}

      {restEndsAt ? (
        <div className="mx-4 rounded-2xl border border-[var(--border-quiet)] bg-[var(--card)] px-4 py-5 text-center shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Отдых</p>
          <p className="mt-1 font-display text-5xl font-bold tabular-nums">{formatRest(restLeft)}</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-full bg-[var(--surface-mist)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)]"
              onClick={onSkipRest}
            >
              Пропустить
            </button>
            <button
              type="button"
              className="rounded-full bg-[var(--surface-mist)] px-4 py-2 text-sm font-semibold text-[var(--accent-ink)]"
              onClick={onRememberRest}
            >
              Запомнить для упр.
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" className="text-[var(--muted)]" onClick={onPrev} disabled={busy}>
            ←
          </button>
          <div className="min-w-0 text-center">
            {focus.supersetGroup ? (
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                {mode === "circuit" ? "Круг" : "Суперсет"} {focus.supersetGroup}
                {mode === "circuit" ? ` · ${circuitRound}/${targetRounds}` : ""}
              </p>
            ) : mode !== "normal" ? (
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                {BLOCK_MODE_LABELS[mode]}
              </p>
            ) : null}
            {exercises.length > 1 && !focus.supersetGroup && mode === "normal" ? (
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
                Упражнение {focusIndex + 1} из {exercises.length}
              </p>
            ) : null}
            <h2 className="font-display truncate text-[1.65rem] font-bold leading-tight">{focus.name}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Подход {Math.min(doneCount + 1, focus.sets.length || 1)}/
              {focus.sets.length || "—"}
              {showSetMeta && currentSet ? ` · ${SET_TYPE_SHORT[currentSet.setType]}` : ""}
            </p>
          </div>
          <button type="button" className="text-[var(--muted)]" onClick={onNext} disabled={busy}>
            →
          </button>
        </div>

        {(() => {
          // Planned incomplete set still wins as the immediate logger target.
          const plannedParts: string[] = [];
          if (currentSet && !currentSet.completed) {
            if (spec.usesWeight && currentSet.weightKg != null) {
              plannedParts.push(`${currentSet.weightKg} кг`);
            }
            if (spec.usesReps && currentSet.reps != null) {
              plannedParts.push(`${currentSet.reps} повт`);
            }
            if (spec.usesDistance && currentSet.distanceKm != null) {
              plannedParts.push(`${currentSet.distanceKm} км`);
            }
            if (spec.usesDuration && currentSet.durationSec != null) {
              const mins = Math.round(currentSet.durationSec / 60);
              plannedParts.push(`${mins} мин`);
            }
          }
          const hasPlanned = plannedParts.length > 0;
          const chromeTarget =
            liveGoal?.targetLine ??
            (suggestedKg != null && spec.usesWeight
              ? `${formatSuggestedKg(suggestedKg)} кг`
              : null);
          if (!hasPlanned && !chromeTarget && !liveGoal) return null;
          return (
            <div className="mt-3 text-center" aria-label="Цель подхода">
              {liveGoal && (liveGoal.basisKg != null || liveGoal.leverLabel) ? (
                <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--muted)]">
                  {liveGoal.basisKg != null && liveGoal.basisKg > 0
                    ? `прошлый макс ${formatSuggestedKg(liveGoal.basisKg)} кг`
                    : null}
                  {(() => {
                    const next = liveGoal.suggestedKg;
                    const prev = liveGoal.basisKg;
                    if (next == null || prev == null || !(prev > 0)) return null;
                    const delta = Math.round((next - prev) * 10) / 10;
                    if (Math.abs(delta) < 0.05) return " · как в прошлый раз";
                    const sign = delta > 0 ? "+" : "";
                    return ` · цель ${sign}${formatSuggestedKg(delta)} кг`;
                  })()}
                  {liveGoal.basisKg != null && liveGoal.leverLabel ? " · " : null}
                  {liveGoal.leverLabel
                    ? `${liveGoal.leverLabel}${
                        liveGoal.recoveryHint
                          ? ""
                          : liveGoal.leverRemembered
                            ? liveGoal.streakHint
                              ? ` · ваш · ${liveGoal.streakHint}`
                              : " · ваш"
                            : ""
                      }`
                    : null}
                  {liveGoal.extraSet ? " · +1 подход" : null}
                </p>
              ) : null}
              {liveGoal?.recoveryHint ? (
                <p className="mt-0.5 text-[11px] font-medium text-[var(--accent-streak)]">
                  {liveGoal.recoveryHint}
                </p>
              ) : null}
              <p className="mt-1 text-lg font-semibold tracking-tight text-[var(--accent)]">
                Цель: {hasPlanned ? plannedParts.join(" × ") : chromeTarget}
              </p>
            </div>
          );
        })()}

        {focus.sets.length > 0 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5" aria-label="Подходы">
            {focus.sets.map((set, i) => {
              const isCurrent = i === currentSetIndex && !set.completed;
              return (
                <span
                  key={set.id}
                  className={`min-w-[3.5rem] rounded-xl px-2 py-1.5 text-center text-xs font-semibold tabular-nums ${
                    set.completed
                      ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                      : isCurrent
                        ? "border-[1.5px] border-[var(--accent)] bg-white text-[var(--foreground)] shadow-[0_0_0_3px_rgba(13,115,119,0.12)]"
                        : "border-[1.5px] border-[var(--border-hairline)] bg-[var(--surface-panel)] text-[var(--muted)]"
                  }`}
                >
                  <span className="block text-[9px] font-bold uppercase tracking-wide opacity-70">
                    {isCurrent ? `${i + 1} · сейчас` : i + 1}
                  </span>
                  {set.completed || isCurrent ? setChipLabel(set, focus.kind) : "—"}
                </span>
              );
            })}
          </div>
        ) : null}

        {group.length > 1 ? (
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            {group.map((g) => (
              <span
                key={g.id}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                  g.id === focus.id ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-mist)] text-[var(--muted-strong)]"
                }`}
              >
                {g.name}
              </span>
            ))}
          </div>
        ) : null}

        {advice && !liveGoal?.targetLine ? (
          <p
            className={`mt-2 px-2 text-center text-xs leading-snug ${
              advice.kind === "stall" ? "text-[var(--accent-streak)]" : "text-[var(--muted)]"
            }`}
          >
            <span className="font-semibold">{advice.title}.</span> {advice.detail}
          </p>
        ) : advice?.kind === "stall" ? (
          <p className="mt-2 px-2 text-center text-xs leading-snug text-[var(--accent-streak)]">
            <span className="font-semibold">{advice.title}.</span> Плато — soft deload или
            тоннаж/повторы на текущем весе.
          </p>
        ) : null}

        {showSetMeta ? (
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              type="button"
              className="rounded-full bg-[var(--surface-mist)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--accent-ink)]"
              onClick={onCycleSetType}
            >
              {SET_TYPE_SHORT[draftSetType]}
            </button>
            <label
              className="flex items-center gap-1.5 text-xs text-[var(--muted)]"
              title={EFFORT_FIELD_ARIA}
            >
              {EFFORT_FIELD_LABEL}
              <input
                inputMode="decimal"
                className="w-14 rounded-lg border border-[var(--border-hairline)] bg-[var(--card)] px-2 py-1.5 text-center text-base font-semibold outline-none focus:border-[var(--accent)]"
                value={draftRpe}
                onChange={(e) => onDraftRpe(e.target.value)}
                placeholder="—"
                aria-label={EFFORT_FIELD_ARIA}
              />
            </label>
          </div>
        ) : null}

        {spec.usesWeight || spec.usesReps || spec.usesDistance || spec.usesDuration ? (
          <div className="mt-5 flex flex-col gap-3">
            {spec.usesWeight || spec.usesReps ? (
              <div className="grid grid-cols-2 gap-2.5">
                {spec.usesWeight ? (
                  <div className="rounded-[22px] bg-[var(--card)] px-2.5 py-3 text-center shadow-[var(--shadow-card)]">
                    <small className="text-xs font-extrabold text-[var(--muted)]">Вес</small>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-mist)] text-2xl font-semibold text-[var(--accent-ink)]"
                        onClick={() => onBumpKg(-2.5)}
                      >
                        −
                      </button>
                      <input
                        data-draft-field={`${focus.id}-kg`}
                        inputMode="decimal"
                        className={`w-[4.5rem] border-0 bg-transparent text-center font-display text-3xl font-bold tabular-nums outline-none ${
                          draftError && !draftKg.trim() ? "text-red-600" : ""
                        }`}
                        value={draftKg}
                        onChange={(e) => onDraftKg(e.target.value)}
                        aria-label="Вес"
                      />
                      <button
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-mist)] text-2xl font-semibold text-[var(--accent-ink)]"
                        onClick={() => onBumpKg(2.5)}
                      >
                        +
                      </button>
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-[var(--muted)]">кг · шаг 2,5</div>
                  </div>
                ) : null}
                {spec.usesReps ? (
                  <div className="rounded-[22px] bg-[var(--card)] px-2.5 py-3 text-center shadow-[var(--shadow-card)]">
                    <small className="text-xs font-extrabold text-[var(--muted)]">Повторы</small>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-mist)] text-2xl font-semibold text-[var(--accent-ink)]"
                        onClick={() => bumpReps(-1)}
                        aria-label="Меньше повторов"
                      >
                        −
                      </button>
                      <input
                        data-draft-field={`${focus.id}-reps`}
                        inputMode="numeric"
                        className={`w-[3.5rem] border-0 bg-transparent text-center font-display text-3xl font-bold tabular-nums outline-none ${
                          draftError && !draftReps.trim() ? "text-red-600" : ""
                        }`}
                        value={draftReps}
                        onChange={(e) => onDraftReps(e.target.value)}
                        aria-label="Повторы"
                      />
                      <button
                        type="button"
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--surface-mist)] text-2xl font-semibold text-[var(--accent-ink)]"
                        onClick={() => bumpReps(1)}
                        aria-label="Больше повторов"
                      >
                        +
                      </button>
                    </div>
                    <div className="mt-0.5 text-xs font-bold text-[var(--muted)]">раз</div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {spec.usesDistance ? (
              <label className="flex flex-col items-center gap-1 rounded-[22px] bg-[var(--card)] px-3 py-3 shadow-[var(--shadow-card)]">
                <span className="text-xs font-extrabold text-[var(--muted)]">км</span>
                <input
                  data-draft-field={`${focus.id}-km`}
                  inputMode="decimal"
                  className={`w-28 rounded-2xl border bg-[var(--surface-mist)] px-3 py-3 text-center font-display text-3xl font-bold tabular-nums outline-none focus:border-[var(--accent)] ${
                    draftError && !draftKm.trim()
                      ? "border-red-400"
                      : "border-[var(--border-hairline)]"
                  }`}
                  value={draftKm}
                  onChange={(e) => onDraftKm(e.target.value)}
                />
              </label>
            ) : null}
            {spec.usesDuration ? (
              <label className="flex flex-col items-center gap-1 rounded-[22px] bg-[var(--card)] px-3 py-3 shadow-[var(--shadow-card)]">
                <span className="text-xs font-extrabold text-[var(--muted)]">мин</span>
                <input
                  data-draft-field={`${focus.id}-time`}
                  inputMode="decimal"
                  className={`w-28 rounded-2xl border bg-[var(--surface-mist)] px-3 py-3 text-center font-display text-3xl font-bold tabular-nums outline-none focus:border-[var(--accent)] ${
                    draftError && !draftTime.trim()
                      ? "border-red-400"
                      : "border-[var(--border-hairline)]"
                  }`}
                  value={draftTime}
                  onChange={(e) => onDraftTime(e.target.value)}
                />
              </label>
            ) : null}
            {draftError ? (
              <p className="text-center text-sm font-medium text-red-600" role="alert">
                {draftError}
              </p>
            ) : null}
            {(liveGoal?.suggestedKg ?? suggestedKg) != null && spec.usesWeight ? (
              <button
                type="button"
                className="text-sm font-semibold text-[var(--accent)]"
                onClick={onApplySuggested}
              >
                Взять{" "}
                {liveGoal?.targetLine ??
                  `${formatSuggestedKg(liveGoal?.suggestedKg ?? suggestedKg!)} кг`}
              </button>
            ) : null}
          </div>
        ) : (
          <p className="mt-8 text-center text-[var(--muted)]">Отметьте подход ✓</p>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-6">
          {nextLine ? (
            <div className="rounded-[18px] bg-[var(--card)] px-3.5 py-3 shadow-[var(--shadow-card)]" data-testid="stage-next">
              <p className="text-sm font-extrabold">{nextLine}</p>
            </div>
          ) : null}
          {currentSet && !currentSet.completed ? (
            <button
              type="button"
              disabled={busy}
              className="rounded-[20px] bg-[var(--accent)] py-4 text-lg font-extrabold text-white disabled:opacity-40"
              onClick={onCompleteCurrent}
            >
              Подход готов
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              className="rounded-[20px] bg-[var(--accent)] py-4 text-lg font-extrabold text-white disabled:opacity-40"
              onClick={onAddAndComplete}
            >
              + Подход и готово
            </button>
          )}
          <div className="flex gap-2">
            {focus.kind !== "cardio" &&
            (mode === "rest_pause" || focus.kind === "strength") ? (
              <button
                type="button"
                disabled={busy}
                className="flex-1 rounded-2xl border border-[var(--border-hairline)] bg-[var(--card)] py-3 text-sm font-semibold"
                onClick={onRestPause}
              >
                Отдых-пауза {REST_PAUSE_SEC}с
              </button>
            ) : null}
            {mode === "circuit" ? (
              <button
                type="button"
                disabled={busy}
                className="flex-1 rounded-2xl border border-[var(--border-hairline)] bg-[var(--card)] py-3 text-sm font-semibold"
                onClick={onSkipRest}
                title={`${CIRCUIT_ROUND_REST_SEC}с между кругами`}
              >
                Круг {circuitRound}/{targetRounds}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy || !allDone}
              className="flex-1 rounded-2xl bg-[var(--accent-soft)] py-3 text-sm font-bold text-[var(--accent-ink)] disabled:opacity-30"
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
