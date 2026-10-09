"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  formatDateShort,
  formatDateWords,
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
} from "@/lib/workouts/cardio";
import { validateSetDraft } from "@/lib/workouts/set-draft";
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
import { WorkoutCreateSessionPanel } from "@/components/workouts/WorkoutCreateSessionPanel";
import { WorkoutTemplatesPanel } from "@/components/workouts/WorkoutTemplatesPanel";
import { WorkoutHistoryHub } from "@/components/workouts/WorkoutHistoryHub";
import { WorkoutActiveSession } from "@/components/workouts/WorkoutActiveSession";
import { formatWorkoutLoad, formatWorkoutTrend } from "@/lib/workouts/format";
import {
  BLOCK_MODE_LABELS,
  BLOCK_MODES,
  CIRCUIT_ROUND_REST_SEC,
  REST_PAUSE_SEC,
  type BlockMode,
  parseBlockMode,
} from "@/lib/workouts/block-mode";
import {
  adviseCardioProgression,
  adviseProgression,
  autofillNextDraft,
  bumpKg,
} from "@/lib/workouts/progression";
import { markPostWorkoutNudge } from "@/lib/post-workout-nudge";
import {
  countWorkoutSetDrafts,
  enqueueWorkoutSetDraft,
  listWorkoutSetDrafts,
  removeWorkoutSetDraft,
  subscribeWorkoutSetDraftQueue,
} from "@/lib/workout-set-draft-queue";
import { isLikelyOfflineError, subscribeConnectivity } from "@/lib/connectivity";
import {
  computeExercisePrs,
  describePrBeat,
  mergeExercisePrs,
  type ExercisePrs,
} from "@/lib/workouts/prs";
import {
  getDefaultRestSec,
  readExerciseRestMap,
  resolveRestForSet,
  setExerciseRestSec,
} from "@/lib/workouts/rest-timer";
import {
  SET_TYPES,
  SET_TYPE_LABELS,
  SET_TYPE_SHORT,
  type SetType,
} from "@/lib/workouts/set-meta";
import { pickLastWorkingWeight, suggestNextWeightKg, formatSuggestedKg } from "@/lib/workouts/suggested-load";
import { requestScreenWakeLock } from "@/lib/workouts/wake-lock";

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
  /** Diary date from ?date= — may differ from calendar today. */
  selectedDate?: string;
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
  metric: "weight" | "volume" | "pace" | "reps" | "duration" | "distance";
};

const formatTrend = formatWorkoutTrend;

const formatLoad = formatWorkoutLoad;

async function readJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || "Ошибка запроса");
  }
  return data;
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

