"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateWords, formatTimeShort } from "@/lib/dates";
import { formatSignedKg } from "@/lib/diet";
import { withBasePath } from "@/lib/paths";
import { groupWeightEntriesByDate } from "@/lib/weight-entries";

type WeightEntryRow = {
  id: string;
  date: string;
  weightKg: number;
  measuredAt: string;
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
  timezone?: string | null;
  onChanged?: () => void;
};

function WeightUndoToast({ label, onUndo, onExpired }: { label: string; onUndo: () => void; onExpired: () => void }) {
  useEffect(() => {
    const t = setTimeout(onExpired, 4000);
    return () => clearTimeout(t);
  }, [onExpired]);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-800 px-4 py-3 text-sm text-white">
      <span>Удалено: {label}</span>
      <button type="button" className="rounded-lg bg-white/20 px-3 py-1 text-xs font-semibold hover:bg-white/30" onClick={onUndo}>
        Отменить
      </button>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  );
}

export function WeightHistory({ refreshKey, timezone, onChanged }: WeightHistoryProps) {
  const [data, setData] = useState<WeightsResponse | null>(null);
  const [weightInput, setWeightInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; label: string } | null>(null);

  const load = useCallback(async (currentLimit = limit) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(withBasePath(`/api/weights?limit=${currentLimit}`));
      const payload = (await response.json()) as WeightsResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось загрузить вес");
      }
      setData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(limit);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, limit]);

  async function saveWeight(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const now = new Date();
      const dateKey = timezone
        ? (() => {
            const parts = new Intl.DateTimeFormat("en-CA", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              timeZone: timezone,
            }).formatToParts(now);
            const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
            return `${m.year}-${m.month}-${m.day}`;
          })()
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

      const response = await fetch(withBasePath("/api/weights"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateKey,
          weightKg: Number(weightInput),
          measuredAt: now.toISOString(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось сохранить вес");
      }
      setWeightInput("");
      await load();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  async function performDelete(id: string) {
    setDeletingId(id);
    try {
      const response = await fetch(withBasePath(`/api/weights?id=${encodeURIComponent(id)}`), {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Не удалось удалить запись");
      }
      await load(limit);
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  }

  function requestDelete(id: string, label: string) {
    // Optimistically hide entry
    setData((prev) => prev ? { ...prev, entries: prev.entries.filter((e) => e.id !== id) } : prev);
    setPendingDelete({ id, label });
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { id } = pendingDelete;
    setPendingDelete(null);
    await performDelete(id);
  }

  function undoDelete() {
    setPendingDelete(null);
    void load(limit); // restore
  }

  const grouped = groupWeightEntriesByDate(data?.entries ?? []);

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
            <label htmlFor="weight-now">Вес сейчас, кг</label>
            <input
              id="weight-now"
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
            {saving ? "Сохраняем..." : "Добавить измерение"}
          </button>
        </form>

        {/* Undo toast */}
        {pendingDelete ? (
          <WeightUndoToast
            label={pendingDelete.label}
            onUndo={undoDelete}
            onExpired={() => void confirmDelete()}
          />
        ) : null}

        <div>
          <h2 className="text-lg font-bold">Последние измерения</h2>
          {loading ? <p className="mt-3 text-sm text-slate-500">Загрузка...</p> : null}

          {!loading && grouped.length === 0 && !pendingDelete ? (
            <p className="mt-3 text-sm text-slate-500">Пока нет записей. Добавьте первое измерение выше.</p>
          ) : null}

          <div className="mt-4 flex flex-col gap-3">
            {grouped.map(({ date, items }) => (
              <div key={date}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {formatDateWords(date)}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {items.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5"
                    >
                      <div className="flex items-baseline gap-3">
                        <p className="font-semibold">{entry.weightKg} кг</p>
                        <p className="text-xs text-slate-400">
                          {formatTimeShort(entry.measuredAt, timezone)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        title="Удалить"
                        aria-label="Удалить"
                        disabled={deletingId === entry.id}
                        onClick={() => requestDelete(entry.id, `${entry.weightKg} кг`)}
                      >
                        <TrashIcon />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Load more */}
          {(data?.entries.length ?? 0) >= limit ? (
            <button
              type="button"
              className="mt-3 text-sm text-teal-700 hover:underline"
              onClick={() => setLimit((l) => l + 20)}
            >
              Показать ещё…
            </button>
          ) : null}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
