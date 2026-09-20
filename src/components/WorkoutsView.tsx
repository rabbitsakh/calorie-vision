"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateShort, formatDateWords } from "@/lib/dates";
import { withBasePath } from "@/lib/paths";
import {
  durationSecToMinutesInput,
  formatDistanceKm,
  formatDurationMinutes,
  formatPace,
  formatPaceClock,
  parseDistanceKm,
  parseDurationToSec,
} from "@/lib/workouts/cardio";
import {
  EXERCISE_KINDS,
  EXERCISE_KIND_LABELS,
  EXERCISE_KIND_PLACEHOLDERS,
  defaultExerciseKind,
  fieldsForKind,
  kindUsesRestTimer,
  type ExerciseKind,
} from "@/lib/workouts/exercise-kind";
import { DEFAULT_PROGRESS_RATE } from "@/lib/workouts/load";
import { MUSCLE_GROUPS, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import {
  SET_TYPES,
  SET_TYPE_LABELS,
  SET_TYPE_SHORT,
  type SetType,
} from "@/lib/workouts/set-meta";

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

type HistorySet = {
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
};

type SetDraft = {
  kg: string;
  reps: string;
  km: string;
  time: string;
  setType: SetType;
  rpe: string;
};

const EMPTY_DRAFT: SetDraft = {
  kg: "",
  reps: "",
  km: "",
  time: "",
  setType: "working",
  rpe: "",
};

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
  cardioDistanceKm: number;
  cardioDurationSec: number;
  cardioBestPaceSecPerKm: number | null;
  cardioOnly: boolean;
};

type SessionExercise = {
  id: string;
  name: string;
  kind: ExerciseKind;
  note: string | null;
  muscleGroup: string | null;
  muscleLabel: string | null;
  load: number;
  cardioDistanceKm: number;
  cardioDurationSec: number;
  cardioBestPaceSecPerKm: number | null;
  sets: Array<{
    id: string;
    weightKg: number | null;
    reps: number | null;
    distanceKm: number | null;
    durationSec: number | null;
    setType: SetType;
    completed: boolean;
    rpe: number | null;
    paceSecPerKm: number | null;
    load: number;
  }>;
  lastTime?: { date: string; kind?: ExerciseKind; sets: HistorySet[] } | null;
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
  weeklyCardioKm?: number;
  weeklyCardioSec?: number;
  suggestions: InsightSuggestion[];
  sessionCount: number;
  weekTrendPct?: number | null;
  weekCardioTrendPct?: number | null;
  monthStart?: string;
  monthEnd?: string;
  monthlyTotal?: number;
  monthlyByGroup?: Record<string, { load: number; label: string }>;
  monthlyCardioKm?: number;
  monthlyCardioSec?: number;
  monthlySessionCount?: number;
  monthTrendPct?: number | null;
  monthCardioTrendPct?: number | null;
};

type LibraryEntry = {
  id: string;
  name: string;
  kind: ExerciseKind;
  defaultMuscleGroup: string | null;
  useCount: number;
  lastUsedAt: string;
};

type RoutineSummary = {
  id: string;
  name: string;
  note: string | null;
  muscleKeys: string[];
  muscleLabels: string[];
  exerciseCount: number;
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
  kind?: string;
  topWeightKg: number;
  topReps: number;
  totalLoad: number;
  setCount: number;
  distanceKm?: number;
  durationSec?: number;
  bestPaceSecPerKm?: number | null;
};

type ChartPoint = {
  date: string;
  weight: number;
  volume: number;
  pace: number | null;
  distance: number;
  duration: number;
  reps: number;
};

type HistoryBundle = {
  points: TimelinePoint[];
  chart: ChartPoint[];
  prSummary: string | null;
  kind: string;
  topWeightDeltaKg: number | null;
  bestPaceDeltaSec: number | null;
  metric: "weight" | "volume" | "pace" | "reps" | "duration";
};