export function WorkoutsView({ todayKey, selectedDate }: WorkoutsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewDate = selectedDate && selectedDate.length >= 8 ? selectedDate : todayKey;
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queuedSets, setQueuedSets] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [creating, setCreating] = useState(false);
  /** Opened via «+» → Тренировка (`?new=1`). */
  const [fromPlusMenu, setFromPlusMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newDate, setNewDate] = useState(viewDate);
  const [newGroups, setNewGroups] = useState<MuscleGroupKey[]>([]);
  const [copyExercises, setCopyExercises] = useState(true);
  const [progressRate, setProgressRate] = useState(DEFAULT_PROGRESS_RATE);
  const [preview, setPreview] = useState<Progress | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [setDrafts, setSetDrafts] = useState<Record<string, SetDraft>>({});
  /** Per-exercise validation near draft inputs (global `error` is often scrolled away). */
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
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

  const [stageOpen, setStageOpen] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [circuitRound, setCircuitRound] = useState(1);
  const [focusExerciseId, setFocusExerciseId] = useState<string | null>(null);
  const [clockTick, setClockTick] = useState(0);
  const [hubTab, setHubTab] = useState<HubTab>("today");
  const [prToast, setPrToast] = useState<string | null>(null);
  const prToastTimer = useRef<number | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null | "new">(null);
  /** Prefill weekdays when creating a template from a day in the week plan. */
  const [newRoutineWeekdays, setNewRoutineWeekdays] = useState<number[] | null>(null);
  /** Open «План на неделю» after saving a template. */
  const [preferWeekOpen, setPreferWeekOpen] = useState(false);
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

  const openSession = useCallback(async (id: string, opts?: { enterStage?: boolean }) => {
    setError(null);
    setActiveId(id);
    try {
      const data = await readJson<{ session: SessionDetail; progress: Progress }>(
        await fetch(withBasePath(`/api/workouts/${id}`)),
      );
      setDetail(data.session);
      setProgress(data.progress);
      setNewExerciseKind(defaultExerciseKind(data.session.muscleKeys));
      // Fullscreen logger only when resuming a live clock — never on create / idle open.
      const enterStage =
        Boolean(opts?.enterStage) &&
        data.session.clockStatus !== "finished" &&
        data.session.exercises.length > 0;
      setStageOpen(enterStage);
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
          const incomplete = ex.sets.find((s) => !s.completed);
          if (incomplete) {
            const spec = fieldsForKind(ex.kind);
            next[ex.id] = {
              ...EMPTY_DRAFT,
              kg: spec.usesWeight && incomplete.weightKg != null ? String(incomplete.weightKg) : "",
              reps: spec.usesReps && incomplete.reps != null ? String(incomplete.reps) : "",
              km:
                spec.usesDistance && incomplete.distanceKm != null && incomplete.distanceKm > 0
                  ? String(incomplete.distanceKm)
                  : "",
              time:
                spec.usesDuration && incomplete.durationSec != null && incomplete.durationSec > 0
                  ? durationSecToMinutesInput(incomplete.durationSec)
                  : "",
              setType: incomplete.setType,
              rpe: incomplete.rpe != null ? String(incomplete.rpe) : "",
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
    const refresh = () => setQueuedSets(countWorkoutSetDrafts());
    refresh();
    return subscribeWorkoutSetDraftQueue(refresh);
  }, []);

  useEffect(() => {
    if (!creating) return;
    createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [creating]);

  // Keep create-form date aligned with the diary date strip.
  useEffect(() => {
    setNewDate(viewDate);
  }, [viewDate]);

  // Deep link from «+» → Тренировка (`/workouts?new=1`) — keep ?date=.
  useEffect(() => {
    if (searchParams.get("new") !== "1") return;
    setCreating(true);
    setFromPlusMenu(true);
    setHubTab("today");
    setNewDate(viewDate);
    const keepDate = searchParams.get("date");
    const next =
      keepDate && keepDate.length >= 8
        ? `/workouts?date=${keepDate}`
        : "/workouts";
    router.replace(withBasePath(next), { scroll: false });
  }, [searchParams, router, viewDate]);

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
        setStageOpen(false);
        setShowSummary(true);
        markPostWorkoutNudge();
      }
      // «Старт» only starts the clock — fullscreen «К подходам» is a separate tap.
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
        setFromPlusMenu(false);
        setNewGroups([]);
        await loadList();
        await loadCalendar();
        // Land on session list — add/check exercises, then «Старт» / «К подходам».
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
      setFromPlusMenu(false);
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
          body: JSON.stringify({ date: viewDate, copySets: true }),
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
          body: JSON.stringify({ date: viewDate, copySets: true }),
        }),
      );
      await loadList();
      // Template → session sheet (exercises visible). Fullscreen only via «К подходам».
      await openSession(data.session.id);
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

  const refreshDetail = useCallback(
    async (session: SessionDetail) => {
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
    },
    [loadList],
  );

  const flushQueuedSets = useCallback(async () => {
    const items = listWorkoutSetDrafts();
    if (items.length === 0) return;
    let saved = 0;
    let lastSession: SessionDetail | null = null;
    for (const item of items) {
      try {
        const data = await readJson<{ session: SessionDetail }>(
          await fetch(withBasePath(`/api/workouts/exercises/${item.exerciseId}/sets`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.body),
          }),
        );
        removeWorkoutSetDraft(item.id);
        saved += 1;
        lastSession = data.session;
      } catch {
        break;
      }
    }
    if (saved > 0) {
      setError(null);
      if (lastSession && detail?.id === lastSession.id) {
        await refreshDetail(lastSession);
      } else {
        void loadList();
      }
    }
  }, [detail?.id, loadList, refreshDetail]);

  useEffect(() => {
    let wasOnline = true;
    return subscribeConnectivity((next) => {
      if (next && !wasOnline) {
        void flushQueuedSets();
      }
      wasOnline = next;
    });
  }, [flushQueuedSets]);

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

  const showPrToast = useCallback((message: string) => {
    setPrToast(message);
    if (prToastTimer.current) window.clearTimeout(prToastTimer.current);
    prToastTimer.current = window.setTimeout(() => setPrToast(null), 3200);
  }, []);

  const historicalPrsFor = useCallback(
    (ex: SessionExercise): ExercisePrs | null => {
      const hist = historyByName[ex.name];
      if (!hist?.points.length) return null;
      const parts = hist.points.map((p) =>
        computeExercisePrs(hist.kind || ex.kind, [
          {
            weightKg: p.topWeightKg,
            reps: p.topReps,
            distanceKm: p.distanceKm ?? null,
            durationSec: p.durationSec ?? null,
            setType: "working",
            completed: true,
          },
        ]),
      );
      return mergeExercisePrs(parts);
    },
    [historyByName],
  );

  const maybeAnnouncePr = useCallback(
    (ex: SessionExercise, session: SessionDetail) => {
      const live = session.exercises.find((e) => e.id === ex.id) ?? ex;
      const after = computeExercisePrs(live.kind, live.sets);
      const beforeHist = historicalPrsFor(ex);
      const beforeSession = computeExercisePrs(
        ex.kind,
        ex.sets.filter((s) => s.completed),
      );
      // Compare against best of history + prior session sets
      const before = mergeExercisePrs(
        [beforeHist, beforeSession].filter(Boolean) as ExercisePrs[],
      );
      const beat = describePrBeat(before, after);
      if (beat) showPrToast(beat);
    },
    [historicalPrsFor, showPrToast],
  );

  const advanceSupersetFocus = (ex: SessionExercise, session: SessionDetail) => {
    if (!ex.supersetGroup) return;
    const group = session.exercises.filter((e) => e.supersetGroup === ex.supersetGroup);
    if (group.length < 2) return;
    const idx = group.findIndex((e) => e.id === ex.id);
    if (idx < 0) return;
    const next = group[(idx + 1) % group.length];
    if (next) setFocusExerciseId(next.id);
  };

  const startRestForExercise = (ex: SessionExercise, setType: string) => {
    if (!kindUsesRestTimer(ex.kind)) return;
    const sec = resolveRestForSet({
      setType,
      exerciseName: ex.name,
      defaultSec: restSeconds,
      restPauseSec: REST_PAUSE_SEC,
    });
    if (sec > 0) startRest(sec);
  };

  const clearDraftError = (exerciseId: string) => {
    setDraftErrors((prev) => {
      if (!prev[exerciseId]) return prev;
      const next = { ...prev };
      delete next[exerciseId];
      return next;
    });
  };

  const patchDraft = (exerciseId: string, patch: Partial<SetDraft>) => {
    setSetDrafts((prev) => {
      const cur = prev[exerciseId] ?? EMPTY_DRAFT;
      return { ...prev, [exerciseId]: { ...cur, ...patch } };
    });
    clearDraftError(exerciseId);
  };

  const failDraft = (exerciseId: string, message: string, field: "km" | "time" | "kg" | "reps") => {
    setDraftErrors((prev) => ({ ...prev, [exerciseId]: message }));
    // Keep global error for stage/list header, but focus the local field.
    setError(message);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(
        `[data-draft-field="${exerciseId}-${field}"]`,
      );
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  };

  const addSet = async (exerciseId: string, draftOverride?: SetDraft) => {
    if (!detail) return;
    const ex = detail.exercises.find((e) => e.id === exerciseId);
    if (!ex) return;
    const draft = draftOverride ?? setDrafts[exerciseId] ?? EMPTY_DRAFT;
    const spec = fieldsForKind(ex.kind);
    const rpeRaw = draft.rpe.trim() ? Number(draft.rpe.replace(",", ".")) : null;
    const meta = {
      setType: draft.setType,
      completed: true,
      ...(rpeRaw != null && Number.isFinite(rpeRaw) ? { rpe: rpeRaw } : {}),
    };
    setError(null);
    clearDraftError(exerciseId);
    const validated = validateSetDraft(ex.kind, draft);
    if (!validated.ok) {
      failDraft(exerciseId, validated.message, validated.field);
      return;
    }
    const body: Record<string, unknown> = { ...meta, ...validated.body };
    try {
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
          setType: draft.setType === "rest_pause" ? "working" : draft.setType,
        },
      }));
      clearDraftError(exerciseId);
      startRestForExercise(ex, draft.setType);
      await refreshDetail(data.session);
      const updated = data.session.exercises.find((e) => e.id === exerciseId);
      const newSetId = updated?.sets.at(-1)?.id ?? "";
      maybeAnnouncePr(ex, data.session);
      advanceSupersetFocus(ex, data.session);
      if (newSetId) bumpCircuitIfNeeded(ex, newSetId, data.session);
    } catch (err) {
      if (isLikelyOfflineError(err)) {
        enqueueWorkoutSetDraft({
          sessionId: detail.id,
          exerciseId,
          body,
        });
        setSetDrafts((prev) => ({
          ...prev,
          [exerciseId]: {
            ...EMPTY_DRAFT,
            kg: spec.usesWeight ? draft.kg : "",
            km: spec.usesDistance ? draft.km : "",
            setType: draft.setType === "rest_pause" ? "working" : draft.setType,
          },
        }));
        clearDraftError(exerciseId);
        const queued = "Подход сохранён на устройстве — отправим при связи с сервером";
        setDraftErrors((prev) => ({ ...prev, [exerciseId]: queued }));
        setError(queued);
        return;
      }
      const message = err instanceof Error ? err.message : "Не удалось добавить подход";
      setDraftErrors((prev) => ({ ...prev, [exerciseId]: message }));
      setError(message);
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
    await patchSet(set.id, { completed: next }, false);
    if (next && detail) {
      const ex = detail.exercises.find((e) => e.sets.some((s) => s.id === set.id));
      if (ex) {
        startRestForExercise(ex, set.setType);
        const setsAfter = ex.sets.map((s) =>
          s.id === set.id ? { ...s, completed: true } : s,
        );
        applyAutofillAfterComplete(ex, setsAfter, detail.progressRate);
        const sessionAfter: SessionDetail = {
          ...detail,
          exercises: detail.exercises.map((e) =>
            e.id === ex.id ? { ...e, sets: setsAfter } : e,
          ),
        };
        maybeAnnouncePr(ex, sessionAfter);
        bumpCircuitIfNeeded(ex, set.id, detail);
      }
    }
  };

  const focusExForStage = detail?.exercises.find((e) => e.id === focusExerciseId) ?? detail?.exercises[0];
  const stageAdvice = useMemo(() => {
    if (!detail || !focusExForStage) return null;
    if (focusExForStage.kind === "cardio") {
      const prevPace =
        focusExForStage.lastTime?.sets
          ?.map((s) =>
            s.durationSec && s.distanceKm && s.distanceKm > 0
              ? s.durationSec / s.distanceKm
              : null,
          )
          .filter((p): p is number => p != null && p > 0)
          .sort((a, b) => a - b)[0] ?? null;
      return adviseCardioProgression({
        lastDistanceKm: focusExForStage.cardioDistanceKm,
        lastDurationSec: focusExForStage.cardioDurationSec,
        previousBestPaceSecPerKm: prevPace,
      });
    }
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

  useEffect(() => {
    if (!stageOpen) return;
    let released = false;
    let handle: { release: () => Promise<void> } | null = null;
    void (async () => {
      handle = await requestScreenWakeLock();
      if (released && handle) {
        await handle.release();
      }
    })();
    return () => {
      released = true;
      void handle?.release();
    };
  }, [stageOpen]);

  const completeCurrentOnStage = async () => {
    if (!focusExForStage || !detail) return;
    const incomplete = focusExForStage.sets.find((s) => !s.completed);
    if (incomplete) {
      const patch: Record<string, unknown> = {
        completed: true,
        setType: stageDraft.setType,
      };
      if (stageDraft.rpe.trim()) {
        const rpe = Number(stageDraft.rpe.replace(",", "."));
        if (Number.isFinite(rpe)) patch.rpe = rpe;
      }
      const validated = validateSetDraft(focusExForStage.kind, stageDraft);
      if (!validated.ok) {
        failDraft(focusExForStage.id, validated.message, validated.field);
        return;
      }
      Object.assign(patch, validated.body);
      if (typeof patch.reps === "number") {
        patch.reps = Math.round(patch.reps);
      }
      // Rest handled here (patchSet startTimer=false) so we can use per-exercise duration.
      await patchSet(incomplete.id, patch, false);
      startRestForExercise(focusExForStage, stageDraft.setType);
      const setsAfter = focusExForStage.sets.map((s) =>
        s.id === incomplete.id
          ? {
              ...s,
              completed: true,
              weightKg:
                typeof patch.weightKg === "number" ? patch.weightKg : s.weightKg,
              reps: typeof patch.reps === "number" ? patch.reps : s.reps,
              distanceKm:
                typeof patch.distanceKm === "number" ? patch.distanceKm : s.distanceKm,
              durationSec:
                typeof patch.durationSec === "number" ? patch.durationSec : s.durationSec,
              setType: stageDraft.setType,
            }
          : s,
      );
      applyAutofillAfterComplete(focusExForStage, setsAfter, detail.progressRate);
      const sessionAfter: SessionDetail = {
        ...detail,
        exercises: detail.exercises.map((e) =>
          e.id === focusExForStage.id ? { ...e, sets: setsAfter } : e,
        ),
      };
      maybeAnnouncePr(focusExForStage, sessionAfter);
      advanceSupersetFocus(focusExForStage, sessionAfter);
      bumpCircuitIfNeeded(focusExForStage, incomplete.id, sessionAfter);
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
    const kgRaw = last?.weightKg ?? Number(stageDraft.kg.replace(",", "."));
    const kg = Number.isFinite(kgRaw) ? kgRaw : 0;
    const baseReps = last?.reps ?? Number(stageDraft.reps);
    const reps = Math.max(1, Math.round((Number.isFinite(baseReps) && baseReps > 0 ? baseReps : 5) * 0.5));
    const draft: SetDraft = {
      ...EMPTY_DRAFT,
      kg: String(kg),
      reps: String(reps),
      setType: "rest_pause",
    };
    setSetDrafts((prev) => ({
      ...prev,
      [focusExForStage.id]: draft,
    }));
    await addSet(focusExForStage.id, draft);
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
    clearDraftError(exerciseId);
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
      // Keep focus on a remaining exercise so list/stage never show a stale pager target.
      setFocusExerciseId((prev) => {
        if (prev !== exerciseId) return prev;
        return data.session.exercises[0]?.id ?? null;
      });
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
    return (
      <WorkoutActiveSession
        detail={detail}
        progress={progress}
        todayKey={todayKey}
        progressLine={progressLine}
        showSummary={showSummary}
        setShowSummary={setShowSummary}
        stageOpen={stageOpen}
        setStageOpen={setStageOpen}
        busy={busy}
        error={error}
        restSeconds={restSeconds}
        setRestSeconds={setRestSeconds}
        restEndsAt={restEndsAt}
        restLeft={restLeft}
        restSound={restSound}
        setRestSound={setRestSound}
        startRest={startRest}
        clearRest={clearRest}
        restOptions={REST_OPTIONS}
        liveElapsedLabel={liveElapsedLabel}
        focusExerciseId={focusExerciseId}
        setFocusExerciseId={setFocusExerciseId}
        focusExForStage={focusExForStage}
        stageAdvice={stageAdvice}
        stageSuggestedKg={stageSuggestedKg}
        stageDraft={stageDraft}
        circuitRound={circuitRound}
        prToast={prToast}
        draftErrors={draftErrors}
        setDrafts={setDrafts}
        historyByName={historyByName}
        historyOpen={historyOpen}
        setHistoryByName={setHistoryByName}
        queuedSets={queuedSets}
        insights={insights}
        libraryHits={libraryHits}
        newExerciseKind={newExerciseKind}
        setNewExerciseKind={setNewExerciseKind}
        exerciseName={exerciseName}
        setExerciseName={setExerciseName}
        pasteText={pasteText}
        setPasteText={setPasteText}
        setActiveId={setActiveId}
        setDetail={setDetail}
        setProgress={setProgress}
        loadList={loadList}
        onSummaryBackToList={() => {
          setShowSummary(false);
          setActiveId(null);
          setDetail(null);
          setProgress(null);
          clearRest();
          void loadList();
        }}
        onSummaryGoToRation={() => {
          markPostWorkoutNudge();
          setShowSummary(false);
          setActiveId(null);
          setDetail(null);
          setProgress(null);
          clearRest();
          router.push(withBasePath("/ration"));
        }}
        onOpenRation={() => router.push(withBasePath("/ration"))}
        onRememberRestOnStage={() => {
          if (!focusExForStage) return;
          setExerciseRestSec(focusExForStage.name, restSeconds);
          void fetch(withBasePath("/api/account"), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workoutPrefs: {
                defaultRestSec: getDefaultRestSec(),
                byExercise: readExerciseRestMap(),
              },
            }),
          }).catch(() => {
            // offline — local map already saved
          });
          showPrToast(`Отдых ${restSeconds}с для «${focusExForStage.name}»`);
        }}
        patchDraft={patchDraft}
        nextSetType={nextSetType}
        completeCurrentOnStage={completeCurrentOnStage}
        addAndCompleteOnStage={addAndCompleteOnStage}
        restPauseOnStage={restPauseOnStage}
        patchClock={patchClock}
        saveAsRoutine={saveAsRoutine}
        deleteSession={deleteSession}
        toggleExerciseHistory={toggleExerciseHistory}
        saveSessionNote={saveSessionNote}
        flushQueuedSets={flushQueuedSets}
        moveExercise={moveExercise}
        setExerciseBlockMode={setExerciseBlockMode}
        linkExerciseSuperset={linkExerciseSuperset}
        clearExerciseSuperset={clearExerciseSuperset}
        saveExerciseNote={saveExerciseNote}
        toggleSetCompleted={toggleSetCompleted}
        cycleSetType={cycleSetType}
        saveSetFields={saveSetFields}
        deleteSet={deleteSet}
        deleteExercise={deleteExercise}
        applyLastSet={applyLastSet}
        addSet={addSet}
        addExercise={addExercise}
        applyPasteLog={applyPasteLog}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {editingRoutineId !== null ? (
        <WorkoutRoutineEditor
          routineId={editingRoutineId === "new" ? null : editingRoutineId}
          initialWeekdays={editingRoutineId === "new" ? newRoutineWeekdays ?? undefined : undefined}
          onClose={() => {
            setEditingRoutineId(null);
            setNewRoutineWeekdays(null);
          }}
          onSaved={() => {
            setEditingRoutineId(null);
            setNewRoutineWeekdays(null);
            void loadRoutines();
            setHubTab("today");
            setPreferWeekOpen(true);
          }}
        />
      ) : (
        <>
      {/* D5: thin hub — Сегодня | Ещё (parity with stats period tabs). */}
      <div className="cv-segment-tabs cv-segment-tabs--2" role="tablist" aria-label="Раздел зала">
        {(
          [
            ["today", "Сегодня"],
            ["more", "Ещё"],
          ] as const
        ).map(([id, label]) => {
          const active =
            id === "today" ? hubTab === "today" : hubTab !== "today";
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (id === "today") {
                  setHubTab("today");
                  setFilterPeriod("all");
                  setFilterDate(null);
                } else if (hubTab === "today") {
                  setHubTab("history");
                }
              }}
              className={`chip min-h-9 ${active ? "chip-active" : ""}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {hubTab !== "today" ? (
        <div className="cv-segment-tabs cv-segment-tabs--3" role="tablist" aria-label="Ещё в зале">
          {(
            [
              ["history", "История"],
              ["templates", "Шаблоны"],
              ["library", "Библиотека"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={hubTab === id}
              onClick={() => setHubTab(id)}
              className={`chip min-h-9 ${hubTab === id ? "chip-active" : ""}`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {creating ? (
        <WorkoutCreateSessionPanel
          formRef={createFormRef}
          fromPlusMenu={fromPlusMenu}
          busy={busy}
          newDate={newDate}
          newGroups={newGroups}
          progressRate={progressRate}
          copyExercises={copyExercises}
          progressLine={progressLine}
          hasPreviousSession={Boolean(preview?.previousSessionId)}
          onDateChange={setNewDate}
          onToggleGroup={toggleGroup}
          onProgressRateChange={setProgressRate}
          onCopyExercisesChange={setCopyExercises}
          onCreate={() => void createSession()}
          onCancel={() => {
            setCreating(false);
            setFromPlusMenu(false);
          }}
          onGoRation={() =>
            router.push(withBasePath(`/ration?date=${viewDate}`))
          }
        />
      ) : null}

      {hubTab === "today" ? (
        <WorkoutWeekPlan
          todayKey={viewDate}
          busy={busy}
          firstWorkout={sessions.length === 0}
          sessions={sessions
            .filter((s) => s.date === viewDate)
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
              // Resume live logger only for an in-progress clock.
              if (s?.clockStatus === "running" || s?.clockStatus === "paused") {
                await openSession(id, { enterStage: true });
                return;
              }
              await openSession(id);
              if (s?.clockStatus === "finished") setShowSummary(true);
            })();
          }}
          onStartBlank={() => {
            setCreating(true);
            setNewDate(viewDate);
          }}
          onStartRoutine={(id) => void startRoutine(id)}
          preferWeekOpen={preferWeekOpen}
          onEditRoutine={(id) => setEditingRoutineId(id)}
          onCreatePlanDay={(weekday) => {
            setNewRoutineWeekdays(
              weekday != null && Number.isFinite(weekday) ? [weekday] : null,
            );
            setEditingRoutineId("new");
          }}
          onGoTemplates={() => setHubTab("templates")}
        />
      ) : null}

      {hubTab === "library" ? <WorkoutLibraryPanel /> : null}

      {hubTab === "templates" ? (
        <WorkoutTemplatesPanel
          routines={routines}
          busy={busy}
          onCreateNew={() => setEditingRoutineId("new")}
          onStart={(id) => void startRoutine(id)}
          onEdit={(id) => setEditingRoutineId(id)}
          onDelete={(id) => void deleteRoutine(id)}
        />
      ) : null}

      {hubTab === "history" ? (
        <WorkoutHistoryHub
          todayKey={todayKey}
          sessions={sessions}
          loading={loading}
          error={error}
          creating={creating}
          busy={busy}
          queuedSets={queuedSets}
          insights={insights}
          filterPeriod={filterPeriod}
          filterDate={filterDate}
          filterCardio={filterCardio}
          filterGroups={filterGroups}
          calYear={calYear}
          calMonth={calMonth}
          calMarked={calMarked}
          monthSummary={monthSummary}
          onNewSession={(date) => {
            setCreating(true);
            setNewDate(date);
          }}
          onCalPrev={() => {
            const n = shiftYearMonth(calYear, calMonth, -1);
            setCalYear(n.year);
            setCalMonth(n.monthIndex);
          }}
          onCalNext={() => {
            const n = shiftYearMonth(calYear, calMonth, 1);
            setCalYear(n.year);
            setCalMonth(n.monthIndex);
          }}
          onPickDay={(day) => {
            setFilterPeriod("day");
            setFilterDate(day);
            setCreating(false);
            setNewDate(day);
          }}
          onSetFilterPeriod={(key) => {
            setFilterPeriod(key);
            if (key !== "day") setFilterDate(null);
            else if (!filterDate) setFilterDate(todayKey);
          }}
          onToggleCardio={() => setFilterCardio((v) => !v)}
          onToggleGroup={(key) =>
            setFilterGroups((prev) =>
              prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
            )
          }
          onFlushQueue={() => void flushQueuedSets()}
          onOpenSession={(id) => void openSession(id)}
          onRepeat={(id) => void repeatSession(id)}
          onSaveAsRoutine={(id, name) => void saveAsRoutine(id, name)}
        />
      ) : null}
        </>
      )}
    </div>
  );
}
