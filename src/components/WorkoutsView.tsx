"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  formatDateShort,
  formatDateWords,
  formatMonthTitle,
  getMonthGrid,
  mondayOfWeek,
  shiftDateKey,
  shiftYearMonth,
} from "@/lib/dates";
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
import {
  formatSessionClock,
  sessionElapsedSec,
} from "@/lib/workouts/session-clock";
import { monthEndKey } from "@/lib/workouts/trends";
import { DEFAULT_PROGRESS_RATE } from "@/lib/workouts/load";
import { MUSCLE_GROUPS, type MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import { WorkoutInlineSetRow } from "@/components/workouts/WorkoutInlineSetRow";
import {
  useWorkoutRestTimer,
  WorkoutRestTimerBanner,
  WorkoutRestTimerControls,
} from "@/components/workouts/WorkoutRestTimer";
import { WorkoutWeekPlan } from "@/components/workouts/WorkoutWeekPlan";
import { WorkoutLibraryPanel } from "@/components/workouts/WorkoutLibraryPanel";
import { WorkoutRoutineEditor } from "@/components/workouts/WorkoutRoutineEditor";
import { WorkoutLiveStage } from "@/components/workouts/WorkoutLiveStage";
import { WorkoutSessionSummary } from "@/components/workouts/WorkoutSessionSummary";
import {
  BLOCK_MODE_LABELS,
  BLOCK_MODES,
  CIRCUIT_ROUND_REST_SEC,
  REST_PAUSE_SEC,
  type BlockMode,
  parseBlockMode,
} from "@/lib/workouts/block-mode";
import {
  adviseProgression,
  autofillNextDraft,
  bumpKg,
} from "@/lib/workouts/progression";
import {
  SET_TYPES,
  SET_TYPE_LABELS,
  SET_TYPE_SHORT,
  type SetType,
} from "@/lib/workouts/set-meta";
import { pickLastWorkingWeight, suggestNextWeightKg, formatSuggestedKg } from "@/lib/workouts/suggested-load";

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
  startedAt?: string | null;
  endedAt?: string | null;
  pausedAt?: string | null;
  pausedMs?: number;
  elapsedSec?: number;
  elapsedLabel?: string;
  clockStatus?: "idle" | "running" | "paused" | "finished";
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
  sortOrder?: number;
  supersetGroup?: string | null;
  blockMode?: BlockMode;
  circuitRounds?: number | null;
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
  weekdays?: number[];
  planLabel?: string | null;
};

