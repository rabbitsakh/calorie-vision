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
import { notifyDietTargetsChanged } from "@/lib/diet-refresh";
import { withBasePath } from "@/lib/paths";

type ProfileResponse = {
  goal: WeightGoal | null;
  goalPace: GoalPace | null;
  targetWeightKg: number | null;
  goalDeadline: string | null;
  currentWeightKg: number | null;
  weightChangeKg: number | null;
  error?: string;
};

type WeightGoalCardProps = {
  selectedDate: string;
  refreshKey: number;
  onChanged: () => void;
  showCurrentWeight?: boolean;
};

export function WeightGoalCard({
  selectedDate,
  refreshKey,
  onChanged,
  showCurrentWeight = false,
}: WeightGoalCardProps) {
  const [goal, setGoal] = useState<WeightGoal | null>(null);
  const [goalPace, setGoalPace] = useState<GoalPace | null>(null);
  const [draftGoal, setDraftGoal] = useState<WeightGoal | null>(null);
  const [draftPace, setDraftPace] = useState<GoalPace | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [currentWeightKg, setCurrentWeightKg] = useState<number | null>(null);
  const [weightChangeKg, setWeightChangeKg] = useState<number | null>(null);
  const [targetWeightKg, setTargetWeightKg] = useState<number | null>(null);
  const [goalDeadline, setGoalDeadline] = useState<string | null>(null);
  const [draftTarget, setDraftTarget] = useState("");
  const [draftDeadline, setDraftDeadline] = useState("");
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
      setTargetWeightKg(data.targetWeightKg);
      setGoalDeadline(data.goalDeadline);
      setDraftTarget(data.targetWeightKg ? String(data.targetWeightKg) : "");
      setDraftDeadline(data.goalDeadline ?? "");
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
        body: JSON.stringify({
          goal: nextGoal,
          goalPace: nextPace,
          targetWeightKg: draftTarget ? Number(draftTarget) : null,
          goalDeadline: draftDeadline || null,
        }),
      });
      const data = (await response.json()) as { goal?: WeightGoal; goalPace?: GoalPace | null; targetWeightKg?: number | null; goalDeadline?: string | null; error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Не удалось сохранить цель");
      }
      if (isWeightGoal(data.goal)) {
        setGoal(data.goal);
        setGoalPace(isGoalPace(data.goalPace) ? data.goalPace : null);
        setDraftGoal(data.goal);
        setDraftPace(isGoalPace(data.goalPace) ? data.goalPace : null);
        setTargetWeightKg(data.targetWeightKg ?? null);
        setGoalDeadline(data.goalDeadline ?? null);
        setEditingGoal(false);
      }
      notifyDietTargetsChanged();
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

  const showPace = Boolean(draftGoal && goalNeedsPace(draftGoal));

  return (
    <section className="card p-6">
      <div className="flex flex-col gap-5">
        {loading ? <p className="text-sm text-slate-500">Загрузка...</p> : null}

        {!loading && showCurrentWeight ? (
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
            </div>
          </div>
        ) : null}

        {!loading ? (
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-600">Цель</p>
            {goal && !editingGoal ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3">
                <div>
                  <p className="font-semibold text-teal-900">{formatGoalChoice(goal, goalPace)}</p>
                  <p className="text-xs text-teal-800">{savedGoalHint(goal, goalPace)}</p>
                  {targetWeightKg ? (
                    <p className="mt-1 text-xs text-teal-700">
                      Цель: {targetWeightKg} кг
                      {goalDeadline ? ` · к ${new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }).format(new Date(goalDeadline + "T12:00:00"))}` : ""}
                      {currentWeightKg && goalDeadline ? (() => {
                        const diff = Math.abs(currentWeightKg - targetWeightKg);
                        const daysLeft = Math.max(0, Math.round((new Date(goalDeadline + "T12:00:00").getTime() - Date.now()) / 86400000));
                        return diff > 0.05 && daysLeft > 0 ? ` · ${daysLeft} ${daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"} осталось` : null;
                      })() : null}
                    </p>
                  ) : null}
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
                    <p className="mb-2 text-sm font-semibold text-slate-600">Темп достижения цели</p>
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
                {draftGoal && goalNeedsPace(draftGoal) ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="field">
                      <label className="text-xs">Целевой вес, кг (необязательно)</label>
                      <input
                        type="number"
                        min="30"
                        max="300"
                        step="0.1"
                        placeholder="70"
                        value={draftTarget}
                        onChange={(e) => setDraftTarget(e.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label className="text-xs">Дата цели (необязательно)</label>
                      <input
                        type="date"
                        value={draftDeadline}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setDraftDeadline(e.target.value)}
                      />
                    </div>
                  </div>
                ) : null}
                {goal ? (
                  <button
                    type="button"
                    className="btn btn-secondary text-sm"
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
