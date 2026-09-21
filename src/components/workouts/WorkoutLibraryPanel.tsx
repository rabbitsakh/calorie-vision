"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import {
  EXERCISE_KINDS,
  EXERCISE_KIND_LABELS,
  type ExerciseKind,
} from "@/lib/workouts/exercise-kind";
import { MUSCLE_GROUPS } from "@/lib/workouts/muscle-groups";

type LibraryEntry = {
  id: string;
  name: string;
  kind: ExerciseKind;
  defaultMuscleGroup: string | null;
  useCount: number;
  lastUsedAt: string;
};

type Props = {
  onPick?: (entry: LibraryEntry) => void;
};

export function WorkoutLibraryPanel({ onPick }: Props) {
  const [q, setQ] = useState("");
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ExerciseKind>("strength");
  const [group, setGroup] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "60" });
      if (query.trim()) params.set("q", query.trim());
      const resp = await fetch(withBasePath(`/api/workouts/library?${params}`));
      const json = (await resp.json()) as { entries?: LibraryEntry[]; error?: string };
      if (!resp.ok) throw new Error(json.error || "Ошибка");
      setEntries(json.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не загрузилось");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void load(q), 200);
    return () => window.clearTimeout(t);
  }, [q, load]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(withBasePath("/api/workouts/library"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          kind,
          muscleGroup: group || null,
        }),
      });
      const json = (await resp.json()) as { error?: string };
      if (!resp.ok) throw new Error(json.error || "Не сохранилось");
      setName("");
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить из библиотеки?")) return;
    setBusy(true);
    try {
      const resp = await fetch(withBasePath(`/api/workouts/library/${id}`), {
        method: "DELETE",
      });
      if (!resp.ok) {
        const json = (await resp.json()) as { error?: string };
        throw new Error(json.error || "Не удалилось");
      }
      await load(q);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        className="rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900"
        placeholder="Поиск…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <section className="rounded-2xl border border-dashed border-slate-300 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Добавить в библиотеку
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-base"
            placeholder="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {EXERCISE_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  kind === k ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {EXERCISE_KIND_LABELS[k]}
              </button>
            ))}
          </div>
          <select
            className="rounded-lg border border-slate-200 px-3 py-2 text-base"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
          >
            <option value="">Группа (необязательно)</option>
            {MUSCLE_GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !name.trim()}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => void create()}
          >
            Сохранить
          </button>
        </div>
      </section>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Загрузка…</p> : null}

      <ul className="space-y-2">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-900">{e.name}</p>
              <p className="text-xs text-slate-500">
                {EXERCISE_KIND_LABELS[e.kind]} · {e.useCount}×
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {onPick ? (
                <button
                  type="button"
                  className="text-sm font-medium text-teal-800"
                  onClick={() => onPick(e)}
                >
                  Выбрать
                </button>
              ) : null}
              <button
                type="button"
                className="text-sm text-red-600"
                disabled={busy}
                onClick={() => void remove(e.id)}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!loading && entries.length === 0 ? (
        <p className="text-sm text-slate-500">Библиотека пуста — добавьте упражнения выше.</p>
      ) : null}
    </div>
  );
}
