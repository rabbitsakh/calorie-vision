"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateShort, formatDateWords } from "@/lib/dates";
import { withBasePath } from "@/lib/paths";
import { DEFAULT_PROGRESS_RATE } from "@/lib/workouts/load";
import { MUSCLE_GROUPS, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";

type Progress = {
  previousSessionId: string | null;
  previousDate: string | null;
  previousLoad: number;
  targetLoad: number;
  progressRate: number;
  currentLoad: number;
  deltaPctVsPrevious: number | null;
  deltaPctVsTarget: number | null;
};

type HistorySet = { weightKg: number; reps: number };

type SessionSummary = {
  id: string;
  date: string;
  note: string | null;
  progressRate: number;
  muscleKeys: string[];
  muscleLabels: string[];
  exerciseCount: number;
  setCount: number;
  totalLoad: number;
  loadByGroup: Record<string, number>;
};

type SessionExercise = {
  id: string;
  name: string;
  muscleGroup: string | null;
  muscleLabel: string | null;
  load: number;
  sets: Array<{ id: string; weightKg: number; reps: number; load: number }>;
  lastTime?: { date: string; sets: HistorySet[] } | null;
};

type SessionDetail = SessionSummary & {
  exercises: SessionExercise[];
};

type WorkoutsViewProps = {
  todayKey: string;
};

type InsightSuggestion = {
  name: string;
  count: number;
  lastDate: string;
  lastSets: HistorySet[];
};

type Insights = {
  weekStart: string;
  weekEnd: string;
  weeklyTotal: number;
  weeklyByGroup: Record<string, { load: number; label: string }>;
  suggestions: InsightSuggestion[];
  sessionCount: number;
};

const REST_OPTIONS = [60, 90, 120] as const;
const RATE_OPTIONS = [
  { label: "2.5%", value: 0.025 },
  { label: "5%", value: 0.05 },
  { label: "7.5%", value: 0.075 },
  { label: "10%", value: 0.1 },
] as const;

type TimelinePoint = {
  date: string;
  topWeightKg: number;
  topReps: number;
  totalLoad: number;
  setCount: number;
};

function formatLoad(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value >= 100 ? Math.round(value).toLocaleString("ru-RU") : String(Math.round(value * 10) / 10);
}

function formatPct(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Ошибка запроса");
  }
  return data;
}

function lastSetHint(lastTime: SessionExercise["lastTime"]): string | null {
  if (!lastTime?.sets.length) return null;
  const parts = lastTime.sets.map((s) => `${s.weightKg}×${s.reps}`);
  return `Прошлый раз (${formatDateShort(lastTime.date)}): ${parts.join(", ")}`;
}