type HubTab = "today" | "history" | "templates" | "library";

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

  const {
    restSeconds,
    setRestSeconds,
    restEndsAt,
    restLeft,
    restSound,
    setRestSound,
    startRest,
    clearRest,
    REST_OPTIONS,
  } = useWorkoutRestTimer();

  const [liveMode, setLiveMode] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [circuitRound, setCircuitRound] = useState(1);
  const [focusExerciseId, setFocusExerciseId] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const [hubTab, setHubTab] = useState<HubTab>("today");
  const [editingRoutineId, setEditingRoutineId] = useState<string | null | "new">(null);
  const [filterGroups, setFilterGroups] = useState<MuscleGroupKey[]>([]);
  const [filterCardio, setFilterCardio] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<"all" | "week" | "month" | "day">("all");
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [calYear, setCalYear] = useState(() => Number(todayKey.slice(0, 4)));
  const [calMonth, setCalMonth] = useState(() => Number(todayKey.slice(5, 7)) - 1);
  const [calMarked, setCalMarked] = useState<Record<string, number>>({});
  const [monthSummary, setMonthSummary] = useState<{
    sessionCount: number;
    tonnage: number;
    cardioDistanceKm: number;
  } | null>(null);
  const createFormRef = useRef<HTMLElement | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ limit: "60" });
      if (filterGroups.length) q.set("groups", filterGroups.join(","));
      if (filterCardio) q.set("cardio", "1");
      if (filterPeriod === "day" && filterDate) {
        q.set("date", filterDate);
      } else if (filterPeriod === "week") {
        const start = mondayOfWeek(todayKey);
        q.set("from", start);
        q.set("to", shiftDateKey(start, 6));
      } else if (filterPeriod === "month") {
        const ym = `${String(calYear).padStart(4, "0")}-${String(calMonth + 1).padStart(2, "0")}`;
        q.set("from", `${ym}-01`);
        q.set("to", monthEndKey(`${ym}-01`));
      }
      const data = await readJson<{ sessions: SessionSummary[] }>(
        await fetch(withBasePath(`/api/workouts?${q}`)),
      );
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [filterGroups, filterCardio, filterPeriod, filterDate, todayKey, calYear, calMonth]);

  const loadCalendar = useCallback(async () => {
    const month = `${String(calYear).padStart(4, "0")}-${String(calMonth + 1).padStart(2, "0")}`;
    try {
      const data = await readJson<{
        counts: Record<string, number>;
        summary: { sessionCount: number; tonnage: number; cardioDistanceKm: number };
      }>(await fetch(withBasePath(`/api/workouts/calendar?month=${month}`)));
      setCalMarked(data.counts);
      setMonthSummary(data.summary);
    } catch {
      setCalMarked({});
      setMonthSummary(null);
    }
  }, [calYear, calMonth]);

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
      setLiveMode(false);
      setStageOpen(false);
      setShowSummary(false);
      setCircuitRound(1);
      setFocusExerciseId(data.session.exercises[0]?.id ?? null);
      setSetDrafts((prev) => {
        const next = { ...prev };
        for (const ex of data.session.exercises) {
          const cur = next[ex.id];
          if (cur && (cur.kg || cur.reps || cur.km || cur.time)) continue;
          const fill = autofillNextDraft(ex.sets, {
            progressRate: data.session.progressRate,
          });
          if (fill) {
            next[ex.id] = {
              ...EMPTY_DRAFT,
              kg: fill.weightKg != null ? String(fill.weightKg) : "",
              reps: fill.reps != null ? String(fill.reps) : "",
              setType: (SET_TYPES.includes(fill.setType as SetType)
                ? fill.setType
                : "working") as SetType,
            };
            continue;
          }
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
    void loadCalendar();
  }, [loadList, loadInsights, loadRoutines, loadCalendar]);

  useEffect(() => {
    if (!creating) return;
    createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [creating]);

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
    if (!detail || detail.clockStatus !== "running") return;
    const id = window.setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [detail]);

  const liveElapsedLabel = useMemo(() => {
    if (!detail?.startedAt) return detail?.elapsedLabel ?? "00:00";
    void clockTick;
    const sec = sessionElapsedSec({
      startedAt: detail.startedAt,
      endedAt: detail.endedAt ?? null,
      pausedAt: detail.pausedAt ?? null,
      pausedMs: detail.pausedMs ?? 0,
    });
    return formatSessionClock(sec);
  }, [detail, clockTick]);

  const patchClock = async (clock: "start" | "pause" | "resume" | "finish") => {
    if (!detail) return;
    setError(null);
    try {
      const data = await readJson<{ session: SessionDetail; progress: Progress }>(
        await fetch(withBasePath(`/api/workouts/${detail.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clock }),
        }),
      );
      setDetail(data.session);
      setProgress(data.progress);
      if (clock === "finish") {
        setLiveMode(false);
        setStageOpen(false);
        setShowSummary(true);
      }
      if (clock === "start") {
        setLiveMode(true);
        setStageOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить таймер");
    }
  };

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
        await loadCalendar();
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
      setStageOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось начать шаблон");
    } finally {
      setBusy(false);
    }
  };

  const saveAsRoutine = async (sourceId: string, suggestedName?: string) => {
    const trimmed = (suggestedName ?? "").trim() || "Шаблон";
    setError(null);
    setBusy(true);
    try {
      const data = await readJson<{ routine: RoutineSummary }>(
        await fetch(withBasePath(`/api/workouts/${sourceId}/save-routine`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed, includeSets: true }),
        }),
      );
      await loadRoutines();
      setHubTab("templates");
      setEditingRoutineId(data.routine.id);
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

  const applyAutofillAfterComplete = (
    ex: SessionExercise,
    setsAfter: SessionExercise["sets"],
    progressRate: number,
  ) => {
    const fill = autofillNextDraft(setsAfter, { progressRate });
    if (!fill) return;
    setSetDrafts((prev) => ({
      ...prev,
      [ex.id]: {
        ...EMPTY_DRAFT,
        kg: fill.weightKg != null ? String(fill.weightKg) : "",
        reps: fill.reps != null ? String(fill.reps) : "",
        setType: (SET_TYPES.includes(fill.setType as SetType)
          ? fill.setType
          : "working") as SetType,
      },
    }));
  };

  const bumpCircuitIfNeeded = (
    ex: SessionExercise,
    completedSetId: string,
    session: SessionDetail,
  ) => {
    if (ex.blockMode !== "circuit") return;
    const group = ex.supersetGroup
      ? session.exercises.filter((e) => e.supersetGroup === ex.supersetGroup)
      : [ex];
    const groupDone = group.every((g) =>
      g.sets.every((s) => s.id === completedSetId || s.completed),
    );
    if (groupDone) {
      setCircuitRound((r) => r + 1);
      startRest(CIRCUIT_ROUND_REST_SEC);
    }
  };

  const toggleSetCompleted = async (set: SessionExercise["sets"][number]) => {
    const next = !set.completed;
    await patchSet(set.id, { completed: next }, next && set.setType !== "warmup" && set.setType !== "rest_pause");
    if (next && detail) {
      const ex = detail.exercises.find((e) => e.sets.some((s) => s.id === set.id));
      if (ex) {
        const setsAfter = ex.sets.map((s) =>
          s.id === set.id ? { ...s, completed: true } : s,
        );
        applyAutofillAfterComplete(ex, setsAfter, detail.progressRate);
        bumpCircuitIfNeeded(ex, set.id, detail);
      }
    }
  };

  const focusExForStage = detail?.exercises.find((e) => e.id === focusExerciseId) ?? detail?.exercises[0];
  const stageAdvice = useMemo(() => {
    if (!detail || !focusExForStage) return null;
    const hist = historyByName[focusExForStage.name];
    const points =
      hist?.points.map((p) => ({
        date: p.date,
        topWeightKg: p.topWeightKg,
        topReps: p.topReps,
        totalLoad: p.totalLoad,
      })) ?? [];
    const lastKg = pickLastWorkingWeight([
      ...(focusExForStage.lastTime?.sets ?? []).map((s) => ({
        weightKg: s.weightKg,
        setType: "working" as const,
        completed: true,
      })),
      ...focusExForStage.sets,
    ]);
    return adviseProgression(points, detail.progressRate, lastKg);
  }, [detail, focusExForStage, historyByName]);

  const stageSuggestedKg =
    stageAdvice?.suggestedKg ??
    (focusExForStage
      ? suggestNextWeightKg(
          pickLastWorkingWeight(focusExForStage.sets),
          detail?.progressRate ?? 0.05,
        )
      : null);

  const stageDraft = focusExForStage
    ? setDrafts[focusExForStage.id] ?? EMPTY_DRAFT
    : EMPTY_DRAFT;

  const completeCurrentOnStage = async () => {
    if (!focusExForStage || !detail) return;
    const incomplete = focusExForStage.sets.find((s) => !s.completed);
    if (incomplete) {
      const kg = Number(stageDraft.kg.replace(",", "."));
      const reps = Number(stageDraft.reps);
      const patch: Record<string, unknown> = { completed: true };
      if (fieldsForKind(focusExForStage.kind).usesWeight && Number.isFinite(kg)) {
        patch.weightKg = kg;
      }
      if (fieldsForKind(focusExForStage.kind).usesReps && Number.isFinite(reps) && reps > 0) {
        patch.reps = Math.round(reps);
      }
      await patchSet(
        incomplete.id,
        patch,
        incomplete.setType !== "warmup" && incomplete.setType !== "rest_pause",
      );
      const setsAfter = focusExForStage.sets.map((s) =>
        s.id === incomplete.id
          ? {
              ...s,
              completed: true,
              weightKg:
                typeof patch.weightKg === "number" ? patch.weightKg : s.weightKg,
              reps: typeof patch.reps === "number" ? patch.reps : s.reps,
            }
          : s,
      );
      applyAutofillAfterComplete(focusExForStage, setsAfter, detail.progressRate);
      bumpCircuitIfNeeded(focusExForStage, incomplete.id, detail);
      return;
    }
    await addSet(focusExForStage.id);
  };

  const addAndCompleteOnStage = async () => {
    if (!focusExForStage) return;
    await addSet(focusExForStage.id);
  };

  const restPauseOnStage = async () => {
    if (!focusExForStage || !detail) return;
    const last = [...focusExForStage.sets].reverse().find((s) => s.completed);
    const kg = last?.weightKg ?? Number(stageDraft.kg.replace(",", ".")) ?? 0;
    const reps = Math.max(1, Math.round((last?.reps ?? Number(stageDraft.reps) ?? 5) * 0.5));
    setSetDrafts((prev) => ({
      ...prev,
      [focusExForStage.id]: {
        ...EMPTY_DRAFT,
        kg: String(kg),
        reps: String(reps),
        setType: "rest_pause",
      },
    }));
    startRest(REST_PAUSE_SEC);
  };

  const setExerciseBlockMode = async (exerciseId: string, mode: BlockMode) => {
    if (!detail) return;
    const ex = detail.exercises.find((e) => e.id === exerciseId);
    const targets =
      ex?.supersetGroup
        ? detail.exercises.filter((e) => e.supersetGroup === ex.supersetGroup)
        : ex
          ? [ex]
          : [];
    const ids = targets.length > 0 ? targets.map((t) => t.id) : [exerciseId];
    try {
      let session: SessionDetail | null = null;
      for (const id of ids) {
        const data = await readJson<{ session: SessionDetail }>(
          await fetch(withBasePath(`/api/workouts/exercises/${id}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              blockMode: mode,
              circuitRounds: mode === "circuit" ? 3 : null,
            }),
          }),
        );
        session = data.session;
      }
      if (session) await refreshDetail(session);
      if (mode === "circuit") setCircuitRound(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сменить режим");
    }
  };

  const cycleSetType = async (set: SessionExercise["sets"][number]) => {
    await patchSet(set.id, { setType: nextSetType(set.setType) });
  };

  const saveSetFields = async (
    setId: string,
    patch: {
      weightKg?: number | null;
      reps?: number | null;
      distanceKm?: number | null;
      durationSec?: number | null;
      rpe?: number | null;
    },
  ) => {
    await patchSet(setId, patch);
  };

  const linkExerciseSuperset = async (exerciseId: string, otherId: string) => {
    if (!detail) return;
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/exercises/${exerciseId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ linkSupersetWith: otherId }),
        }),
      );
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось связать суперсет");
    }
  };

  const clearExerciseSuperset = async (exerciseId: string) => {
    if (!detail) return;
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/exercises/${exerciseId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ supersetGroup: null }),
        }),
      );
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось снять суперсет");
    }
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
      clearRest();
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
    const summaryExercises = detail.exercises.map((ex) => {
      const hist = historyByName[ex.name];
      return {
        name: ex.name,
        load: ex.load,
        setCount: ex.sets.length,
        completedCount: ex.sets.filter((s) => s.completed).length,
        prLine: hist?.prSummary ?? null,
        progressionKind: hist
          ? adviseProgression(
              hist.points.map((p) => ({
                date: p.date,
                topWeightKg: p.topWeightKg,
                topReps: p.topReps,
                totalLoad: p.totalLoad,
              })),
              detail.progressRate,
              pickLastWorkingWeight(ex.sets),
            ).kind
          : null,
      };
    });
    return (
      <div
        className={`flex flex-col gap-4 ${
          restEndsAt && !stageOpen ? "pt-24" : ""
        }`}
      >
        {showSummary ? (
          <WorkoutSessionSummary
            date={detail.date}
            elapsedSec={
              sessionElapsedSec({
                startedAt: detail.startedAt ?? null,
                endedAt: detail.endedAt ?? null,
                pausedAt: detail.pausedAt ?? null,
                pausedMs: detail.pausedMs ?? 0,
              })
            }
            totalLoad={detail.totalLoad}
            cardioDistanceKm={detail.cardioDistanceKm}
            cardioDurationSec={detail.cardioDurationSec}
            cardioOnly={detail.cardioOnly}
            deltaPctVsPrevious={progress?.deltaPctVsPrevious ?? null}
            deltaPctVsTarget={progress?.deltaPctVsTarget ?? null}
            previousLoad={progress?.previousLoad ?? 0}
            targetLoad={progress?.targetLoad ?? 0}
            exercises={summaryExercises}
            onClose={() => setShowSummary(false)}
            onBackToList={() => {
              setShowSummary(false);
              setActiveId(null);
              setDetail(null);
              setProgress(null);
              clearRest();
              void loadList();
            }}
          />
        ) : null}

        {stageOpen && focusExForStage ? (
          <WorkoutLiveStage
            elapsedLabel={liveElapsedLabel}
            clockStatus={detail.clockStatus ?? "idle"}
            exercises={detail.exercises.map((e) => ({
              id: e.id,
              name: e.name,
              kind: e.kind,
              supersetGroup: e.supersetGroup,
              blockMode: parseBlockMode(e.blockMode),
              circuitRounds: e.circuitRounds,
              sets: e.sets.map((s) => ({
                id: s.id,
                weightKg: s.weightKg,
                reps: s.reps,
                setType: s.setType,
                completed: s.completed,
                rpe: s.rpe,
              })),
            }))}
            focusExerciseId={focusExerciseId}
            restEndsAt={restEndsAt}
            restLeft={restLeft}
            advice={stageAdvice}
            suggestedKg={stageSuggestedKg}
            draftKg={stageDraft.kg}
            draftReps={stageDraft.reps}
            circuitRound={circuitRound}
            onDraftKg={(v) =>
              setSetDrafts((prev) => ({
                ...prev,
                [focusExForStage.id]: { ...stageDraft, kg: v },
              }))
            }
            onDraftReps={(v) =>
              setSetDrafts((prev) => ({
                ...prev,
                [focusExForStage.id]: { ...stageDraft, reps: v },
              }))
            }
            onBumpKg={(delta) => {
              const cur = Number(stageDraft.kg.replace(",", ".")) || 0;
              setSetDrafts((prev) => ({
                ...prev,
                [focusExForStage.id]: {
                  ...stageDraft,
                  kg: String(bumpKg(cur, delta)),
                },
              }));
            }}
            onApplySuggested={() => {
              if (stageSuggestedKg == null) return;
              setSetDrafts((prev) => ({
                ...prev,
                [focusExForStage.id]: {
                  ...stageDraft,
                  kg: formatSuggestedKg(stageSuggestedKg),
                },
              }));
            }}
            onCompleteCurrent={() => void completeCurrentOnStage()}
            onAddAndComplete={() => void addAndCompleteOnStage()}
            onSkipRest={clearRest}
            onPrev={() => {
              const idx = detail.exercises.findIndex((e) => e.id === focusExerciseId);
              if (idx > 0) setFocusExerciseId(detail.exercises[idx - 1]!.id);
            }}
            onNext={() => {
              const idx = detail.exercises.findIndex((e) => e.id === focusExerciseId);
              if (idx >= 0 && idx < detail.exercises.length - 1) {
                setFocusExerciseId(detail.exercises[idx + 1]!.id);
              }
            }}
            onPause={() => void patchClock("pause")}
            onResume={() => void patchClock("resume")}
            onFinish={() => void patchClock("finish")}
            onExitStage={() => setStageOpen(false)}
            onRestPause={() => void restPauseOnStage()}
            busy={busy}
          />
        ) : null}

        <div className="flex items-start justify-between gap-3">
          <div>
            <button
              type="button"
              className="text-sm font-medium text-teal-800"
              onClick={() => {
                setActiveId(null);
                setDetail(null);
                setProgress(null);
                setStageOpen(false);
                setShowSummary(false);
                clearRest();
                void loadList();
              }}
            >
              ← К списку
            </button>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              {formatDateWords(detail.date)}
              {detail.date !== todayKey ? (
                <span className="ml-2 text-sm font-medium text-amber-700">задним числом</span>
              ) : null}
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

        {detail.date === todayKey || detail.startedAt ? (
          <section className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                  Таймер тренировки
                </p>
                <p className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
                  {liveElapsedLabel}
                </p>
                <p className="text-xs text-slate-500">
                  {detail.clockStatus === "paused"
                    ? "Пауза"
                    : detail.clockStatus === "finished"
                      ? "Завершена"
                      : detail.clockStatus === "running"
                        ? "Идёт"
                        : "Не начата"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {detail.clockStatus === "idle" || !detail.startedAt ? (
                  <button
                    type="button"
                    className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => void patchClock("start")}
                  >
                    Старт
                  </button>
                ) : null}
                {detail.clockStatus !== "finished" && detail.exercises.length > 0 ? (
                  <button
                    type="button"
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => {
                      if (!detail.startedAt) void patchClock("start");
                      else {
                        setLiveMode(true);
                        setStageOpen(true);
                        if (focusExerciseId && !historyByName[focusExForStage?.name ?? ""]) {
                          void toggleExerciseHistory(
                            focusExForStage!.name,
                            focusExForStage!.kind,
                          );
                        }
                      }
                    }}
                  >
                    Зал
                  </button>
                ) : null}
                {detail.clockStatus === "finished" ? (
                  <button
                    type="button"
                    className="rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-semibold text-teal-900"
                    onClick={() => setShowSummary(true)}
                  >
                    Итог
                  </button>
                ) : null}
                {detail.clockStatus === "running" ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    onClick={() => void patchClock("pause")}
                  >
                    Пауза
                  </button>
                ) : null}
                {detail.clockStatus === "paused" ? (
                  <button
                    type="button"
                    className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
                    onClick={() => void patchClock("resume")}
                  >
                    Продолжить
                  </button>
                ) : null}
                {detail.clockStatus === "running" || detail.clockStatus === "paused" ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800"
                    onClick={() => void patchClock("finish")}
                  >
                    Финиш
                  </button>
                ) : null}
              </div>
            </div>
            {!detail.cardioOnly && detail.clockStatus !== "finished" ? (
              <WorkoutRestTimerControls
                compact
                restSeconds={restSeconds}
                setRestSeconds={setRestSeconds}
                restEndsAt={restEndsAt}
                restLeft={restLeft}
                restSound={restSound}
                setRestSound={setRestSound}
                startRest={startRest}
                clearRest={clearRest}
                options={REST_OPTIONS}
              />
            ) : null}
          </section>
        ) : null}

        {!stageOpen ? (
          <WorkoutRestTimerBanner
            restEndsAt={restEndsAt}
            restLeft={restLeft}
            onSkip={clearRest}
          />
        ) : null}

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
              className="rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900"
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

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {liveMode && detail.exercises.length > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <button
              type="button"
              className="text-sm font-medium text-teal-800 disabled:opacity-30"
              disabled={
                !focusExerciseId ||
                detail.exercises.findIndex((e) => e.id === focusExerciseId) <= 0
              }
              onClick={() => {
                const idx = detail.exercises.findIndex((e) => e.id === focusExerciseId);
                if (idx > 0) setFocusExerciseId(detail.exercises[idx - 1]!.id);
              }}
            >
              ← Пред
            </button>
            <p className="min-w-0 truncate text-center text-sm font-semibold text-slate-900">
              Сейчас:{" "}
              {detail.exercises.find((e) => e.id === focusExerciseId)?.name ??
                detail.exercises[0]?.name}
            </p>
            <button
              type="button"
              className="text-sm font-medium text-teal-800 disabled:opacity-30"
              disabled={
                !focusExerciseId ||
                detail.exercises.findIndex((e) => e.id === focusExerciseId) >=
                  detail.exercises.length - 1
              }
              onClick={() => {
                const idx = detail.exercises.findIndex((e) => e.id === focusExerciseId);
                if (idx >= 0 && idx < detail.exercises.length - 1) {
                  setFocusExerciseId(detail.exercises[idx + 1]!.id);
                }
              }}
            >
              След →
            </button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          {detail.exercises.map((ex, exIndex) => {
            const focusEx = focusExerciseId
              ? detail.exercises.find((e) => e.id === focusExerciseId)
              : null;
            if (liveMode && focusEx) {
              if (focusEx.supersetGroup) {
                if (ex.supersetGroup !== focusEx.supersetGroup) return null;
              } else if (ex.id !== focusExerciseId) {
                return null;
              }
            }
            const draft = setDrafts[ex.id] ?? EMPTY_DRAFT;
            const hint = lastSetHint(ex.lastTime ?? null, ex.kind);
            const isCardio = ex.kind === "cardio";
            const spec = fieldsForKind(ex.kind);
            const lastKg = pickLastWorkingWeight([
              ...(ex.lastTime?.sets ?? []).map((s) => ({
                weightKg: s.weightKg,
                setType: "working" as const,
                completed: true,
              })),
              ...ex.sets,
            ]);
            const suggestedKg = suggestNextWeightKg(lastKg, detail.progressRate);
            const hist = historyByName[ex.name];
            const progression = hist
              ? adviseProgression(
                  hist.points.map((p) => ({
                    date: p.date,
                    topWeightKg: p.topWeightKg,
                    topReps: p.topReps,
                    totalLoad: p.totalLoad,
                  })),
                  detail.progressRate,
                  lastKg,
                )
              : null;
            const prevEx = detail.exercises[exIndex - 1];
            return (
              <section
                key={ex.id}
                className={`rounded-2xl border bg-white p-4 ${
                  liveMode && focusExerciseId === ex.id
                    ? "border-teal-400 shadow-sm"
                    : ex.supersetGroup
                      ? "border-teal-300"
                      : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      {ex.supersetGroup ? (
                        <span className="rounded bg-teal-700 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          SS {ex.supersetGroup}
                        </span>
                      ) : null}
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
                    {suggestedKg != null && spec.usesWeight ? (
                      <p className="mt-1 text-xs font-medium text-teal-900">
                        Цель подхода: {formatSuggestedKg(
                          progression?.suggestedKg ?? suggestedKg,
                        )}{" "}
                        кг
                        {lastKg != null ? ` · было ${formatSuggestedKg(lastKg)}` : ""}
                        {progression?.kind === "stall"
                          ? " · deload"
                          : ` (+${Math.round(detail.progressRate * 1000) / 10}%)`}
                      </p>
                    ) : null}
                    {progression?.kind === "stall" ? (
                      <p className="mt-1 text-xs text-amber-800">{progression.detail}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap gap-2 text-xs">
                      {BLOCK_MODES.map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            parseBlockMode(ex.blockMode) === mode
                              ? "bg-teal-700 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                          onClick={() => void setExerciseBlockMode(ex.id, mode)}
                        >
                          {BLOCK_MODE_LABELS[mode]}
                        </button>
                      ))}
                      {prevEx ? (
                        <button
                          type="button"
                          className="font-medium text-teal-800"
                          onClick={() => void linkExerciseSuperset(ex.id, prevEx.id)}
                        >
                          + Суперсет с предыдущим
                        </button>
                      ) : null}
                      {ex.supersetGroup ? (
                        <button
                          type="button"
                          className="text-slate-500"
                          onClick={() => void clearExerciseSuperset(ex.id)}
                        >
                          Убрать из суперсета
                        </button>
                      ) : null}
                    </div>
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
                    className="rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
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

                {liveMode && ex.lastTime?.sets?.length ? (
                  <div className="mt-3 rounded-xl bg-teal-50 px-3 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
                      Прошлые подходы
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                      {ex.lastTime.sets
                        .map((s) =>
                          formatHistoryChip(
                            s,
                            ex.lastTime?.kind === "cardio" ? "cardio" : ex.kind,
                          ),
                        )
                        .join(" · ")}
                    </p>
                  </div>
                ) : null}

                <ul className="mt-3 space-y-1.5">
                  {ex.sets.map((s, idx) => (
                    <WorkoutInlineSetRow
                      key={s.id}
                      set={s}
                      kind={ex.kind}
                      index={idx}
                      suggestedKg={suggestedKg}
                      busy={busy}
                      onToggleComplete={() => void toggleSetCompleted(s)}
                      onCycleType={() => void cycleSetType(s)}
                      onSave={(patch) => saveSetFields(s.id, patch)}
                      onDelete={() => void deleteSet(s.id)}
                    />
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
                        className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
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
                        className="w-24 rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
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
                        className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
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
                        className="w-20 rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
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
                  {ex.kind !== "cardio" ? (
                    <button
                      type="button"
                      title={`${SET_TYPE_LABELS[draft.setType]} — нажмите, чтобы сменить тип`}
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
                  ) : null}
                  {kindUsesRestTimer(ex.kind) ? (
                    <label
                      className="flex flex-col gap-1 text-xs text-slate-500"
                      title="RPE — насколько тяжело было (1 легко … 10 до отказа)"
                    >
                      RPE
                      <input
                        inputMode="decimal"
                        className="w-14 rounded-lg border border-slate-200 px-2 py-2 text-base text-slate-900"
                        placeholder="8"
                        aria-label="RPE — ощущаемая тяжесть от 1 до 10"
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
                  {suggestedKg != null && spec.usesWeight ? (
                    <button
                      type="button"
                      className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-2 text-xs font-semibold text-teal-900"
                      onClick={() =>
                        setSetDrafts((prev) => ({
                          ...prev,
                          [ex.id]: { ...draft, kg: formatSuggestedKg(suggestedKg) },
                        }))
                      }
                    >
                      → {formatSuggestedKg(suggestedKg)} кг
                    </button>
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
                className="rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900"
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
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-base text-slate-900"
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
      {editingRoutineId !== null ? (
        <WorkoutRoutineEditor
          routineId={editingRoutineId === "new" ? null : editingRoutineId}
          onClose={() => setEditingRoutineId(null)}
          onSaved={() => {
            setEditingRoutineId(null);
            void loadRoutines();
            setHubTab("templates");
          }}
        />
      ) : (
        <>
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
        {(
          [
            ["today", "Сегодня"],
            ["history", "История"],
            ["templates", "Шаблоны"],
            ["library", "Библиотека"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setHubTab(id);
              if (id === "today") {
                setFilterPeriod("all");
                setFilterDate(null);
              }
            }}
            className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold ${
              hubTab === id ? "bg-white text-teal-900 shadow-sm" : "text-slate-600"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {creating ? (
        <section
          ref={createFormRef}
          className="rounded-2xl border-2 border-teal-300 bg-white p-4 shadow-sm"
        >
          <h2 className="font-semibold text-slate-900">Новая тренировка</h2>
          <label className="mt-3 flex flex-col gap-1 text-xs text-slate-500">
            Дата
            <input
              type="date"
              className="rounded-lg border border-slate-200 px-3 py-2 text-base"
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

      {hubTab === "today" ? (
        <WorkoutWeekPlan
          todayKey={todayKey}
          busy={busy}
          sessions={sessions
            .filter((s) => s.date === todayKey)
            .map((s) => ({
              id: s.id,
              muscleLabels: s.muscleLabels,
              exerciseCount: s.exerciseCount,
              setCount: s.setCount,
              totalLoad: s.totalLoad,
              cardioOnly: s.cardioOnly,
              cardioDistanceKm: s.cardioDistanceKm,
              cardioDurationSec: s.cardioDurationSec,
              clockStatus: s.clockStatus,
              elapsedLabel: s.elapsedLabel,
            }))}
          onOpenSession={(id) => {
            void (async () => {
              const s = sessions.find((x) => x.id === id);
              await openSession(id);
              if (s?.clockStatus === "finished") setShowSummary(true);
            })();
          }}
          onStartBlank={() => {
            setCreating(true);
            setNewDate(todayKey);
          }}
          onStartRoutine={(id) => void startRoutine(id)}
          onEditRoutine={(id) => setEditingRoutineId(id)}
          onGoTemplates={() => setHubTab("templates")}
        />
      ) : null}

      {hubTab === "library" ? <WorkoutLibraryPanel /> : null}

      {hubTab === "templates" ? (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
            onClick={() => setEditingRoutineId("new")}
          >
            + Новый шаблон
          </button>
          {routines.length === 0 ? (
            <p className="text-sm text-slate-500">Пока нет шаблонов.</p>
          ) : (
            <ul className="flex flex-col gap-2">
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
                      <p className="font-semibold text-slate-900">
                        {r.planLabel ? (
                          <span className="mr-1 rounded bg-teal-700 px-1.5 py-0.5 text-[10px] text-white">
                            {r.planLabel}
                          </span>
                        ) : null}
                        {r.name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {r.muscleLabels.join(" · ")} · {r.exerciseCount} упр.
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-teal-800">Старт</span>
                  </button>
                  <button
                    type="button"
                    className="shrink-0 border-l border-slate-100 px-2.5 text-xs font-semibold text-slate-600"
                    onClick={() => setEditingRoutineId(r.id)}
                  >
                    ✎
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
          )}
        </div>
      ) : null}

      {hubTab === "history" ? (
        <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Силовые: кг × повт (+5%). Кардио: км и минуты (темп).
        </p>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
          onClick={() => {
            setCreating(true);
            setNewDate(filterDate ?? todayKey);
          }}
        >
          Новая
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            onClick={() => {
              const n = shiftYearMonth(calYear, calMonth, -1);
              setCalYear(n.year);
              setCalMonth(n.monthIndex);
            }}
          >
            ←
          </button>
          <p className="text-sm font-semibold text-slate-800">
            {formatMonthTitle(calYear, calMonth)}
          </p>
          <button
            type="button"
            className="rounded-full px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
            onClick={() => {
              const n = shiftYearMonth(calYear, calMonth, 1);
              setCalYear(n.year);
              setCalMonth(n.monthIndex);
            }}
          >
            →
          </button>
        </div>
        {monthSummary ? (
          <p className="mb-2 text-xs text-slate-500">
            {monthSummary.sessionCount} трен. · {formatLoad(monthSummary.tonnage)} кг·повт
            {monthSummary.cardioDistanceKm > 0
              ? ` · ${formatDistanceKm(monthSummary.cardioDistanceKm)} км`
              : ""}
          </p>
        ) : null}
        <div className="grid grid-cols-7 gap-0.5 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {getMonthGrid(calYear, calMonth).map((day, i) => {
            if (!day) return <div key={`e-${i}`} />;
            const count = calMarked[day] ?? 0;
            const selected = filterPeriod === "day" && filterDate === day;
            return (
              <button
                key={day}
                type="button"
                className={`relative rounded-lg py-1.5 text-sm tabular-nums ${
                  selected
                    ? "bg-teal-700 font-semibold text-white"
                    : count > 0
                      ? "bg-teal-50 font-medium text-teal-900 hover:bg-teal-100"
                      : "text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => {
                  setFilterPeriod("day");
                  setFilterDate(day);
                  setCreating(false);
                  setNewDate(day);
                }}
              >
                {Number(day.slice(8, 10))}
                {count > 0 ? (
                  <span
                    className={`absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                      selected ? "bg-white" : "bg-teal-600"
                    }`}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Фильтр списка
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Все"],
              ["week", "Неделя"],
              ["month", "Месяц"],
              ["day", "День"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                filterPeriod === key ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
              }`}
              onClick={() => {
                setFilterPeriod(key);
                if (key !== "day") setFilterDate(null);
                else if (!filterDate) setFilterDate(todayKey);
              }}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              filterCardio ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
            }`}
            onClick={() => setFilterCardio((v) => !v)}
          >
            Кардио
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {MUSCLE_GROUPS.filter((g) => g.key !== "cardio").map((g) => {
            const on = filterGroups.includes(g.key);
            return (
              <button
                key={g.key}
                type="button"
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  on ? "bg-teal-700 text-white" : "bg-slate-50 text-slate-600"
                }`}
                onClick={() =>
                  setFilterGroups((prev) =>
                    on ? prev.filter((k) => k !== g.key) : [...prev, g.key],
                  )
                }
              >
                {g.label}
              </button>
            );
          })}
        </div>
      </section>

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

      {loading ? <p className="text-sm text-slate-500">Загрузка…</p> : null}

      {!loading && sessions.length === 0 && !creating ? (
        <p className="rounded-2xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-600">
          {filterPeriod !== "all" || filterGroups.length || filterCardio
            ? "Нет тренировок по фильтру."
            : "Пока нет тренировок. Создайте первую и отметьте вид / группы."}
          {filterPeriod === "day" && filterDate ? (
            <>
              {" "}
              <button
                type="button"
                className="font-semibold text-teal-800"
                onClick={() => {
                  setCreating(true);
                  setNewDate(filterDate);
                }}
              >
                Создать на {formatDateShort(filterDate)}
              </button>
            </>
          ) : null}
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
        </>
      ) : null}
        </>
      )}
    </div>
  );
}
