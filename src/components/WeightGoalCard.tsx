"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GOAL_OPTIONS,
  PACE_OPTIONS,
  formatGoalChoice,
  formatSignedKg,
  goalNeedsPace,
  isGoalPace,
  isWeightGoal,
  paceHint,
  savedGoalHint,
  type GoalPace,
  type WeightGoal,
} from "@/lib/diet";
import { formatDateWords } from "@/lib/dates";
import { withBasePath } from "@/lib/paths";

type ProfileResponse = {
  goal: WeightGoal | null;
  goalPace: GoalPace | null;
  firstWeightKg: number | null;
  firstWeightDate: string | null;
  currentWeightKg: number | null;
  currentWeightDate: string | null;
  weightChangeKg: number | null;
  selectedWeightKg: number | null;
  error?: string;
};

type WeightGoalCardProps = {
  selectedDate: string;
  refreshKey: number;
  onChanged: () => void;
};

export function WeightGoalCard({ selectedDate, refreshKey, onChanged }: WeightGoalCardProps) {
  const [goal, setGoal] = useState<WeightGoal | null>(null);
  const [goalPace, setGoalPace] = useState<GoalPace | null>(null);
  const [draftGoal, setDraftGoal] = useState<WeightGoal | null>(null);
  const [draftPace, setDraftPace] = useState<GoalPace | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [weightChangeKg, setWeightChangeKg] = useState<number | null>(null);
  const [firstWeightDate, setFirstWeightDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath(`/api/profile?date=${selectedDate}`));
      const data = (await response.json()) as ProfileResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось загрузить профиль");
      }

      const nextGoal = isWeightGoal(data.goal) ? data.goal : null;
      const nextPace = isGoalPace(data.goalPace) ? data.goalPace : null;
      setGoal(nextGoal);
      setGoalPace(nextPace);
      setDraftGoal(nextGoal);
      setDraftPace(nextPace);
      if (!nextGoal || (goalNeedsPace(nextGoal) && !nextPace)) {
        setEditingGoal(true);
      }
      setCurrentWeightKg(data.currentWeightKg);
      setWeightChangeKg(data.weightChangeKg);
      setFirstWeightDate(data.firstWeightDate);
      setWeightInput(data.selectedWeightKg != null ? String(data.selectedWeightKg) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка профиля");
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile, refreshKey]);

  async function saveGoal(nextGoal: WeightGoal, nextPace: GoalPace | null) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(withBasePath("/api/profile"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: nextGoal, goalPace: nextPace }),
      });
      const data = (await response.json()) as { goal?: WeightGoal; goalPace?: GoalPace | null; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сохранить цель");
      }
      if (isWeightGoal(data.goal)) {
        setGoal(data.goal);
        setGoalPace(isGoalPace(data.goalPace) ? data.goalPace : null);
        setDraftGoal(data.goal);
        setDraftPace(isGoalPace(data.goalPace) ? data.goalPace : null);
        setEditingGoal(false);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения цели");
    } finally {
      setSaving(false);
    }
  }

  function pickGoal(nextGoal: WeightGoal) {
    setDraftGoal(nextGoal);
    if (!goalNeedsPace(nextGoal)) {
      setDraftPace(null);
      void saveGoal(nextGoal, null);
      return;
    }
    if (draftPace) {
      void saveGoal(nextGoal, draftPace);
    }
  }

  function pickPace(nextPace: GoalPace) {
    setDraftPace(nextPace);
    if (draftGoal && goalNeedsPace(draftGoal)) {
      void saveGoal(draftGoal, nextPace);
    }
  }

  async function saveWeight(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/weights"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, weightKg: Number(weightInput) }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сохранить вес");
      }
      await loadProfile();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения веса");
    } finally {
      setSaving(false);
    }
  }

  const showPace = Boolean(draftGoal && goalNeedsPace(draftGoal));

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-5">
        {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Текущий вес</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {currentWeightKg != null ? `${currentWeightKg} кг` : "—"}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">С начала измерений</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">
              {weightChangeKg != null ? formatSignedKg(weightChangeKg) : "—"}
            </div>
            {firstWeightDate ? (
              <p className="mt-1 text-xs text-slate-500">первая запись {formatDateWords(firstWeightDate)}</p>
            ) : null}
          </div>
        </div>

        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={saveWeight}>
          <div className="field flex-1">
            <label htmlFor="weightKg">Вес на {formatDateWords(selectedDate)}, кг</label>
            <input
              id="weightKg"
              type="number"
              min="20"
              max="300"
              step="0.1"
              placeholder="Например: 78.5"
              value={weightInput}
              onChange={(event) => setWeightInput(event.target.value)}
              disabled={saving}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Сохраняем..." : "Сохранить вес"}
          </button>
        </form>

        {!loading ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-600">Цель</p>
            {goal && !editingGoal ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-teal-900">{formatGoalChoice(goal, goalPace)}</p>
                  <p className="text-xs text-teal-800">{savedGoalHint(goal, goalPace)}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => {
                    setDraftGoal(goal);
                    setDraftPace(goalPace);
                    setEditingGoal(true);
                  }}
                >
                  Изменить цель
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  {GOAL_OPTIONS.map((option) => {
                    const active = draftGoal === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={saving}
                        onClick={() => pickGoal(option.value)}
                        className={`rounded-2xl border px-3 py-3 text-left ${
                          active
                            ? "border-teal-600 bg-teal-50 text-teal-900"
                            : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="mt-1 block text-xs text-slate-500">{option.hint}</span>
                      </button>
                    );
                  })}
                </div>
                {showPace ? (
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-600">Как именно</p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {PACE_OPTIONS.map((option) => {
                        const active = draftPace === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            disabled={saving}
                            onClick={() => pickPace(option.value)}
                            className={`rounded-2xl border px-3 py-3 text-left ${
                              active
                                ? "border-teal-600 bg-teal-50 text-teal-900"
                                : "border-slate-200 bg-white text-slate-700 hover:border-teal-300"
                            }`}
                          >
                            <span className="block text-sm font-semibold">{option.label}</span>
                            <span className="mt-1 block text-xs text-slate-500">
                              {draftGoal && goalNeedsPace(draftGoal) ? paceHint(draftGoal, option.value) : ""}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {goal ? (
                  <button
                    type="button"
                    className="text-sm text-teal-700 hover:underline"
                    onClick={() => setEditingGoal(false)}
                  >
                    Отмена
                  </button>
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