export function WorkoutsView({ todayKey }: WorkoutsViewProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newDate, setNewDate] = useState(todayKey);
  const [newGroups, setNewGroups] = useState<MuscleGroupKey[]>([]);
  const [copyExercises, setCopyExercises] = useState(true);
  const [progressRate, setProgressRate] = useState(DEFAULT_PROGRESS_RATE);
  const [preview, setPreview] = useState<Progress | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [setDrafts, setSetDrafts] = useState<Record<string, { kg: string; reps: string }>>({});
  const [pasteText, setPasteText] = useState("");
  const [insights, setInsights] = useState<Insights | null>(null);
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [historyByName, setHistoryByName] = useState<
    Record<string, { points: TimelinePoint[]; topWeightDeltaKg: number | null }>
  >({});

  const [restSeconds, setRestSeconds] = useState<number>(90);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await readJson<{ sessions: SessionSummary[] }>(
        await fetch(withBasePath("/api/workouts")),
      );
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInsights = useCallback(
    async (groups?: string[]) => {
      try {
        const q = new URLSearchParams({ weekOf: todayKey });
        if (groups?.length) q.set("groups", groups.join(","));
        const data = await readJson<Insights>(
          await fetch(withBasePath(`/api/workouts/insights?${q}`)),
        );
        setInsights(data);
      } catch {
        /* non-fatal */
      }
    },
    [todayKey],
  );

  const openSession = useCallback(async (id: string) => {
    setError(null);
    setActiveId(id);
    try {
      const data = await readJson<{ session: SessionDetail; progress: Progress }>(
        await fetch(withBasePath(`/api/workouts/${id}`)),
      );
      setDetail(data.session);
      setProgress(data.progress);
      setSetDrafts((prev) => {
        const next = { ...prev };
        for (const ex of data.session.exercises) {
          if (next[ex.id]?.kg || next[ex.id]?.reps) continue;
          const last = ex.lastTime?.sets?.at(-1);
          if (last) {
            next[ex.id] = { kg: String(last.weightKg), reps: String(last.reps) };
          }
        }
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
      setActiveId(null);
    }
  }, []);

  useEffect(() => {
    void loadList();
    void loadInsights();
  }, [loadList, loadInsights]);

  useEffect(() => {
    if (detail?.muscleKeys?.length) {
      void loadInsights(detail.muscleKeys);
    }
  }, [detail?.id, loadInsights]);

  useEffect(() => {
    if (newGroups.length === 0) {
      setPreview(null);
      return;
    }
    const q = newGroups.join(",");
    const ctrl = new AbortController();
    void (async () => {
      try {
        const data = await readJson<{ progress: Progress }>(
          await fetch(
            withBasePath(`/api/workouts/progress?groups=${encodeURIComponent(q)}&rate=${progressRate}`),
            { signal: ctrl.signal },
          ),
        );
        setPreview(data.progress);
      } catch {
        /* ignore */
      }
    })();
    return () => ctrl.abort();
  }, [newGroups, progressRate]);

  useEffect(() => {
    if (!restEndsAt) {
      setRestLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      setRestLeft(left);
      if (left <= 0) {
        setRestEndsAt(null);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate?.(40);
          } catch {
            /* ignore */
          }
        }
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [restEndsAt]);

  const startRest = useCallback(() => {
    setRestEndsAt(Date.now() + restSeconds * 1000);
  }, [restSeconds]);

  const toggleGroup = (key: MuscleGroupKey) => {
    setNewGroups((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const createSession = async () => {
    setError(null);
    setBusy(true);
    try {
      if (copyExercises && preview?.previousSessionId) {
        const data = await readJson<{ session: SessionDetail }>(
          await fetch(withBasePath(`/api/workouts/${preview.previousSessionId}/repeat`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: newDate,
              copySets: true,
              progressRate,
            }),
          }),
        );
        setCreating(false);
        setNewGroups([]);
        await loadList();
        await openSession(data.session.id);
        return;
      }

      const data = await readJson<{ session: SessionSummary; progress: Progress }>(
        await fetch(withBasePath("/api/workouts"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: newDate,
            muscleGroups: newGroups,
            progressRate,
          }),
        }),
      );
      setCreating(false);
      setNewGroups([]);
      await loadList();
      await openSession(data.session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать");
    } finally {
      setBusy(false);
    }
  };

  const repeatSession = async (sourceId: string) => {
    setError(null);
    setBusy(true);
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/${sourceId}/repeat`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: todayKey, copySets: true }),
        }),
      );
      await loadList();
      await openSession(data.session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось повторить");
    } finally {
      setBusy(false);
    }
  };

  const refreshDetail = async (session: SessionDetail) => {
    setDetail(session);
    const data = await readJson<{ session: SessionDetail; progress: Progress }>(
      await fetch(withBasePath(`/api/workouts/${session.id}`)),
    );
    setDetail(data.session);
    setProgress(data.progress);
    setSetDrafts((prev) => {
      const next = { ...prev };
      for (const ex of data.session.exercises) {
        if (next[ex.id]?.kg || next[ex.id]?.reps) continue;
        const last = ex.lastTime?.sets?.at(-1);
        if (last) {
          next[ex.id] = { kg: String(last.weightKg), reps: String(last.reps) };
        }
      }
      return next;
    });
    await loadList();
  };

  const addExercise = async (nameOverride?: string) => {
    if (!detail) return;
    const name = (nameOverride ?? exerciseName).trim();
    if (!name) return;
    setError(null);
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/${detail.id}/exercises`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }),
      );
      setExerciseName("");
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить упражнение");
    }
  };

  const applyPasteLog = async () => {
    if (!detail || !pasteText.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const parsed = await readJson<{
        blocks: Array<{ name: string; sets: HistorySet[] }>;
      }>(
        await fetch(withBasePath("/api/workouts/parse"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pasteText }),
        }),
      );

      let lastSession: SessionDetail | null = null;
      for (const block of parsed.blocks) {
        const created = await readJson<{ session: SessionDetail }>(
          await fetch(withBasePath(`/api/workouts/${detail.id}/exercises`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: block.name }),
          }),
        );
        const existingNames = new Set(
          (lastSession ?? detail).exercises.map((e) => e.id),
        );
        const ex =
          created.session.exercises.find((e) => !existingNames.has(e.id)) ??
          created.session.exercises.at(-1);
        if (!ex) {
          lastSession = created.session;
          continue;
        }
        let sessionAfter = created.session;
        for (const set of block.sets) {
          const withSet = await readJson<{ session: SessionDetail }>(
            await fetch(withBasePath(`/api/workouts/exercises/${ex.id}/sets`), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ weightKg: set.weightKg, reps: set.reps }),
            }),
          );
          sessionAfter = withSet.session;
        }
        lastSession = sessionAfter;
      }

      setPasteText("");
      if (lastSession) await refreshDetail(lastSession);
      else await openSession(detail.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось разобрать текст");
    } finally {
      setBusy(false);
    }
  };

  const addSet = async (exerciseId: string) => {
    if (!detail) return;
    const draft = setDrafts[exerciseId] ?? { kg: "", reps: "" };
    const weightKg = Number(draft.kg.replace(",", "."));
    const reps = Number(draft.reps);
    if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || reps <= 0) {
      setError("Укажите кг и повторения");
      return;
    }
    setError(null);
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/exercises/${exerciseId}/sets`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weightKg, reps }),
        }),
      );
      setSetDrafts((prev) => ({ ...prev, [exerciseId]: { kg: draft.kg, reps: "" } }));
      startRest();
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить подход");
    }
  };

  const applyLastSet = (exerciseId: string, set: HistorySet) => {
    setSetDrafts((prev) => ({
      ...prev,
      [exerciseId]: { kg: String(set.weightKg), reps: String(set.reps) },
    }));
  };

  const toggleExerciseHistory = async (name: string) => {
    const open = !historyOpen[name];
    setHistoryOpen((prev) => ({ ...prev, [name]: open }));
    if (!open || historyByName[name]) return;
    try {
      const data = await readJson<{
        points: TimelinePoint[];
        topWeightDeltaKg: number | null;
      }>(
        await fetch(
          withBasePath(`/api/workouts/exercise-history?name=${encodeURIComponent(name)}`),
        ),
      );
      setHistoryByName((prev) => ({
        ...prev,
        [name]: { points: data.points, topWeightDeltaKg: data.topWeightDeltaKg },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить историю");
    }
  };

  const deleteSet = async (setId: string) => {
    if (!detail) return;
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/sets/${setId}`), { method: "DELETE" }),
      );
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить подход");
    }
  };

  const deleteExercise = async (exerciseId: string) => {
    if (!detail) return;
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/exercises/${exerciseId}`), { method: "DELETE" }),
      );
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить упражнение");
    }
  };

  const deleteSession = async () => {
    if (!detail) return;
    if (!confirm("Удалить эту тренировку?")) return;
    try {
      await readJson(await fetch(withBasePath(`/api/workouts/${detail.id}`), { method: "DELETE" }));
      setDetail(null);
      setActiveId(null);
      setProgress(null);
      setRestEndsAt(null);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  const progressLine = useMemo(() => {
    const p = progress ?? preview;
    if (!p) return null;
    if (!p.previousLoad) {
      return "Первая тренировка с этими группами — зафиксируйте базу.";
    }
    const pct = Math.round(p.progressRate * 1000) / 10;
    return `Прошлая (${p.previousDate ? formatDateShort(p.previousDate) : "—"}): ${formatLoad(p.previousLoad)} · цель +${pct}% → ${formatLoad(p.targetLoad)}`;
  }, [progress, preview]);

  if (activeId && detail) {
    const delta = formatPct(progress?.deltaPctVsPrevious);
    const vsTarget = formatPct(progress?.deltaPctVsTarget);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              type="button"
              className="text-sm font-medium text-teal-800"
              onClick={() => {
                setActiveId(null);
                setDetail(null);
                setProgress(null);
                setRestEndsAt(null);
                void loadList();
              }}
            >
              ← К списку
            </button>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {formatDateWords(detail.date)}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{detail.muscleLabels.join(" · ")}</p>
          </div>
          <button
            type="button"
            className="text-sm text-red-600"
            onClick={() => void deleteSession()}
          >
            Удалить
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Нагрузка, кг·повт
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {formatLoad(detail.totalLoad)}
          </p>
          {progressLine ? <p className="mt-2 text-sm text-slate-600">{progressLine}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {delta ? (
              <span className={progress && (progress.deltaPctVsPrevious ?? 0) >= 0 ? "text-teal-700" : "text-slate-600"}>
                к прошлой {delta}
              </span>
            ) : null}
            {vsTarget && progress?.targetLoad ? (
              <span className="text-slate-500">к цели {vsTarget}</span>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Отдых между подходами
            </p>
            <div className="flex gap-1">
              {REST_OPTIONS.map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setRestSeconds(sec)}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    restSeconds === sec
                      ? "bg-teal-700 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {sec}с
                </button>
              ))}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <p className="text-2xl font-semibold tabular-nums text-slate-900">
              {restEndsAt ? formatRest(restLeft) : formatRest(restSeconds)}
            </p>
            {restEndsAt ? (
              <button
                type="button"
                className="text-sm text-slate-500"
                onClick={() => setRestEndsAt(null)}
              >
                Сброс
              </button>
            ) : (
              <button
                type="button"
                className="text-sm font-medium text-teal-800"
                onClick={startRest}
              >
                Старт
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">Запускается автоматически после «+ Подход».</p>
        </section>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col gap-3">
          {detail.exercises.map((ex) => {
            const draft = setDrafts[ex.id] ?? { kg: "", reps: "" };
            const hint = lastSetHint(ex.lastTime ?? null);
            return (
              <section key={ex.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-slate-900">{ex.name}</h3>
                    <p className="text-xs text-slate-500">
                      {ex.muscleLabel ? `${ex.muscleLabel} · ` : ""}
                      {formatLoad(ex.load)} кг·повт
                    </p>
                    {hint ? <p className="mt-1 text-xs text-teal-800">{hint}</p> : null}
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-teal-800"
                      onClick={() => void toggleExerciseHistory(ex.name)}
                    >
                      {historyOpen[ex.name] ? "Скрыть историю" : "История весов"}
                    </button>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-slate-400 hover:text-red-600"
                    onClick={() => void deleteExercise(ex.id)}
                  >
                    Удалить
                  </button>
                </div>

                {historyOpen[ex.name] ? (
                  <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    {!historyByName[ex.name] ? (
                      <p>Загрузка…</p>
                    ) : historyByName[ex.name]!.points.length === 0 ? (
                      <p>Пока нет прошлых записей.</p>
                    ) : (
                      <>
                        <ul className="space-y-1">
                          {historyByName[ex.name]!.points.map((p) => (
                            <li key={`${p.date}-${p.topWeightKg}`} className="flex justify-between gap-2 tabular-nums">
                              <span>{formatDateShort(p.date)}</span>
                              <span>
                                {p.topWeightKg}×{p.topReps} · {formatLoad(p.totalLoad)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {historyByName[ex.name]!.topWeightDeltaKg != null ? (
                          <p className="mt-1 text-teal-800">
                            Топ-вес к прошлой:{" "}
                            {historyByName[ex.name]!.topWeightDeltaKg! > 0 ? "+" : ""}
                            {historyByName[ex.name]!.topWeightDeltaKg} кг
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                ) : null}

                <ul className="mt-3 space-y-1.5">
                  {ex.sets.map((s, idx) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="tabular-nums text-slate-800">
                        {idx + 1}. {s.weightKg} кг × {s.reps}{" "}
                        <span className="text-slate-400">({formatLoad(s.load)})</span>
                      </span>
                      <button
                        type="button"
                        className="text-xs text-slate-400 hover:text-red-600"
                        onClick={() => void deleteSet(s.id)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>

                {ex.lastTime?.sets?.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ex.lastTime.sets.map((s, i) => (
                      <button
                        key={`${ex.id}-last-${i}`}
                        type="button"
                        className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-900"
                        onClick={() => applyLastSet(ex.id, s)}
                      >
                        было {s.weightKg}×{s.reps}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs text-slate-500">
                    Кг
                    <input
                      inputMode="decimal"
                      className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-900"
                      value={draft.kg}
                      onChange={(e) =>
                        setSetDrafts((prev) => ({
                          ...prev,
                          [ex.id]: { ...draft, kg: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-slate-500">
                    Повт.
                    <input
                      inputMode="numeric"
                      className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-900"
                      value={draft.reps}
                      onChange={(e) =>
                        setSetDrafts((prev) => ({
                          ...prev,
                          [ex.id]: { ...draft, reps: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => void addSet(ex.id)}
                  >
                    + Подход
                  </button>
                </div>
              </section>
            );
          })}
        </div>

        {insights?.suggestions?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {insights.suggestions.slice(0, 8).map((s) => (
              <button
                key={s.name}
                type="button"
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900"
                onClick={() => void addExercise(s.name)}
              >
                {s.name}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-dashed border-slate-300 p-4">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-slate-500">
            Упражнение
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              placeholder="Жим лёжа"
              value={exerciseName}
              onChange={(e) => setExerciseName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addExercise();
                }
              }}
            />
          </label>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
            onClick={() => void addExercise()}
          >
            Добавить
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Вставить текстом
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Пример: «Жим лёжа 80x8, 80x8» — по строке на упражнение. Свободный текст — через AI.
          </p>
          <textarea
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
            rows={3}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Жим лёжа 80x8, 82.5x6\nТяга блока 40x12"}
          />
          <button
            type="button"
            disabled={busy || !pasteText.trim()}
            className="mt-2 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => void applyPasteLog()}
          >
            Разобрать и добавить
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Нагрузка = кг × повторения. Цель — +5% к прошлой сессии тех же групп.
        </p>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          onClick={() => {
            setCreating(true);
            setNewDate(todayKey);
          }}
        >
          Новая
        </button>
      </div>

      {insights ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Неделя {formatDateShort(insights.weekStart)}–{formatDateShort(insights.weekEnd)}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
            {formatLoad(insights.weeklyTotal)}{" "}
            <span className="text-sm font-normal text-slate-500">кг·повт</span>
          </p>
          <p className="text-xs text-slate-400">{insights.sessionCount} тренировок</p>
          {Object.keys(insights.weeklyByGroup).length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(insights.weeklyByGroup).map(([key, g]) => (
                <span
                  key={key}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  {g.label}: {formatLoad(g.load)}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {creating ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Новая тренировка</h2>
          <label className="mt-3 flex flex-col gap-1 text-xs text-slate-500">
            Дата
            <input
              type="date"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </label>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Группы мышц
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((g) => {
              const on = newGroups.includes(g.key);
              return (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => toggleGroup(g.key)}
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
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Прогрессия к прошлой
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {RATE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProgressRate(opt.value)}
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
          {preview?.previousSessionId ? (
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={copyExercises}
                onChange={(e) => setCopyExercises(e.target.checked)}
              />
              Скопировать упражнения и подходы из прошлой
            </label>
          ) : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              disabled={newGroups.length === 0 || busy}
              onClick={() => void createSession()}
            >
              Создать
            </button>
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-slate-600"
              onClick={() => setCreating(false)}
            >
              Отмена
            </button>
          </div>
        </section>
      ) : null}

      {loading ? <p className="text-sm text-slate-500">Загрузка…</p> : null}

      {!loading && sessions.length === 0 && !creating ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
          Пока нет тренировок. Создайте первую и отметьте группы мышц.
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="flex items-stretch gap-2 rounded-2xl border border-slate-200 bg-white"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
              onClick={() => void openSession(s.id)}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900">{formatDateWords(s.date)}</p>
                <p className="truncate text-sm text-slate-600">{s.muscleLabels.join(" · ")}</p>
                <p className="text-xs text-slate-400">
                  {s.exerciseCount} упр. · {s.setCount} подх.
                </p>
              </div>
              <p className="text-lg font-semibold tabular-nums text-slate-900">
                {formatLoad(s.totalLoad)}
              </p>
            </button>
            <button
              type="button"
              disabled={busy}
              className="shrink-0 border-l border-slate-100 px-3 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-40"
              onClick={() => void repeatSession(s.id)}
            >
              Повторить
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
