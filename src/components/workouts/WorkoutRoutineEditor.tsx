"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import {
  EXERCISE_KINDS,
  EXERCISE_KIND_LABELS,
  type ExerciseKind,
} from "@/lib/workouts/exercise-kind";
import { MUSCLE_GROUPS, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import {
  BLOCK_MODE_LABELS,
  BLOCK_MODES,
  type BlockMode,
  parseCircuitRounds,
} from "@/lib/workouts/block-mode";
import type { PlannedSet, SerializedRoutine } from "@/lib/workouts/routines";
import { nextSupersetLetter } from "@/lib/workouts/supersets";
import { WEEKDAY_LABELS_RU } from "@/lib/workouts/weekdays";

type DraftEx = {
  key: string;
  name: string;
  kind: ExerciseKind;
  muscleGroup: string;
  plannedSets: PlannedSet[];
  supersetGroup: string | null;
  blockMode: BlockMode;
  circuitRounds: number | null;
};

type Props = {
  routineId: string | null;
  onClose: () => void;
  onSaved: (routine: SerializedRoutine) => void;
};

function emptyEx(): DraftEx {
  return {
    key: `n-${Math.random().toString(36).slice(2, 9)}`,
    name: "",
    kind: "strength",
    muscleGroup: "",
    plannedSets: [{ weightKg: null, reps: 8, distanceKm: null, durationSec: null, setType: "working" }],
    supersetGroup: null,
    blockMode: "normal",
    circuitRounds: null,
  };
}

export function WorkoutRoutineEditor({ routineId, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [planLabel, setPlanLabel] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [groups, setGroups] = useState<MuscleGroupKey[]>([]);
  const [exercises, setExercises] = useState<DraftEx[]>([emptyEx()]);
  const [loading, setLoading] = useState(Boolean(routineId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!routineId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const resp = await fetch(withBasePath(`/api/workouts/routines/${routineId}`));
        const json = (await resp.json()) as { routine?: SerializedRoutine; error?: string };
        if (!resp.ok || !json.routine) throw new Error(json.error || "Не найдено");
        if (cancelled) return;
        const r = json.routine;
        setName(r.name);
        setNote(r.note ?? "");
        setPlanLabel(r.planLabel ?? "");
        setWeekdays(r.weekdays);
        setGroups(r.muscleKeys as MuscleGroupKey[]);
        setExercises(
          r.exercises.length > 0
            ? r.exercises.map((ex) => ({
                key: ex.id,
                name: ex.name,
                kind: ex.kind,
                muscleGroup: ex.muscleGroup ?? "",
                plannedSets:
                  ex.plannedSets.length > 0
                    ? ex.plannedSets
                    : [
                        {
                          weightKg: null,
                          reps: 8,
                          distanceKm: null,
                          durationSec: null,
                          setType: "working" as const,
                        },
                      ],
                supersetGroup: ex.supersetGroup,
                blockMode: ex.blockMode,
                circuitRounds: ex.circuitRounds,
              }))
            : [emptyEx()],
        );
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Ошибка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [routineId]);

  const toggleDay = (d: number) => {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  };

  const toggleGroup = (key: MuscleGroupKey) => {
    setGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const linkSuperset = (index: number) => {
    setExercises((prev) => {
      if (index <= 0) return prev;
      const next = [...prev];
      const a = next[index - 1]!;
      const b = next[index]!;
      const letter =
        a.supersetGroup || b.supersetGroup || nextSupersetLetter(next.map((e) => e.supersetGroup));
      next[index - 1] = { ...a, supersetGroup: letter };
      next[index] = { ...b, supersetGroup: letter };
      return next;
    });
  };

  const clearSuperset = (index: number) => {
    setExercises((prev) => {
      const next = [...prev];
      next[index] = { ...next[index]!, supersetGroup: null };
      return next;
    });
  };

  const save = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: name.trim(),
        note: note.trim() || null,
        planLabel: planLabel.trim() || null,
        weekdays,
        muscleGroups: groups,
        exercises: exercises
          .filter((e) => e.name.trim())
          .map((e) => ({
            name: e.name.trim(),
            kind: e.kind,
            muscleGroup: e.muscleGroup || null,
            plannedSets: e.plannedSets,
            supersetGroup: e.supersetGroup,
            blockMode: e.blockMode,
            circuitRounds: e.blockMode === "circuit" ? e.circuitRounds ?? 3 : null,
          })),
      };
      const url = routineId
        ? withBasePath(`/api/workouts/routines/${routineId}`)
        : withBasePath("/api/workouts/routines");
      const resp = await fetch(url, {
        method: routineId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await resp.json()) as { routine?: SerializedRoutine; error?: string };
      if (!resp.ok || !json.routine) throw new Error(json.error || "Не сохранилось");
      onSaved(json.routine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }, [name, note, planLabel, weekdays, groups, exercises, routineId, onSaved]);

  if (loading) {
    return <p className="text-sm text-slate-500">Загрузка шаблона…</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {routineId ? "Редактор шаблона" : "Новый шаблон"}
        </h2>
        <button type="button" className="text-sm text-slate-500" onClick={onClose}>
          Закрыть
        </button>
      </div>

      <label className="flex flex-col gap-1 text-xs text-slate-500">
        Название
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-base"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-500">
        Заметка
        <input
          className="rounded-lg border border-slate-200 px-3 py-2 text-base"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Слот плана (A/B/C)
        </p>
        <input
          className="mt-1 w-20 rounded-lg border border-slate-200 px-3 py-2 text-base uppercase"
          maxLength={8}
          value={planLabel}
          onChange={(e) => setPlanLabel(e.target.value)}
          placeholder="A"
        />
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Дни недели</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {WEEKDAY_LABELS_RU.map((label, day) => {
            const on = weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  on ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Группы</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {MUSCLE_GROUPS.map((g) => {
            const on = groups.includes(g.key);
            return (
              <button
                key={g.key}
                type="button"
                onClick={() => toggleGroup(g.key)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  on ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-700"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Упражнения</p>
        {exercises.map((ex, idx) => (
          <div
            key={ex.key}
            className={`rounded-xl border p-3 ${
              ex.supersetGroup ? "border-teal-300 bg-teal-50/40" : "border-slate-200 bg-white"
            }`}
          >
            {ex.supersetGroup ? (
              <p className="mb-2 text-xs font-semibold text-teal-800">
                Суперсет {ex.supersetGroup}
              </p>
            ) : null}
            <input
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base"
              placeholder="Название"
              value={ex.name}
              onChange={(e) =>
                setExercises((prev) => {
                  const next = [...prev];
                  next[idx] = { ...ex, name: e.target.value };
                  return next;
                })
              }
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {EXERCISE_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() =>
                    setExercises((prev) => {
                      const next = [...prev];
                      next[idx] = { ...ex, kind: k };
                      return next;
                    })
                  }
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    ex.kind === k ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {EXERCISE_KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {BLOCK_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() =>
                    setExercises((prev) => {
                      const next = [...prev];
                      next[idx] = {
                        ...ex,
                        blockMode: mode,
                        circuitRounds: mode === "circuit" ? ex.circuitRounds ?? 3 : null,
                      };
                      return next;
                    })
                  }
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    ex.blockMode === mode ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {BLOCK_MODE_LABELS[mode]}
                </button>
              ))}
              {ex.blockMode === "circuit" ? (
                <label className="flex items-center gap-1 text-[10px] text-slate-500">
                  Кругов
                  <input
                    inputMode="numeric"
                    className="w-12 rounded border border-slate-200 px-1.5 py-0.5 text-base"
                    value={ex.circuitRounds ?? 3}
                    onChange={(e) => {
                      const n = parseCircuitRounds(e.target.value);
                      setExercises((prev) => {
                        const next = [...prev];
                        next[idx] = { ...ex, circuitRounds: n };
                        return next;
                      });
                    }}
                  />
                </label>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1 text-slate-500">
                Подходы
                <input
                  inputMode="numeric"
                  className="w-14 rounded border border-slate-200 px-2 py-1 text-base"
                  value={ex.plannedSets.length}
                  onChange={(e) => {
                    const n = Math.min(12, Math.max(1, Math.round(Number(e.target.value)) || 1));
                    setExercises((prev) => {
                      const next = [...prev];
                      const sets = [...ex.plannedSets];
                      while (sets.length < n) {
                        sets.push({
                          weightKg: null,
                          reps: 8,
                          distanceKm: null,
                          durationSec: null,
                          setType: "working",
                        });
                      }
                      next[idx] = { ...ex, plannedSets: sets.slice(0, n) };
                      return next;
                    });
                  }}
                />
              </label>
              <label className="flex items-center gap-1 text-slate-500">
                Повт
                <input
                  inputMode="numeric"
                  className="w-14 rounded border border-slate-200 px-2 py-1 text-base"
                  value={ex.plannedSets[0]?.reps ?? ""}
                  onChange={(e) => {
                    const reps = Math.round(Number(e.target.value)) || null;
                    setExercises((prev) => {
                      const next = [...prev];
                      next[idx] = {
                        ...ex,
                        plannedSets: ex.plannedSets.map((s) => ({ ...s, reps })),
                      };
                      return next;
                    });
                  }}
                />
              </label>
              {idx > 0 ? (
                <button
                  type="button"
                  className="font-medium text-teal-800"
                  onClick={() => linkSuperset(idx)}
                >
                  + Суперсет с предыдущим
                </button>
              ) : null}
              {ex.supersetGroup ? (
                <button
                  type="button"
                  className="text-slate-500"
                  onClick={() => clearSuperset(idx)}
                >
                  Убрать из суперсета
                </button>
              ) : null}
              <button
                type="button"
                className="text-red-600"
                onClick={() => setExercises((prev) => prev.filter((_, i) => i !== idx))}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="text-sm font-medium text-teal-800"
          onClick={() => setExercises((prev) => [...prev, emptyEx()])}
        >
          + Упражнение
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || !name.trim() || groups.length === 0}
          className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          onClick={() => void save()}
        >
          Сохранить
        </button>
        <button type="button" className="rounded-lg px-3 py-2 text-sm text-slate-600" onClick={onClose}>
          Отмена
        </button>
      </div>
    </div>
  );
}