function formatTrend(pct: number | null | undefined): string | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}%`;
}

function sparklinePath(
  values: number[],
  width: number,
  height: number,
): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((v, i) => {
      const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function ExerciseSparkline({
  points,
  metric,
}: {
  points: ChartPoint[];
  metric: HistoryBundle["metric"];
}) {
  const values = points
    .map((p) => {
      if (metric === "weight") return p.weight;
      if (metric === "volume") return p.volume;
      if (metric === "pace") return p.pace ?? 0;
      if (metric === "reps") return p.reps;
      return p.duration;
    })
    .filter((v) => Number.isFinite(v) && (metric === "pace" ? v > 0 : true));
  if (values.length < 2) {
    return <p className="mt-2 text-xs text-slate-400">Мало точек для графика</p>;
  }
  const w = 240;
  const h = 56;
  const d = sparklinePath(values, w, h);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-14 w-full max-w-xs" aria-hidden>
      <path d={d} fill="none" stroke="var(--accent, #0f766e)" strokeWidth="2" />
    </svg>
  );
}

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

function lastSetHint(lastTime: SessionExercise["lastTime"], kind: ExerciseKind): string | null {
  if (!lastTime?.sets.length) return null;
  const parts = lastTime.sets.map((s) => formatHistoryChip(s, kind === "cardio" || lastTime.kind === "cardio" ? "cardio" : kind));
  return `Прошлый раз (${formatDateShort(lastTime.date)}): ${parts.join(", ")}`;
}

function formatHistoryChip(set: HistorySet, kind: ExerciseKind): string {
  const spec = fieldsForKind(kind);
  if (kind === "cardio") {
    const d = set.distanceKm != null && set.distanceKm > 0 ? `${formatDistanceKm(set.distanceKm)} км` : null;
    const t = set.durationSec != null && set.durationSec > 0 ? formatDurationMinutes(set.durationSec) : null;
    return [d, t].filter(Boolean).join(" / ") || "—";
  }
  if (kind === "duration") {
    return set.durationSec != null && set.durationSec > 0
      ? formatDurationMinutes(set.durationSec)
      : "—";
  }
  if (kind === "bodyweight") {
    return set.reps != null ? `${set.reps} повт` : "—";
  }
  if (spec.usesWeight && spec.usesReps) {
    const prefix = kind === "assisted" ? "−" : kind === "weighted_bw" ? "+" : "";
    return `${prefix}${set.weightKg ?? 0}×${set.reps ?? 0}`;
  }
  return "—";
}

function draftFromHistorySet(set: HistorySet, kind: ExerciseKind): SetDraft {
  const spec = fieldsForKind(kind);
  return {
    ...EMPTY_DRAFT,
    kg: spec.usesWeight && set.weightKg != null ? String(set.weightKg) : "",
    reps: spec.usesReps && set.reps != null ? String(set.reps) : "",
    km: spec.usesDistance && set.distanceKm != null && set.distanceKm > 0 ? String(set.distanceKm) : "",
    time:
      spec.usesDuration && set.durationSec != null && set.durationSec > 0
        ? durationSecToMinutesInput(set.durationSec)
        : "",
  };
}

function nextSetType(current: SetType): SetType {
  const idx = SET_TYPES.indexOf(current);
  return SET_TYPES[(idx + 1) % SET_TYPES.length]!;
}

function formatSetLine(
  s: {
    weightKg: number | null;
    reps: number | null;
    distanceKm: number | null;
    durationSec: number | null;
    paceSecPerKm?: number | null;
    load?: number;
  },
  kind: ExerciseKind,
  idx: number,
): string {
  if (kind === "cardio") {
    const d = s.distanceKm != null && s.distanceKm > 0 ? `${formatDistanceKm(s.distanceKm)} км` : null;
    const t = s.durationSec != null && s.durationSec > 0 ? formatDurationMinutes(s.durationSec) : null;
    const pace = formatPace(s.paceSecPerKm);
    return `${idx + 1}. ${[d, t, pace].filter(Boolean).join(" · ") || "—"}`;
  }
  if (kind === "duration") {
    const t = s.durationSec != null && s.durationSec > 0 ? formatDurationMinutes(s.durationSec) : "—";
    return `${idx + 1}. ${t}`;
  }
  if (kind === "bodyweight") {
    return `${idx + 1}. ${s.reps ?? 0} повт`;
  }
  if (kind === "assisted") {
    return `${idx + 1}. −${s.weightKg ?? 0} кг × ${s.reps ?? 0}`;
  }
  if (kind === "weighted_bw") {
    return `${idx + 1}. +${s.weightKg ?? 0} кг × ${s.reps ?? 0}`;
  }
  return `${idx + 1}. ${s.weightKg ?? 0} кг × ${s.reps ?? 0}`;
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
  const [setDrafts, setSetDrafts] = useState<Record<string, SetDraft>>({});
  const [newExerciseKind, setNewExerciseKind] = useState<ExerciseKind>("strength");
  const [pasteText, setPasteText] = useState("");
  const [insights, setInsights] = useState<Insights | null>(null);
  const [routines, setRoutines] = useState<RoutineSummary[]>([]);
  const [libraryHits, setLibraryHits] = useState<LibraryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState<Record<string, boolean>>({});
  const [historyByName, setHistoryByName] = useState<Record<string, HistoryBundle>>({});

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

  const loadRoutines = useCallback(async () => {
    try {
      const data = await readJson<{ routines: RoutineSummary[] }>(
        await fetch(withBasePath("/api/workouts/routines")),
      );
      setRoutines(data.routines);
    } catch {
      /* non-fatal */
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
      setNewExerciseKind(defaultExerciseKind(data.session.muscleKeys));
      setSetDrafts((prev) => {
        const next = { ...prev };
        for (const ex of data.session.exercises) {
          const cur = next[ex.id];
          if (cur && (cur.kg || cur.reps || cur.km || cur.time)) continue;
          const last = ex.lastTime?.sets?.at(-1);
          if (last) {
            next[ex.id] = draftFromHistorySet(last, ex.kind);
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
    void loadRoutines();
  }, [loadList, loadInsights, loadRoutines]);

  useEffect(() => {
    if (detail?.muscleKeys?.length) {
      void loadInsights(detail.muscleKeys);
    }
  }, [detail?.id, detail?.muscleKeys, loadInsights]);

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

  useEffect(() => {
    const q = exerciseName.trim();
    if (q.length < 1) {
      setLibraryHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await readJson<{ entries: LibraryEntry[] }>(
            await fetch(
              withBasePath(`/api/workouts/library?q=${encodeURIComponent(q)}&limit=8`),
              { signal: ctrl.signal },
            ),
          );
          setLibraryHits(data.entries);
        } catch {
          /* ignore */
        }
      })();
    }, 180);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [exerciseName]);

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

  const startRoutine = async (routineId: string) => {
    setError(null);
    setBusy(true);
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/routines/${routineId}/start`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: todayKey, copySets: true }),
        }),
      );
      await loadList();
      await openSession(data.session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать шаблон");
    } finally {
      setBusy(false);
    }
  };

  const saveAsRoutine = async (sourceId: string, suggestedName?: string) => {
    const name = window.prompt("Название шаблона", suggestedName ?? "");
    if (name == null) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Укажите название шаблона");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await readJson<{ routine: RoutineSummary }>(
        await fetch(withBasePath(`/api/workouts/${sourceId}/save-routine`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, includeSets: true }),
        }),
      );
      await loadRoutines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить шаблон");
    } finally {
      setBusy(false);
    }
  };

  const deleteRoutine = async (routineId: string) => {
    if (!window.confirm("Удалить шаблон?")) return;
    setError(null);
    try {
      await readJson<{ ok: boolean }>(
        await fetch(withBasePath(`/api/workouts/routines/${routineId}`), {
          method: "DELETE",
        }),
      );
      await loadRoutines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
    }
  };

  const refreshDetail = async (session: SessionDetail) => {
    setDetail(session);
    const data = await readJson<{ session: SessionDetail; progress: Progress }>(
      await fetch(withBasePath(`/api/workouts/${session.id}`)),
    );
    setDetail(data.session);
    setProgress(data.progress);
    setNewExerciseKind(defaultExerciseKind(data.session.muscleKeys));
    setSetDrafts((prev) => {
      const next = { ...prev };
      for (const ex of data.session.exercises) {
        const cur = next[ex.id];
        if (cur && (cur.kg || cur.reps || cur.km || cur.time)) continue;
        const last = ex.lastTime?.sets?.at(-1);
        if (last) {
          next[ex.id] = draftFromHistorySet(last, ex.kind);
        }
      }
      return next;
    });
    await loadList();
  };

  const addExercise = async (nameOverride?: string, kindOverride?: ExerciseKind) => {
    if (!detail) return;
    const name = (nameOverride ?? exerciseName).trim();
    if (!name) return;
    setError(null);
    try {
      const kind = kindOverride ?? newExerciseKind;
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/${detail.id}/exercises`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, kind }),
        }),
      );
      setExerciseName("");
      setLibraryHits([]);
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
    const ex = detail.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const draft = setDrafts[exerciseId] ?? EMPTY_DRAFT;
    const spec = fieldsForKind(ex.kind);
    const rpeRaw = draft.rpe.trim() ? Number(draft.rpe.replace(",", ".")) : null;
    const meta = {
      setType: draft.setType,
      completed: true,
      ...(rpeRaw != null && Number.isFinite(rpeRaw) ? { rpe: rpeRaw } : {}),
    };
    setError(null);
    try {
      const body: Record<string, unknown> = { ...meta };
      if (spec.usesDistance) {
        const distanceKm = parseDistanceKm(draft.km || "0");
        if (distanceKm === null) {
          setError("Укажите км");
          return;
        }
        body.distanceKm = distanceKm;
      }
      if (spec.usesDuration) {
        const durationSec = parseDurationToSec(draft.time);
        if (durationSec === null) {
          setError(ex.kind === "duration" ? "Укажите время в минутах" : "Укажите время в минутах");
          return;
        }
        body.durationSec = durationSec;
      }
      if (spec.usesWeight) {
        const weightKg = Number(draft.kg.replace(",", "."));
        if (!Number.isFinite(weightKg) || weightKg < 0) {
          setError("Укажите кг");
          return;
        }
        body.weightKg = weightKg;
      }
      if (spec.usesReps) {
        const reps = Number(draft.reps);
        if (!Number.isFinite(reps) || reps <= 0) {
          setError("Укажите повторения");
          return;
        }
        body.reps = reps;
      }

      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/exercises/${exerciseId}/sets`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      setSetDrafts((prev) => ({
        ...prev,
        [exerciseId]: {
          ...EMPTY_DRAFT,
          kg: spec.usesWeight ? draft.kg : "",
          km: spec.usesDistance ? draft.km : "",
          setType: draft.setType,
        },
      }));
      if (kindUsesRestTimer(ex.kind) && draft.setType !== "warmup") startRest();
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось добавить подход");
    }
  };

  const patchSet = async (setId: string, body: Record<string, unknown>, startTimer = false) => {
    if (!detail) return;
    setError(null);
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/sets/${setId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      if (startTimer) startRest();
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить подход");
    }
  };

  const toggleSetCompleted = async (set: SessionExercise["sets"][number]) => {
    const next = !set.completed;
    await patchSet(set.id, { completed: next }, next && set.setType !== "warmup");
  };

  const cycleSetType = async (set: SessionExercise["sets"][number]) => {
    await patchSet(set.id, { setType: nextSetType(set.setType) });
  };

  const editSetInline = async (ex: SessionExercise, set: SessionExercise["sets"][number]) => {
    const spec = fieldsForKind(ex.kind);
    const body: Record<string, unknown> = {};

    if (spec.usesDistance) {
      const km = window.prompt("Дистанция, км", set.distanceKm != null ? String(set.distanceKm) : "");
      if (km == null) return;
      const distanceKm = parseDistanceKm(km);
      if (distanceKm == null) {
        setError("Некорректные км");
        return;
      }
      body.distanceKm = distanceKm;
    }
    if (spec.usesDuration) {
      const mins = window.prompt(
        "Время, мин",
        set.durationSec != null ? String(Math.round((set.durationSec / 60) * 10) / 10) : "",
      );
      if (mins == null) return;
      const durationSec = parseDurationToSec(mins);
      if (durationSec == null) {
        setError("Некорректные минуты");
        return;
      }
      body.durationSec = durationSec;
    }
    if (spec.usesWeight) {
      const label =
        ex.kind === "assisted" ? "Помощь, кг" : ex.kind === "weighted_bw" ? "Доп. вес, кг" : "Вес, кг";
      const kg = window.prompt(label, set.weightKg != null ? String(set.weightKg) : "");
      if (kg == null) return;
      const weightKg = Number(kg.replace(",", "."));
      if (!Number.isFinite(weightKg) || weightKg < 0) {
        setError("Некорректные кг");
        return;
      }
      body.weightKg = weightKg;
    }
    if (spec.usesReps) {
      const reps = window.prompt("Повторения", set.reps != null ? String(set.reps) : "");
      if (reps == null) return;
      const repsN = Number(reps);
      if (!Number.isFinite(repsN) || repsN <= 0) {
        setError("Некорректные повторения");
        return;
      }
      body.reps = Math.floor(repsN);
    }

    if (kindUsesRestTimer(ex.kind)) {
      const rpeStr = window.prompt("RPE (1–10, пусто = без)", set.rpe != null ? String(set.rpe) : "");
      if (rpeStr == null) return;
      if (rpeStr.trim() === "") body.rpe = null;
      else {
        const rpe = Number(rpeStr.replace(",", "."));
        if (!Number.isFinite(rpe) || rpe < 1 || rpe > 10) {
          setError("RPE от 1 до 10");
          return;
        }
        body.rpe = rpe;
      }
    }

    await patchSet(set.id, body);
  };

  const moveExercise = async (exerciseId: string, move: "up" | "down") => {
    if (!detail) return;
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/exercises/${exerciseId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ move }),
        }),
      );
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось переместить");
    }
  };

  const saveExerciseNote = async (exerciseId: string, note: string) => {
    if (!detail) return;
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/exercises/${exerciseId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note.trim() || null }),
        }),
      );
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить заметку");
    }
  };

  const saveSessionNote = async (note: string) => {
    if (!detail) return;
    try {
      const data = await readJson<{ session: SessionDetail; progress: Progress }>(
        await fetch(withBasePath(`/api/workouts/${detail.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: note.trim() || null }),
        }),
      );
      setDetail(data.session);
      setProgress(data.progress);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить заметку");
    }
  };

  const applyLastSet = (exerciseId: string, set: HistorySet, kind: ExerciseKind) => {
    setSetDrafts((prev) => ({
      ...prev,
      [exerciseId]: draftFromHistorySet(set, kind),
    }));
  };

  const toggleExerciseHistory = async (name: string, kind: ExerciseKind) => {
    const open = !historyOpen[name];
    setHistoryOpen((prev) => ({ ...prev, [name]: open }));
    if (!open || historyByName[name]) return;
    try {
      const data = await readJson<{
        points: TimelinePoint[];
        chart: ChartPoint[];
        prSummary: string | null;
        kind: string;
        topWeightDeltaKg: number | null;
        bestPaceDeltaSec: number | null;
      }>(
        await fetch(
          withBasePath(`/api/workouts/exercise-history?name=${encodeURIComponent(name)}`),
        ),
      );
      const defaultMetric: HistoryBundle["metric"] =
        kind === "cardio" || data.kind === "cardio"
          ? "pace"
          : kind === "bodyweight"
            ? "reps"
            : kind === "duration"
              ? "duration"
              : "weight";
      setHistoryByName((prev) => ({
        ...prev,
        [name]: {
          points: data.points,
          chart: data.chart ?? [],
          prSummary: data.prSummary,
          kind: data.kind,
          topWeightDeltaKg: data.topWeightDeltaKg,
          bestPaceDeltaSec: data.bestPaceDeltaSec,
          metric: defaultMetric,
        },
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
    if (detail?.cardioOnly) {
      const line = [
        detail.cardioDistanceKm > 0 ? `${formatDistanceKm(detail.cardioDistanceKm)} км` : null,
        detail.cardioDurationSec > 0 ? formatDurationMinutes(detail.cardioDurationSec) : null,
        formatPace(detail.cardioBestPaceSecPerKm),
      ]
        .filter(Boolean)
        .join(" · ");
      return line || "Запишите дистанцию и время — темп посчитается сам.";
    }
    const p = progress ?? preview;
    if (!p) return null;
    if (!p.previousLoad) {
      return "Первая тренировка с этими группами — зафиксируйте базу.";
    }
    const pct = Math.round(p.progressRate * 1000) / 10;
    return `Прошлая (${p.previousDate ? formatDateShort(p.previousDate) : "—"}): ${formatLoad(p.previousLoad)} · цель +${pct}% → ${formatLoad(p.targetLoad)}`;
  }, [progress, preview, detail]);

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
          <div className="flex shrink-0 flex-col items-end gap-2">
            <button
              type="button"
              disabled={busy || detail.exercises.length === 0}
              className="text-sm font-medium text-teal-800 disabled:opacity-40"
              onClick={() =>
                void saveAsRoutine(
                  detail.id,
                  detail.note?.trim() || detail.muscleLabels.join(" · "),
                )
              }
            >
              Как шаблон
            </button>
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() => void deleteSession()}
            >
              Удалить
            </button>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          {detail.cardioOnly ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Кардио · км / мин
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
                {detail.cardioDistanceKm > 0
                  ? `${formatDistanceKm(detail.cardioDistanceKm)} км`
                  : formatDurationMinutes(detail.cardioDurationSec)}
              </p>
              {progressLine ? <p className="mt-2 text-sm text-slate-600">{progressLine}</p> : null}
            </>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Нагрузка, кг·повт
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
                {formatLoad(detail.totalLoad)}
              </p>
              {progressLine ? <p className="mt-2 text-sm text-slate-600">{progressLine}</p> : null}
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {delta ? (
                  <span
                    className={
                      progress && (progress.deltaPctVsPrevious ?? 0) >= 0
                        ? "text-teal-700"
                        : "text-slate-600"
                    }
                  >
                    к прошлой {delta}
                  </span>
                ) : null}
                {vsTarget && progress?.targetLoad ? (
                  <span className="text-slate-500">к цели {vsTarget}</span>
                ) : null}
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Заметка к тренировке
            <input
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              defaultValue={detail.note ?? ""}
              key={`note-${detail.id}-${detail.note ?? ""}`}
              placeholder="Самочувствие, зал…"
              onBlur={(e) => {
                if ((detail.note ?? "") !== e.target.value.trim()) {
                  void saveSessionNote(e.target.value);
                }
              }}
            />
          </label>
        </section>

        {!detail.cardioOnly ? (
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
            <p className="mt-1 text-xs text-slate-400">После рабочего подхода или галочки ✓.</p>
          </section>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col gap-3">
          {detail.exercises.map((ex) => {
            const draft = setDrafts[ex.id] ?? EMPTY_DRAFT;
            const hint = lastSetHint(ex.lastTime ?? null, ex.kind);
            const isCardio = ex.kind === "cardio";
            const spec = fieldsForKind(ex.kind);
            return (
              <section key={ex.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <h3 className="font-semibold text-slate-900">{ex.name}</h3>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {EXERCISE_KIND_LABELS[ex.kind]}
                      </span>
                      <button
                        type="button"
                        className="rounded px-1.5 text-xs text-slate-400 hover:bg-slate-100"
                        title="Выше"
                        onClick={() => void moveExercise(ex.id, "up")}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded px-1.5 text-xs text-slate-400 hover:bg-slate-100"
                        title="Ниже"
                        onClick={() => void moveExercise(ex.id, "down")}
                      >
                        ↓
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      {isCardio
                        ? [
                            EXERCISE_KIND_LABELS.cardio,
                            ex.cardioDistanceKm > 0
                              ? `${formatDistanceKm(ex.cardioDistanceKm)} км`
                              : null,
                            ex.cardioDurationSec > 0 ? formatDurationMinutes(ex.cardioDurationSec) : null,
                            formatPace(ex.cardioBestPaceSecPerKm),
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : [
                            ex.muscleLabel,
                            spec.countsTowardLoad ? `${formatLoad(ex.load)} кг·повт` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || EXERCISE_KIND_LABELS[ex.kind]}
                    </p>
                    {hint ? <p className="mt-1 text-xs text-teal-800">{hint}</p> : null}
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-teal-800"
                      onClick={() => void toggleExerciseHistory(ex.name, ex.kind)}
                    >
                      {historyOpen[ex.name] ? "Скрыть прогресс" : "Прогресс и PR"}
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
                        {historyByName[ex.name]!.prSummary ? (
                          <p className="mb-2 font-semibold text-teal-900">
                            {historyByName[ex.name]!.prSummary}
                          </p>
                        ) : null}
                        <div className="mb-1 flex flex-wrap gap-1">
                          {(isCardio
                            ? (["pace", "distance"] as const)
                            : ex.kind === "bodyweight"
                              ? (["reps"] as const)
                              : ex.kind === "duration"
                                ? (["duration"] as const)
                                : (["weight", "volume"] as const)
                          ).map((m) => (
                            <button
                              key={m}
                              type="button"
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                historyByName[ex.name]!.metric === m ||
                                (m === "distance" && historyByName[ex.name]!.metric === "pace")
                                  ? "bg-teal-700 text-white"
                                  : "bg-white text-slate-600"
                              }`}
                              onClick={() =>
                                setHistoryByName((prev) => ({
                                  ...prev,
                                  [ex.name]: {
                                    ...prev[ex.name]!,
                                    metric:
                                      m === "distance"
                                        ? "pace"
                                        : (m as HistoryBundle["metric"]),
                                  },
                                }))
                              }
                            >
                              {m === "weight"
                                ? "Вес"
                                : m === "volume"
                                  ? "Объём"
                                  : m === "pace"
                                    ? "Темп"
                                    : m === "distance"
                                      ? "Км"
                                      : m === "reps"
                                        ? "Повт"
                                        : "Время"}
                            </button>
                          ))}
                        </div>
                        <ExerciseSparkline
                          points={historyByName[ex.name]!.chart}
                          metric={
                            isCardio && historyByName[ex.name]!.metric === "pace"
                              ? "pace"
                              : historyByName[ex.name]!.metric
                          }
                        />
                        <ul className="mt-2 space-y-1">
                          {historyByName[ex.name]!.points.map((p) => (
                            <li
                              key={`${p.date}-${p.topWeightKg}-${p.distanceKm ?? 0}-${p.topReps}`}
                              className="flex justify-between gap-2 tabular-nums"
                            >
                              <span>{formatDateShort(p.date)}</span>
                              <span>
                                {p.kind === "cardio" || isCardio
                                  ? [
                                      p.distanceKm && p.distanceKm > 0
                                        ? `${formatDistanceKm(p.distanceKm)} км`
                                        : null,
                                      p.durationSec && p.durationSec > 0
                                        ? formatDurationMinutes(p.durationSec)
                                        : null,
                                      formatPace(p.bestPaceSecPerKm),
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")
                                  : p.kind === "bodyweight"
                                    ? `${p.topReps} повт`
                                    : p.kind === "duration"
                                      ? formatDurationMinutes(p.durationSec ?? 0)
                                      : `${p.topWeightKg}×${p.topReps}${
                                          p.totalLoad > 0 ? ` · ${formatLoad(p.totalLoad)}` : ""
                                        }`}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {isCardio && historyByName[ex.name]!.bestPaceDeltaSec != null ? (
                          <p className="mt-1 text-teal-800">
                            Темп к прошлой:{" "}
                            {historyByName[ex.name]!.bestPaceDeltaSec! > 0 ? "+" : ""}
                            {formatPaceClock(Math.abs(historyByName[ex.name]!.bestPaceDeltaSec!))}
                            /км
                            {historyByName[ex.name]!.bestPaceDeltaSec! < 0 ? " (быстрее)" : ""}
                          </p>
                        ) : null}
                        {!isCardio &&
                        spec.countsTowardLoad &&
                        historyByName[ex.name]!.topWeightDeltaKg != null ? (
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

                <label className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
                  Заметка
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900"
                    defaultValue={ex.note ?? ""}
                    key={`ex-note-${ex.id}-${ex.note ?? ""}`}
                    placeholder="Хват, амплитуда…"
                    onBlur={(e) => {
                      if ((ex.note ?? "") !== e.target.value.trim()) {
                        void saveExerciseNote(ex.id, e.target.value);
                      }
                    }}
                  />
                </label>

                <ul className="mt-3 space-y-1.5">
                  {ex.sets.map((s, idx) => (
                    <li
                      key={s.id}
                      className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${
                        s.completed ? "bg-slate-50" : "bg-amber-50/80"
                      }`}
                    >
                      <button
                        type="button"
                        title={s.completed ? "Снять выполнение" : "Отметить выполненным"}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-sm font-bold ${
                          s.completed
                            ? "border-teal-600 bg-teal-600 text-white"
                            : "border-slate-300 bg-white text-slate-400"
                        }`}
                        onClick={() => void toggleSetCompleted(s)}
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        title={SET_TYPE_LABELS[s.setType]}
                        className="shrink-0 rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700"
                        onClick={() => void cycleSetType(s)}
                      >
                        {SET_TYPE_SHORT[s.setType]}
                      </button>
                      <button
                        type="button"
                        className={`min-w-0 flex-1 text-left tabular-nums ${
                          s.completed ? "text-slate-800" : "text-slate-500"
                        }`}
                        onClick={() => void editSetInline(ex, s)}
                      >
                        {formatSetLine(s, ex.kind, idx)}
                        {s.load > 0 ? (
                          <span className="text-slate-400"> ({formatLoad(s.load)})</span>
                        ) : null}
                        {s.rpe != null ? (
                          <span className="ml-1 text-xs text-slate-400">RPE {s.rpe}</span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-xs text-slate-400 hover:text-red-600"
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
                        onClick={() => applyLastSet(ex.id, s, ex.kind)}
                      >
                        было {formatHistoryChip(s, ex.lastTime?.kind === "cardio" ? "cardio" : ex.kind)}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {spec.usesDistance ? (
                    <label className="flex flex-col gap-1 text-xs text-slate-500">
                      Км
                      <input
                        inputMode="decimal"
                        className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-900"
                        value={draft.km}
                        onChange={(e) =>
                          setSetDrafts((prev) => ({
                            ...prev,
                            [ex.id]: { ...draft, km: e.target.value },
                          }))
                        }
                      />
                    </label>
                  ) : null}
                  {spec.usesDuration ? (
                    <label className="flex flex-col gap-1 text-xs text-slate-500">
                      Мин
                      <input
                        inputMode="decimal"
                        className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-900"
                        placeholder={ex.kind === "duration" ? "1" : "30"}
                        value={draft.time}
                        onChange={(e) =>
                          setSetDrafts((prev) => ({
                            ...prev,
                            [ex.id]: { ...draft, time: e.target.value },
                          }))
                        }
                      />
                    </label>
                  ) : null}
                  {spec.usesWeight ? (
                    <label className="flex flex-col gap-1 text-xs text-slate-500">
                      {ex.kind === "assisted" ? "Помощь" : ex.kind === "weighted_bw" ? "+Кг" : "Кг"}
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
                  ) : null}
                  {spec.usesReps ? (
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
                  ) : null}
                  <button
                    type="button"
                    title={SET_TYPE_LABELS[draft.setType]}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-bold text-slate-700"
                    onClick={() =>
                      setSetDrafts((prev) => ({
                        ...prev,
                        [ex.id]: { ...draft, setType: nextSetType(draft.setType) },
                      }))
                    }
                  >
                    {SET_TYPE_SHORT[draft.setType]}
                  </button>
                  {kindUsesRestTimer(ex.kind) ? (
                    <label className="flex flex-col gap-1 text-xs text-slate-500">
                      RPE
                      <input
                        inputMode="decimal"
                        className="w-14 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-900"
                        placeholder="8"
                        value={draft.rpe}
                        onChange={(e) =>
                          setSetDrafts((prev) => ({
                            ...prev,
                            [ex.id]: { ...draft, rpe: e.target.value },
                          }))
                        }
                      />
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => void addSet(ex.id)}
                  >
                    {isCardio ? "+ Отрезок" : ex.kind === "duration" ? "+ Раунд" : "+ Подход"}
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

        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-slate-300 p-4">
          <div className="flex flex-wrap gap-1">
            {EXERCISE_KINDS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setNewExerciseKind(key)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  newExerciseKind === key
                    ? "bg-teal-700 text-white"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {EXERCISE_KIND_LABELS[key]}
              </button>
            ))}
          </div>
          <div className="relative flex flex-wrap items-end gap-2">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-slate-500">
              Упражнение
              <input
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                placeholder={EXERCISE_KIND_PLACEHOLDERS[newExerciseKind]}
                value={exerciseName}
                onChange={(e) => setExerciseName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addExercise();
                  }
                }}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
              onClick={() => void addExercise()}
            >
              Добавить
            </button>
            {libraryHits.length > 0 ? (
              <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-md">
                {libraryHits.map((hit) => (
                  <li key={hit.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-teal-50"
                      onClick={() => {
                        setNewExerciseKind(hit.kind);
                        void addExercise(hit.name, hit.kind);
                      }}
                    >
                      <span className="font-medium text-slate-900">{hit.name}</span>
                      <span className="text-xs text-slate-400">
                        {EXERCISE_KIND_LABELS[hit.kind]} · {hit.useCount}×
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
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
          Силовые: кг × повт (+5%). Кардио: км и минуты (темп).
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
            {formatTrend(insights.weekTrendPct) ? (
              <span className="ml-2 text-sm font-medium text-teal-800">
                {formatTrend(insights.weekTrendPct)} к пред.
              </span>
            ) : null}
          </p>
          {(insights.weeklyCardioKm ?? 0) > 0 ? (
            <p className="text-sm tabular-nums text-slate-700">
              Кардио {formatDistanceKm(insights.weeklyCardioKm!)} км
              {formatTrend(insights.weekCardioTrendPct) ? (
                <span className="ml-2 text-xs text-teal-800">
                  {formatTrend(insights.weekCardioTrendPct)}
                </span>
              ) : null}
            </p>
          ) : null}
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
          {insights.monthStart ? (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Месяц {insights.monthStart.slice(0, 7)}
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                {formatLoad(insights.monthlyTotal ?? 0)}{" "}
                <span className="text-sm font-normal text-slate-500">кг·повт</span>
                {formatTrend(insights.monthTrendPct) ? (
                  <span className="ml-2 text-sm font-medium text-teal-800">
                    {formatTrend(insights.monthTrendPct)}
                  </span>
                ) : null}
              </p>
              {(insights.monthlyCardioKm ?? 0) > 0 ? (
                <p className="text-sm text-slate-700">
                  Кардио {formatDistanceKm(insights.monthlyCardioKm!)} км
                </p>
              ) : null}
              <p className="text-xs text-slate-400">
                {insights.monthlySessionCount ?? 0} тренировок
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {routines.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Шаблоны
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {routines.map((r) => (
              <li
                key={r.id}
                className="flex items-stretch gap-2 rounded-xl border border-slate-100 bg-slate-50"
              >
                <button
                  type="button"
                  disabled={busy}
                  className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-white disabled:opacity-40"
                  onClick={() => void startRoutine(r.id)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{r.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {r.muscleLabels.join(" · ")} · {r.exerciseCount} упр.
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-teal-800">Старт</span>
                </button>
                <button
                  type="button"
                  className="shrink-0 border-l border-slate-100 px-2.5 text-xs text-slate-400 hover:text-red-600"
                  title="Удалить шаблон"
                  onClick={() => void deleteRoutine(r.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
            Вид / группы
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
          {!(newGroups.length === 1 && newGroups[0] === "cardio") ? (
            <>
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
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-600">
              Кардио: записывайте км и минуты — темп считается автоматически.
            </p>
          )}
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
          Пока нет тренировок. Создайте первую и отметьте вид / группы.
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
                  {s.exerciseCount} упр. · {s.setCount}{" "}
                  {s.cardioOnly ? "отр." : "подх."}
                </p>
              </div>
              <p className="text-lg font-semibold tabular-nums text-slate-900">
                {s.cardioOnly
                  ? s.cardioDistanceKm > 0
                    ? `${formatDistanceKm(s.cardioDistanceKm)} км`
                    : formatDurationMinutes(s.cardioDurationSec)
                  : formatLoad(s.totalLoad)}
              </p>
            </button>
            <button
              type="button"
              disabled={busy}
              className="shrink-0 border-l border-slate-100 px-2.5 text-xs font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-40"
              onClick={() => void repeatSession(s.id)}
            >
              Повторить
            </button>
            <button
              type="button"
              disabled={busy}
              className="shrink-0 border-l border-slate-100 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              title="Сохранить как шаблон"
              onClick={() =>
                void saveAsRoutine(s.id, s.note?.trim() || s.muscleLabels.join(" · "))
              }
            >
              Шаблон
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
