"use client";

import type { Ref } from "react";
import { MUSCLE_GROUPS, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";

const RATE_OPTIONS = [
  { value: 0.025, label: "2.5%" },
  { value: 0.05, label: "5%" },
  { value: 0.075, label: "7.5%" },
  { value: 0.1, label: "10%" },
] as const;

type Props = {
  formRef?: Ref<HTMLElement>;
  fromPlusMenu: boolean;
  busy: boolean;
  newDate: string;
  newGroups: MuscleGroupKey[];
  progressRate: number;
  copyExercises: boolean;
  progressLine: string | null;
  hasPreviousSession: boolean;
  onDateChange: (value: string) => void;
  onToggleGroup: (key: MuscleGroupKey) => void;
  onProgressRateChange: (value: number) => void;
  onCopyExercisesChange: (value: boolean) => void;
  onCreate: () => void;
  onCancel: () => void;
  onGoRation: () => void;
};

/** New-session form extracted from WorkoutsView hub (wave C). */
export function WorkoutCreateSessionPanel({
  formRef,
  fromPlusMenu,
  busy,
  newDate,
  newGroups,
  progressRate,
  copyExercises,
  progressLine,
  hasPreviousSession,
  onDateChange,
  onToggleGroup,
  onProgressRateChange,
  onCopyExercisesChange,
  onCreate,
  onCancel,
  onGoRation,
}: Props) {
  const cardioOnly = newGroups.length === 1 && newGroups[0] === "cardio";

  return (
    <section
      ref={formRef}
      className="rounded-2xl border-2 border-[var(--accent)] bg-white p-4 shadow-sm"
    >
      <h2 className="font-semibold text-slate-900">Новая тренировка</h2>
      {fromPlusMenu ? (
        <p className="mt-1 text-xs font-medium text-teal-800">
          Из меню «+» · после создания откроется зал
        </p>
      ) : null}
      <label className="mt-3 flex flex-col gap-1 text-xs text-slate-500">
        Дата
        <input
          type="date"
          className="rounded-lg border border-slate-200 px-3 py-2 text-base"
          value={newDate}
          onChange={(e) => onDateChange(e.target.value)}
        />
      </label>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Вид / группы
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {MUSCLE_GROUPS.map((g) => {
          const on = newGroups.includes(g.key);
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => onToggleGroup(g.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                on
                  ? "bg-teal-700 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {g.label}
            </button>
          );
        })}
      </div>
      {!cardioOnly ? (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Прогрессия к прошлой
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onProgressRateChange(opt.value)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  progressRate === opt.value
                    ? "bg-teal-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                +{opt.label}
              </button>
            ))}
          </div>
          {progressLine ? <p className="mt-3 text-sm text-slate-600">{progressLine}</p> : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-600">
          Кардио: записывайте км и минуты — темп считается автоматически.
        </p>
      )}
      {hasPreviousSession ? (
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={copyExercises}
            onChange={(e) => onCopyExercisesChange(e.target.checked)}
          />
          Скопировать упражнения и подходы из прошлой
        </label>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          disabled={newGroups.length === 0 || busy}
          onClick={onCreate}
        >
          Создать и в зал
        </button>
        <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-600" onClick={onCancel}>
          Отмена
        </button>
        {fromPlusMenu ? (
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--accent)] underline-offset-2 hover:underline"
            onClick={onGoRation}
          >
            К рациону
          </button>
        ) : null}
      </div>
    </section>
  );
}

export { RATE_OPTIONS as CREATE_SESSION_RATE_OPTIONS };
