"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime, formatDateWords } from "@/lib/dates";
import { formatSignedKg } from "@/lib/diet";
import { withBasePath } from "@/lib/paths";

type WeightEntryRow = {
  id: string;
  date: string;
  weightKg: number;
  createdAt: string;
};

type WeightsResponse = {
  entries: WeightEntryRow[];
  firstWeightKg: number | null;
  currentWeightKg: number | null;
  weightChangeKg: number | null;
  error?: string;
};

type WeightHistoryProps = {
  refreshKey: number;
  onChanged?: () => void;
};

export function WeightHistory({ refreshKey, onChanged }: WeightHistoryProps) {
  const [data, setData] = useState<WeightsResponse | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/weights?limit=10"));
      const payload = (await response.json()) as WeightsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось загрузить вес");
      }
      setData(payload);
      const todayEntry = payload.entries.find((entry) => entry.date === todayKey);
      setWeightInput(todayEntry ? String(todayEntry.weightKg) : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [todayKey]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function saveWeight(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(withBasePath("/api/weights"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: todayKey, weightKg: Number(weightInput) }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось сохранить вес");
      }
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card p-4 md:p-6">
      <div className="flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">Текущий вес</div>
            <div className="mt-1 text-2xl font-bold">
              {data?.currentWeightKg != null ? `${data.currentWeightKg} кг` : "—"}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">С начала измерений</div>
            <div className="mt-1 text-2xl font-bold">
              {data?.weightChangeKg != null ? formatSignedKg(data.weightChangeKg) : "—"}
            </div>
          </div>
        </div>

        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={saveWeight}>
          <div className="field flex-1">
            <label htmlFor="weight-today">Вес на сегодня, кг</label>
            <input
              id="weight-today"
              type="number"
              min="20"
              max="300"
              step="0.1"
              placeholder="78.5"
              value={weightInput}
              disabled={saving}
              onChange={(event) => setWeightInput(event.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </form>

        <div>
          <h2 className="text-lg font-bold">Последние измерения</h2>
          {loading ? <p className="mt-3 text-sm text-slate-500">Загрузка...</p> : null}

          {!loading && data?.entries.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">Пока нет записей. Добавьте первое измерение выше.</p>
          ) : null}

          <ul className="mt-4 flex flex-col gap-2">
            {data?.entries.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div>
                  <p className="font-semibold">{entry.weightKg} кг</p>
                  <p className="text-sm capitalize text-slate-500">{formatDateWords(entry.date)}</p>
                </div>
                <p className="text-right text-xs text-slate-400">{formatDateTime(entry.createdAt)}</p>
              </li>
            ))}
          </ul>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
