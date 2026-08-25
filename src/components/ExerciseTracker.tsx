"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultLabelForCalories,
  EXERCISE_QUICK_CHIPS,
} from "@/lib/exercise";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";
import { withBasePath } from "@/lib/paths";

type ExerciseEntryDto = {
  id: string;
  label: string;
  caloriesBurned: number;
  minutes: number | null;
};

type ExerciseResponse = {
  entries: ExerciseEntryDto[];
  totalBurned: number;
};

const PANEL_ID = "exercise";

export function ExerciseTracker({
  selectedDate,
  onChanged,
}: {
  selectedDate: string;
  onChanged?: () => void;
}) {
  const [entries, setEntries] = useState<ExerciseEntryDto[]>([]);
  const [totalBurned, setTotalBurned] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [customKcal, setCustomKcal] = useState("");
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath(`/api/exercise?date=${selectedDate}`));
      if (!resp.ok) return;
      const data = (await resp.json()) as ExerciseResponse;
      setEntries(data.entries);
      setTotalBurned(data.totalBurned);
    } catch {
      // non-critical
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!hidden) void load();
  }, [load, hidden]);

  function handleHide() {
    hidePanelToday(PANEL_ID, selectedDate);
    setHidden(true);
  }

  async function add(label: string, caloriesBurned: number) {
    setLoading(true);
    try {
      const resp = await fetch(withBasePath("/api/exercise"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, label, caloriesBurned }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as ExerciseResponse;
        setEntries(data.entries);
        setTotalBurned(data.totalBurned);
        onChanged?.();
      }
    } finally {
      setLoading(false);
    }
  }

  async function addQuick(caloriesBurned: number) {
    await add(defaultLabelForCalories(caloriesBurned), caloriesBurned);
  }

  async function addCustom() {
    const kcal = Math.round(Number(customKcal));
    const label = customLabel.trim() || defaultLabelForCalories(kcal);
    if (!Number.isFinite(kcal) || kcal < 1) return;
    await add(label, kcal);
    setCustomLabel("");
    setCustomKcal("");
    setShowCustom(false);
  }

  async function remove(id: string) {
    setLoading(true);
    try {
      const resp = await fetch(withBasePath("/api/exercise"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (resp.ok) {
        await load();
        onChanged?.();
      }
    } finally {
      setLoading(false);
    }
  }

  if (hidden) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-400 hover:border-slate-300"
        onClick={() => {
          showPanelToday(PANEL_ID, selectedDate);
          setHidden(false);
        }}
      >
        <span>
          Тренировка — {totalBurned > 0 ? `−${totalBurned} ккал` : "нет записей"}
        </span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-amber-100 bg-[var(--accent-streak-soft)] px-4 py-3 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-amber-950">Тренировка</h2>
            <p className="mt-0.5 text-sm text-amber-900/80">
              {totalBurned > 0
                ? `Сожжено −${totalBurned} ккал`
                : "Добавьте активность за день"}
            </p>
          </div>
          <button type="button" className="btn-quiet text-amber-900" onClick={handleHide}>
            Скрыть
          </button>
        </div>
      </div>

      <div className="px-4 py-3 md:px-5">
        <p className="mb-3 text-xs text-slate-500">
          Быстрые кнопки — типичные тренировки, или укажите свои ккал
        </p>
        <div className="chip-row-fill">
          {EXERCISE_QUICK_CHIPS.map((chip) => (
            <button
              key={chip.caloriesBurned}
              type="button"
              className="chip min-h-10 justify-center font-semibold text-amber-900"
              style={{ background: "var(--accent-streak-soft)" }}
              disabled={loading}
              onClick={() => void addQuick(chip.caloriesBurned)}
            >
              {chip.label} · {chip.caloriesBurned}
            </button>
          ))}
          <button
            type="button"
            className="chip min-h-10 justify-center font-semibold text-slate-600"
            disabled={loading}
            onClick={() => setShowCustom((v) => !v)}
          >
            Своё…
          </button>
        </div>

        {showCustom ? (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="min-w-[8rem] flex-1 text-xs text-slate-600">
              Название
              <input
                type="text"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                placeholder="Йога, плавание…"
                maxLength={80}
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
              />
            </label>
            <label className="w-24 text-xs text-slate-600">
              Ккал
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={5000}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800"
                placeholder="300"
                value={customKcal}
                onChange={(e) => setCustomKcal(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="btn-primary min-h-10 px-4 text-sm"
              disabled={loading || !customKcal}
              onClick={() => void addCustom()}
            >
              Добавить
            </button>
          </div>
        ) : null}

        {entries.length > 0 ? (
          <ul className="mt-3 divide-y divide-slate-100">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">{entry.label}</p>
                  <p className="text-xs text-slate-500">
                    −{entry.caloriesBurned} ккал
                    {entry.minutes != null ? ` · ${entry.minutes} мин` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-quiet shrink-0 text-slate-400 hover:text-rose-600"
                  disabled={loading}
                  aria-label={`Удалить ${entry.label}`}
                  onClick={() => void remove(entry.id)}
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
