"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  formatDateShort,
  mondayOfWeek,
  requireDateKey,
  shiftDateKey,
  shiftYearMonth,
} from "@/lib/dates";
import { withBasePath } from "@/lib/paths";
import {
  durationSecToMinutesInput,
  formatDistanceKm,
  formatDurationMinutes,
  formatPace,
} from "@/lib/workouts/cardio";
import { validateSetDraft } from "@/lib/workouts/set-draft";
import {
  defaultExerciseKind,
  fieldsForKind,
  kindUsesRestTimer,
  type ExerciseKind,
} from "@/lib/workouts/exercise-kind";
import {
  applyResume,
  formatSessionClock,
  sessionElapsedSec,
} from "@/lib/workouts/session-clock";
import {
  browserResumeStorage,
  pickSessionToResume,
  readWorkoutResumeId,
  shouldAdoptRemoteFinish,
  writeWorkoutResumeId,
} from "@/lib/workouts/live-session";
import { monthEndKey } from "@/lib/workouts/trends";
import { DEFAULT_PROGRESS_RATE } from "@/lib/workouts/load";
import {
  COPY_PREVIOUS_SESSION_DEFAULT,
  shouldRepeatPreviousSession,
} from "@/lib/workouts/session-create";
import { type MuscleGroupKey } from "@/lib/workouts/muscle-groups";
import type { MuscleRecoveryMap } from "@/lib/workouts/muscle-volume";
import { useWorkoutRestTimer } from "@/components/workouts/WorkoutRestTimer";
import { WorkoutWeekPlan } from "@/components/workouts/WorkoutWeekPlan";
import { WorkoutLibraryPanel } from "@/components/workouts/WorkoutLibraryPanel";
import { WorkoutRoutineEditor } from "@/components/workouts/WorkoutRoutineEditor";
import { WorkoutCreateSessionPanel } from "@/components/workouts/WorkoutCreateSessionPanel";
import { WorkoutTemplatesPanel } from "@/components/workouts/WorkoutTemplatesPanel";
import { WorkoutProgramsPanel } from "@/components/workouts/WorkoutProgramsPanel";
import type { RoutineDraft } from "@/lib/workouts/programs";
import { WorkoutHistoryHub } from "@/components/workouts/WorkoutHistoryHub";
import { WorkoutActiveSession } from "@/components/workouts/WorkoutActiveSession";
import { formatWorkoutLoad } from "@/lib/workouts/format";
import {
  CIRCUIT_ROUND_REST_SEC,
  REST_PAUSE_SEC,
  type BlockMode,
} from "@/lib/workouts/block-mode";
import { autofillNextDraft } from "@/lib/workouts/progression";
import { getLeverMemory } from "@/lib/workouts/progression-lever-memory";
import {
  countWorkingSets,
  mergeDraftWithLeverGoal,
  needsVolumeExtraSet,
  persistLeverRecoveryMemory,
  resolveLeverSessionGoal,
  shouldMutateLeverOnOpen,
  volumeExtraSetBody,
} from "@/lib/workouts/lever-session-apply";
import {
  hasLeverAppliedForSession,
  markLeverAppliedForSession,
} from "@/lib/workouts/lever-session-applied";
import { setGymQuietMode } from "@/lib/capacitor-local-reminders";
import {
  compareSetToLeverGoal,
  formatLeverSetToast,
  leverGoalFromMemory,
} from "@/lib/workouts/lever-set-feedback";
import { markPostWorkoutNudge } from "@/lib/post-workout-nudge";
import {
  countWorkoutOfflineDrafts,
  enqueueWorkoutFinishDraft,
  enqueueWorkoutSetDraft,
  listWorkoutFinishDrafts,
  listWorkoutSetDrafts,
  listWorkoutSetDraftsForSession,
  removeWorkoutFinishDraft,
  insertWorkoutSetDraftAt,
  moveWorkoutSetDraft,
  removeWorkoutSetDraft,
  removeWorkoutSetDraftsForExercise,
  subscribeWorkoutSetDraftQueue,
  updateWorkoutSetDraft,
} from "@/lib/workout-set-draft-queue";
import { clampSetIndex } from "@/lib/workouts/set-order";
import {
  addLocalWorkoutExercise,
  countLocalWorkoutSessions,
  createLocalWorkoutSession,
  getLocalWorkoutSession,
  isLocalSessionId,
  listLocalWorkoutSessions,
  localSessionToDetail,
  localSessionToSummary,
  removeLocalWorkoutSession,
  subscribeLocalWorkoutSessions,
  updateLocalWorkoutSession,
} from "@/lib/workout-local-session";
import { flushLocalWorkoutSessions } from "@/lib/workout-local-session-flush";
import {
  getCachedWorkoutRoutine,
  readWorkoutRoutinesCache,
  writeWorkoutRoutinesCache,
} from "@/lib/workout-routine-cache";
import { startRoutineOffline } from "@/lib/workouts/start-routine-offline";
import type { SerializedRoutine } from "@/lib/workouts/routines";
import {
  countWorkoutExerciseDrafts,
  enqueueWorkoutExerciseDraft,
  listWorkoutExerciseDraftsForSession,
  removeWorkoutExerciseDraft,
  subscribeWorkoutExerciseDraftQueue,
} from "@/lib/workout-exercise-draft-queue";
import { flushWorkoutExerciseDrafts } from "@/lib/workout-exercise-draft-flush";
import {
  draftIdFromLocalSetId,
  mergeQueuedExercisesIntoSession,
  mergeQueuedSetsIntoSession,
} from "@/lib/workouts/merge-queued-sets";
import {
  lastSessionRepeatHint,
  lastSessionRepeatLabel,
  pickLastFinishedSession,
  pickRecentFinishedSessions,
  sessionRepeatChoiceLabel,
} from "@/lib/workouts/last-finished-session";
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
  getExerciseRestSec,
  setExerciseRestSec,
} from "@/lib/workouts/rest-timer";
import { SET_TYPES, type SetType } from "@/lib/workouts/set-meta";
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
  endedBy?: string | null;
  /** Exercises that set a new PR in this session. */
  prCount?: number;
  prHits?: Array<{ name: string; label: string }>;
  energyLabel?: string | null;
};

type SessionExercise = {
  id: string;
  name: string;
  kind: ExerciseKind;
  note: string | null;
  catalogId?: string | null;
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
    /** Optimistic offline draft — not yet on server. */
    pendingLocal?: boolean;
  }>;
  lastTime?: { date: string; kind?: ExerciseKind; sets: HistorySet[] } | null;
};

type DeletedSetUndo = {
  exerciseId: string;
  index: number;
  weightKg: number | null;
  reps: number | null;
  distanceKm: number | null;
  durationSec: number | null;
  setType: SetType;
  completed: boolean;
  rpe: number | null;
  /** Черновик без сервера. null — подход уже был в тренировке. */
  localBody: Record<string, unknown> | null;
};

type SessionDetail = SessionSummary & {
  exercises: SessionExercise[];
};

type WorkoutsViewProps = {
  todayKey: string;
  /** Diary date from ?date= — may differ from calendar today. */
  selectedDate?: string;
  /** Bumped when OfflineMealQueueBanner flushes gym drafts. */
  queueFlushKey?: number;
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
  muscleMap?: MuscleRecoveryMap | null;
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
  estimated1Rm?: number;
  bestSetKg?: number;
  bestSetReps?: number;
  bestSetVolume?: number;
};

type HistoryBundle = {
  points: TimelinePoint[];
  chart: ChartPoint[];
  prSummary: string | null;
  kind: string;
  topWeightDeltaKg: number | null;
  bestPaceDeltaSec: number | null;
  metric: "weight" | "volume" | "pace" | "reps" | "duration" | "distance";
  linkedByCatalog?: boolean;
};

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

export function WorkoutsView({
  todayKey,
  selectedDate,
  queueFlushKey = 0,
}: WorkoutsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewDate = selectedDate && selectedDate.length >= 8 ? selectedDate : todayKey;
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(null);
  const [weightKnown, setWeightKnown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queuedSets, setQueuedSets] = useState(0);
  /** T4: brief «Ушло N» after in-gym flush (parity with ration T1). */
  const [gymFlushSummary, setGymFlushSummary] = useState<string | null>(null);
  /** Bumps on any draft queue notify so edits re-merge even when count is unchanged. */
  const [queueRev, setQueueRev] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [deletedSets, setDeletedSets] = useState<DeletedSetUndo[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [creating, setCreating] = useState(false);
  /** Opened via «+» → Тренировка (`?new=1`). */
  const [fromPlusMenu, setFromPlusMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  const [newDate, setNewDate] = useState(viewDate);
  const [newGroups, setNewGroups] = useState<MuscleGroupKey[]>([]);
  const [copyExercises, setCopyExercises] = useState(COPY_PREVIOUS_SESSION_DEFAULT);
  const [progressRate, setProgressRate] = useState(DEFAULT_PROGRESS_RATE);
  const [preview, setPreview] = useState<Progress | null>(null);
  const [exerciseName, setExerciseName] = useState("");
  const [setDrafts, setSetDrafts] = useState<Record<string, SetDraft>>({});
  /** Per-exercise validation near draft inputs (global `error` is often scrolled away). */
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [newExerciseKind, setNewExerciseKind] = useState<ExerciseKind>("strength");
  const [pasteText, setPasteText] = useState("");
  const [insights, setInsights] = useState<Insights | null>(null);
  const [routines, setRoutines] = useState<SerializedRoutine[]>(() => readWorkoutRoutinesCache());
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
    extendRest,
    clearRest,
    REST_OPTIONS,
  } = useWorkoutRestTimer();

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
  const activeIdRef = useRef<string | null>(null);
  const sessionsRef = useRef<SessionSummary[]>([]);
  const loadingRef = useRef(true);
  const dismissedLive = useRef(false);
  const restoreLock = useRef(false);
  activeIdRef.current = activeId;
  sessionsRef.current = sessions;
  loadingRef.current = loading;

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    const locals = listLocalWorkoutSessions().map(localSessionToSummary) as SessionSummary[];
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
      const data = await readJson<{ sessions: SessionSummary[]; bodyWeightKg?: number | null }>(
        await fetch(withBasePath(`/api/workouts?${q}`)),
      );
      setBodyWeightKg(
        typeof data.bodyWeightKg === "number" && data.bodyWeightKg > 0 ? data.bodyWeightKg : null,
      );
      setWeightKnown(true);
      setSessions([...locals, ...data.sessions]);
    } catch (err) {
      if (locals.length > 0) {
        setSessions(locals);
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
      }
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
      const data = await readJson<{ routines: SerializedRoutine[] }>(
        await fetch(withBasePath("/api/workouts/routines")),
      );
      setRoutines(data.routines);
      writeWorkoutRoutinesCache(data.routines);
    } catch {
      const cached = readWorkoutRoutinesCache();
      if (cached.length > 0) setRoutines(cached);
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

  const fillDraftsFromSession = useCallback((session: SessionDetail) => {
    setSetDrafts((prev) => {
      const next = { ...prev };
      for (const ex of session.exercises) {
        const cur = next[ex.id];
        if (cur && (cur.kg || cur.reps || cur.km || cur.time)) continue;
        let draft: SetDraft | null = null;
        const fill = autofillNextDraft(ex.sets, {
          progressRate: session.progressRate,
        });
        if (fill) {
          draft = {
            ...EMPTY_DRAFT,
            kg: fill.weightKg != null ? String(fill.weightKg) : "",
            reps: fill.reps != null ? String(fill.reps) : "",
            setType: (SET_TYPES.includes(fill.setType as SetType)
              ? fill.setType
              : "working") as SetType,
          };
        } else {
          const incomplete = ex.sets.find((s) => !s.completed);
          if (incomplete) {
            const spec = fieldsForKind(ex.kind);
            draft = {
              ...EMPTY_DRAFT,
              kg:
                spec.usesWeight && incomplete.weightKg != null
                  ? String(incomplete.weightKg)
                  : "",
              reps:
                spec.usesReps && incomplete.reps != null
                  ? String(incomplete.reps)
                  : "",
              km:
                spec.usesDistance &&
                incomplete.distanceKm != null &&
                incomplete.distanceKm > 0
                  ? String(incomplete.distanceKm)
                  : "",
              time:
                spec.usesDuration &&
                incomplete.durationSec != null &&
                incomplete.durationSec > 0
                  ? durationSecToMinutesInput(incomplete.durationSec)
                  : "",
              setType: incomplete.setType,
              rpe: incomplete.rpe != null ? String(incomplete.rpe) : "",
            };
          } else {
            const last = ex.sets.length === 0 ? ex.lastTime?.sets?.[0] : ex.lastTime?.sets?.[ex.sets.length];
            if (last) draft = draftFromHistorySet(last, ex.kind);
          }
        }
        if (!draft) continue;
        // H1: overlay remembered lever kg/reps onto the draft.
        const goal = resolveLeverSessionGoal({
          name: ex.name,
          kind: ex.kind,
          progressRate: session.progressRate,
          sets: ex.sets,
          lastTimeSets: ex.lastTime?.sets ?? null,
        });
        const merged = mergeDraftWithLeverGoal(draft, goal);
        next[ex.id] = { ...draft, kg: merged.kg, reps: merged.reps };
      }
      return next;
    });
  }, []);

  /**
   * H1/H2 after create/start/repeat only ({ applyLever: true }):
   * rewrite incomplete planned sets to lever targets, and for volume add +1 set.
   * Resume/reopen must never call this — goal sets would be re-appended.
   */
  const leverAppliedRef = useRef(new Set<string>());

  const applyLeverGoalsOnOpen = useCallback(async (session: SessionDetail) => {
    if (leverAppliedRef.current.has(session.id) || hasLeverAppliedForSession(session.id)) {
      return;
    }
    leverAppliedRef.current.add(session.id);
    markLeverAppliedForSession(session.id);
    if (session.clockStatus === "finished") return;
    let latest = session;
    for (const ex of session.exercises) {
      if (ex.kind === "cardio") continue;
      const liveEx = latest.exercises.find((e) => e.id === ex.id) ?? ex;
      const goal = resolveLeverSessionGoal({
        name: ex.name,
        kind: ex.kind,
        progressRate: session.progressRate,
        sets: liveEx.sets,
        lastTimeSets: ex.lastTime?.sets ?? null,
      });
      if (!goal) continue;

      // L: persist soft deload / switched lever after 2× miss.
      if (goal.recovery) {
        const basis =
          liveEx.sets.find((s) => s.weightKg != null && s.weightKg > 0)?.weightKg ??
          ex.lastTime?.sets?.find((s) => s.weightKg != null && s.weightKg > 0)?.weightKg ??
          goal.kg;
        persistLeverRecoveryMemory(ex.name, goal, basis);
      }

      // Prefill planned incomplete rows to the remembered target.
      if (!isLocalSessionId(session.id) && (goal.kg != null || goal.reps != null)) {
        for (const s of liveEx.sets) {
          if (s.completed !== false) continue;
          const t = s.setType ?? "working";
          if (t === "warmup" || t === "drop") continue;
          const nextKg = goal.kg ?? s.weightKg;
          const nextReps = goal.reps ?? s.reps;
          if (nextKg === s.weightKg && nextReps === s.reps) continue;
          try {
            const data = await readJson<{ session: SessionDetail }>(
              await fetch(withBasePath(`/api/workouts/sets/${s.id}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...(goal.kg != null ? { weightKg: goal.kg } : {}),
                  ...(goal.reps != null ? { reps: goal.reps } : {}),
                }),
              }),
            );
            latest = data.session;
            setDetail(data.session);
          } catch {
            // draft overlay still applies
          }
        }
      }

      const afterPatch = latest.exercises.find((e) => e.id === ex.id) ?? liveEx;
      const lastWorking = countWorkingSets(ex.lastTime?.sets ?? []);
      if (!needsVolumeExtraSet(afterPatch.sets, lastWorking > 0 ? lastWorking : null, goal)) {
        continue;
      }
      const body = volumeExtraSetBody(goal);
      if (!body) continue;

      if (isLocalSessionId(session.id)) {
        enqueueWorkoutSetDraft({
          sessionId: session.id,
          exerciseId: ex.id,
          body,
        });
        continue;
      }
      try {
        const data = await readJson<{ session: SessionDetail }>(
          await fetch(withBasePath(`/api/workouts/exercises/${ex.id}/sets`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }),
        );
        latest = data.session;
        setDetail(data.session);
      } catch {
        // keep session as-is; draft prefill still helps
      }
    }
  }, []);

  /** APK: drop today's «иди в зал»; while live, also mute meal / water slots. */
  const quietGymNudgeForToday = useCallback(
    (live = true) => {
      void setGymQuietMode(todayKey, live);
    },
    [todayKey],
  );

  const openSession = useCallback(
    async (id: string, opts?: { applyLever?: boolean }) => {
      setError(null);
      dismissedLive.current = false;
      setActiveId(id);
      // Volume/goal mutations only on create·start·repeat — never on resume/reopen.
      const mutateLever = shouldMutateLeverOnOpen(opts);
      const remember = (status: string | null | undefined) => {
        writeWorkoutResumeId(browserResumeStorage(), status === "finished" ? null : id);
      };

      if (isLocalSessionId(id)) {
        const local = getLocalWorkoutSession(id);
        if (!local) {
          setError("Локальная тренировка не найдена");
          setActiveId(null);
          return;
        }
        const session = localSessionToDetail(local) as SessionDetail;
        remember(session.clockStatus);
        setDetail(session);
        setProgress(null);
        setNewExerciseKind(defaultExerciseKind(session.muscleKeys));
        setShowSummary(session.clockStatus === "finished");
        setCircuitRound(1);
        setFocusExerciseId(session.exercises[0]?.id ?? null);
        fillDraftsFromSession(session);
        if (mutateLever) void applyLeverGoalsOnOpen(session);
        if (
          session.clockStatus === "running" ||
          session.clockStatus === "paused" ||
          session.clockStatus === "finished"
        ) {
          quietGymNudgeForToday(session.clockStatus !== "finished");
        }
        setError("Тренировка на устройстве — отправим при связи");
        return;
      }

      try {
        const data = await readJson<{ session: SessionDetail; progress: Progress }>(
          await fetch(withBasePath(`/api/workouts/${id}`), { cache: "no-store" }),
        );
        remember(data.session.clockStatus);
        setDetail(data.session);
        setProgress(data.progress);
        setNewExerciseKind(defaultExerciseKind(data.session.muscleKeys));
        setShowSummary(false);
        setCircuitRound(1);
        setFocusExerciseId(data.session.exercises[0]?.id ?? null);
        fillDraftsFromSession(data.session);
        if (mutateLever) void applyLeverGoalsOnOpen(data.session);
        if (
          data.session.clockStatus === "running" ||
          data.session.clockStatus === "paused" ||
          data.session.clockStatus === "finished"
        ) {
          quietGymNudgeForToday(data.session.clockStatus !== "finished");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки");
        setActiveId(null);
        if (readWorkoutResumeId(browserResumeStorage()) === id) {
          writeWorkoutResumeId(browserResumeStorage(), null);
        }
      }
    },
    [applyLeverGoalsOnOpen, fillDraftsFromSession, quietGymNudgeForToday],
  );

  const leaveLiveSession = useCallback(() => {
    dismissedLive.current = true;
    restoreLock.current = true;
    writeWorkoutResumeId(browserResumeStorage(), null);
  }, []);

  const restoreLiveSession = useCallback(async () => {
    if (restoreLock.current || dismissedLive.current || activeIdRef.current) return;
    if (loadingRef.current) return;
    if (searchParams.get("new") === "1") return;
    const target = pickSessionToResume(
      sessionsRef.current,
      readWorkoutResumeId(browserResumeStorage()),
    );
    if (!target) return;
    restoreLock.current = true;
    await openSession(target.id);
  }, [openSession, searchParams]);

  const refreshLiveClock = useCallback(async (id: string) => {
    setClockTick((n) => n + 1);
    if (isLocalSessionId(id)) return;
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/${id}`), { cache: "no-store" }),
      );
      if (activeIdRef.current !== id) return;
      if (data.session.clockStatus === "finished") {
        if (!shouldAdoptRemoteFinish(data.session)) return;
        setDetail(data.session);
        setShowSummary(true);
        writeWorkoutResumeId(browserResumeStorage(), null);
        return;
      }
      setDetail((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              startedAt: data.session.startedAt,
              endedAt: data.session.endedAt,
              pausedAt: data.session.pausedAt,
              pausedMs: data.session.pausedMs,
              elapsedSec: data.session.elapsedSec,
              elapsedLabel: data.session.elapsedLabel,
              clockStatus: data.session.clockStatus,
              endedBy: data.session.endedBy,
            }
          : prev,
      );
    } catch {
      // офлайн — на экране остаются часы от startedAt
    }
  }, []);

  useEffect(() => {
    if (loading || activeId || creating || dismissedLive.current) return;
    void restoreLiveSession();
  }, [loading, activeId, creating, sessions, restoreLiveSession]);

  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === "hidden") return;
      const id = activeIdRef.current;
      if (id) {
        void refreshLiveClock(id);
        return;
      }
      if (!dismissedLive.current) void restoreLiveSession();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("pageshow", onShow);
    };
  }, [refreshLiveClock, restoreLiveSession]);

  useEffect(() => {
    void loadList();
    void loadInsights();
    void loadRoutines();
    void loadCalendar();
  }, [loadList, loadInsights, loadRoutines, loadCalendar]);

  useEffect(() => {
    if (!activeId) setDeletedSets([]);
  }, [activeId]);

  useEffect(() => {
    const refresh = () => {
      setQueuedSets(
        countWorkoutOfflineDrafts() +
          countLocalWorkoutSessions() +
          countWorkoutExerciseDrafts(),
      );
      setQueueRev((n) => n + 1);
    };
    refresh();
    const unsubSets = subscribeWorkoutSetDraftQueue(refresh);
    const unsubEx = subscribeWorkoutExerciseDraftQueue(refresh);
    const unsubLocal = subscribeLocalWorkoutSessions(refresh);
    return () => {
      unsubSets();
      unsubEx();
      unsubLocal();
    };
  }, []);

  /** Server session + offline offline set drafts (Wave N). */
  const displayDetail = useMemo(() => {
    if (!detail) return null;
    const withExercises = mergeQueuedExercisesIntoSession(
      detail,
      listWorkoutExerciseDraftsForSession(detail.id),
    );
    return mergeQueuedSetsIntoSession(
      withExercises,
      listWorkoutSetDraftsForSession(detail.id),
    );
  }, [detail, queueRev]);

  const lastRepeat = useMemo(() => {
    const picked = pickLastFinishedSession(sessions);
    if (!picked) return null;
    return {
      id: picked.id,
      label: lastSessionRepeatLabel(picked),
      hint: lastSessionRepeatHint(picked),
    };
  }, [sessions]);

  const recentRepeats = useMemo(() => {
    const recent = pickRecentFinishedSessions(sessions, 5);
    if (recent.length <= 1) return [];
    // Skip the primary lastRepeat row — show alternatives only.
    const primaryId = lastRepeat?.id;
    return recent
      .filter((s) => s.id !== primaryId)
      .slice(0, 4)
      .map((s) => ({
        id: s.id,
        label: sessionRepeatChoiceLabel(s),
        hint: lastSessionRepeatHint(s),
      }));
  }, [sessions, lastRepeat?.id]);

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
    setCopyExercises(COPY_PREVIOUS_SESSION_DEFAULT);
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
    const tour = searchParams.get("tour");
    if (tour === "programs" || tour === "coach") setHubTab("templates");
    else if (tour === "muscles") setHubTab("today");
  }, [searchParams]);

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

  const liveClockId = detail?.id ?? null;
  const liveClockRunning = detail?.clockStatus === "running";
  useEffect(() => {
    if (!liveClockRunning) return;
    const bump = () => setClockTick((n) => n + 1);
    let id = 0;
    const arm = () => {
      window.clearInterval(id);
      if (document.visibilityState === "hidden") return;
      id = window.setInterval(bump, 1000);
    };
    bump();
    arm();
    const onVisible = () => {
      if (document.visibilityState === "hidden") {
        window.clearInterval(id);
        return;
      }
      bump();
      arm();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [liveClockId, liveClockRunning]);

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

  const patchSessionTimes = async (times: { startedAt: string; endedAt: string }) => {
    if (!detail) return;
    setError(null);
    if (isLocalSessionId(detail.id)) {
      updateLocalWorkoutSession(detail.id, {
        clockStatus: "finished",
        startedAt: times.startedAt,
        endedAt: times.endedAt,
        pausedAt: null,
        pausedMs: 0,
      });
      setDetail({
        ...detail,
        clockStatus: "finished",
        startedAt: times.startedAt,
        endedAt: times.endedAt,
        pausedAt: null,
        pausedMs: 0,
      });
      return;
    }
    try {
      const data = await readJson<{ session: SessionDetail; progress: Progress }>(
        await fetch(withBasePath(`/api/workouts/${detail.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            startedAt: times.startedAt,
            endedAt: times.endedAt,
            pausedMs: 0,
          }),
        }),
      );
      setDetail(data.session);
      setProgress(data.progress);
      void loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить время");
    }
  };

  const patchClock = async (clock: "start" | "pause" | "resume" | "finish") => {
    if (!detail) return;
    setError(null);

    if (isLocalSessionId(detail.id)) {
      const now = new Date().toISOString();
      if (clock === "finish") {
        updateLocalWorkoutSession(detail.id, {
          clockStatus: "finished",
          endedAt: now,
          pausedAt: null,
        });
        enqueueWorkoutFinishDraft(detail.id);
        setDetail({
          ...detail,
          clockStatus: "finished",
          endedAt: now,
          pausedAt: null,
        });
        setShowSummary(true);
        markPostWorkoutNudge();
        quietGymNudgeForToday(false);
        writeWorkoutResumeId(browserResumeStorage(), null);
        setError("Итог на устройстве — отправим при связи");
        return;
      }
      if (clock === "start") {
        updateLocalWorkoutSession(detail.id, {
          clockStatus: "running",
          startedAt: detail.startedAt ?? now,
        });
        setDetail({
          ...detail,
          clockStatus: "running",
          startedAt: detail.startedAt ?? now,
        });
        quietGymNudgeForToday();
        return;
      }
      if (clock === "pause") {
        updateLocalWorkoutSession(detail.id, {
          clockStatus: "paused",
          pausedAt: now,
        });
        setDetail({ ...detail, clockStatus: "paused", pausedAt: now });
        quietGymNudgeForToday();
        return;
      }
      if (clock === "resume") {
        const resumed = applyResume({
          startedAt: detail.startedAt ?? null,
          endedAt: detail.endedAt ?? null,
          pausedAt: detail.pausedAt ?? null,
          pausedMs: detail.pausedMs ?? 0,
        });
        updateLocalWorkoutSession(detail.id, {
          clockStatus: "running",
          pausedAt: null,
          pausedMs: resumed.pausedMs,
        });
        setDetail({
          ...detail,
          clockStatus: "running",
          pausedAt: null,
          pausedMs: resumed.pausedMs,
        });
        quietGymNudgeForToday();
      }
      return;
    }

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
      if (clock === "start" || clock === "resume" || clock === "pause" || clock === "finish") {
        quietGymNudgeForToday(clock !== "finish");
      }
      if (clock === "finish") {
        setShowSummary(true);
        markPostWorkoutNudge();
        writeWorkoutResumeId(browserResumeStorage(), null);
      }
    } catch (err) {
      if (clock === "finish" && isLikelyOfflineError(err)) {
        enqueueWorkoutFinishDraft(detail.id);
        setDetail({
          ...detail,
          clockStatus: "finished",
          endedAt: new Date().toISOString(),
          pausedAt: null,
        });
        setShowSummary(true);
        markPostWorkoutNudge();
        quietGymNudgeForToday(false);
        writeWorkoutResumeId(browserResumeStorage(), null);
        setError("Итог сохранён на устройстве — отправим при связи");
        return;
      }
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
      const previousSessionId = preview?.previousSessionId;
      // Empty session (copy off) creates a blank workout and must not call /repeat.
      if (shouldRepeatPreviousSession(copyExercises, previousSessionId)) {
        const data = await readJson<{ session: SessionDetail }>(
          await fetch(withBasePath(`/api/workouts/${previousSessionId}/repeat`), {
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
        // Land on the single workout screen — log sets in the expandable list.
        await openSession(data.session.id, { applyLever: true });
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
      await openSession(data.session.id, { applyLever: true });
    } catch (err) {
      if (isLikelyOfflineError(err) && newGroups.length > 0) {
        const local = createLocalWorkoutSession({
          date: newDate,
          muscleKeys: newGroups,
          progressRate,
        });
        setCreating(false);
        setFromPlusMenu(false);
        setNewGroups([]);
        await loadList();
        await openSession(local.id, { applyLever: true });
        setError("Тренировка создана на устройстве — отправим при связи");
        return;
      }
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
      await openSession(data.session.id, { applyLever: true });
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
      // Template → the same workout screen (no separate set scene).
      await openSession(data.session.id, { applyLever: true });
    } catch (err) {
      if (isLikelyOfflineError(err)) {
        const routine =
          routines.find((r) => r.id === routineId) ?? getCachedWorkoutRoutine(routineId);
        if (!routine) {
          setError("Шаблон недоступен офлайн — откройте зал онлайн один раз");
          return;
        }
        const local = startRoutineOffline({
          routine,
          date: viewDate,
          progressRate,
        });
        if (!local) {
          setError("Не удалось начать шаблон на устройстве");
          return;
        }
        await loadList();
        await openSession(local.sessionId, { applyLever: true });
        setError("Шаблон запущен на устройстве — отправим при связи");
        return;
      }
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
        await fetch(withBasePath(`/api/workouts/${session.id}`), { cache: "no-store" }),
      );
      setDetail(data.session);
      setProgress(data.progress);
      setNewExerciseKind(defaultExerciseKind(data.session.muscleKeys));
      setSetDrafts((prev) => {
        const next = { ...prev };
        for (const ex of data.session.exercises) {
          const cur = next[ex.id];
          if (cur && (cur.kg || cur.reps || cur.km || cur.time)) continue;
          const last =
            ex.sets.length === 0 ? ex.lastTime?.sets?.[0] : ex.lastTime?.sets?.[ex.sets.length];
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
    const localFlush = await flushLocalWorkoutSessions();
    let saved = localFlush.flushed;
    let lastSession: SessionDetail | null =
      localFlush.lastSession && typeof localFlush.lastSession === "object"
        ? (localFlush.lastSession as SessionDetail)
        : null;

    const exFlush = await flushWorkoutExerciseDrafts();
    saved += exFlush.flushed;
    if (exFlush.lastSession && typeof exFlush.lastSession === "object") {
      lastSession = exFlush.lastSession as SessionDetail;
    }

    const items = listWorkoutSetDrafts();
    const finishes = listWorkoutFinishDrafts();
    if (items.length === 0 && finishes.length === 0 && saved === 0) return;
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
    // Finish after sets so server tonnage includes offline approaches.
    for (const item of finishes) {
      try {
        const data = await readJson<{ session: SessionDetail; progress: Progress }>(
          await fetch(withBasePath(`/api/workouts/${item.sessionId}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clock: "finish" }),
          }),
        );
        removeWorkoutFinishDraft(item.id);
        saved += 1;
        lastSession = data.session;
        setProgress(data.progress);
      } catch {
        break;
      }
    }
    if (saved > 0) {
      setError(null);
      const remaining =
        countWorkoutOfflineDrafts() +
        countLocalWorkoutSessions() +
        countWorkoutExerciseDrafts();
      setGymFlushSummary(
        remaining > 0
          ? `Ушло ${saved} · ещё ждёт ${remaining}`
          : `Ушло ${saved} — очередь пуста`,
      );
      if (
        localFlush.lastSessionId &&
        detail &&
        isLocalSessionId(detail.id)
      ) {
        await openSession(localFlush.lastSessionId);
      } else if (lastSession && detail?.id === lastSession.id) {
        await refreshDetail(lastSession);
      } else {
        void loadList();
      }
    }
  }, [detail, loadList, openSession, refreshDetail]);

  useEffect(() => {
    if (!gymFlushSummary) return;
    const timer = window.setTimeout(() => setGymFlushSummary(null), 4500);
    return () => window.clearTimeout(timer);
  }, [gymFlushSummary]);

  useEffect(() => {
    let wasOnline = true;
    return subscribeConnectivity((next) => {
      if (next && !wasOnline) {
        void flushQueuedSets();
      }
      wasOnline = next;
    });
  }, [flushQueuedSets]);

  // Banner may have already POSTed drafts — reload active session from server.
  useEffect(() => {
    if (queueFlushKey <= 0) return;
    void (async () => {
      if (!activeId || isLocalSessionId(activeId)) {
        void flushQueuedSets();
        return;
      }
      try {
        const data = await readJson<{ session: SessionDetail; progress?: Progress }>(
          await fetch(withBasePath(`/api/workouts/${activeId}`)),
        );
        await refreshDetail(data.session);
        if (data.progress) setProgress(data.progress);
      } catch {
        void loadList();
      }
    })();
    // intentionally only when banner bump changes
    // eslint-disable-next-line react-hooks/exhaustive-deps -- queueFlushKey drives reload
  }, [queueFlushKey]);

  const addExercise = async (
    nameOverride?: string,
    kindOverride?: ExerciseKind,
    extra?: { restSec?: number; muscle?: string },
  ) => {
    if (!detail) return;
    const name = (nameOverride ?? exerciseName).trim();
    if (!name) {
      setError("Введите название упражнения");
      return;
    }
    if (busy) return;
    setError(null);
    setBusy(true);
    const kind = kindOverride ?? newExerciseKind;
    if (extra?.restSec && extra.restSec > 0 && getExerciseRestSec(name) == null) {
      setExerciseRestSec(name, extra.restSec);
    }
    const prevIds = new Set(detail.exercises.map((e) => e.id));

    try {
      if (isLocalSessionId(detail.id)) {
        const next = addLocalWorkoutExercise(detail.id, { name, kind });
        if (!next) {
          setError("Не удалось добавить упражнение на устройстве");
          return;
        }
        setExerciseName("");
        setLibraryHits([]);
        setDetail(localSessionToDetail(next) as SessionDetail);
        setFocusExerciseId(next.exercises.at(-1)?.id ?? null);
        return;
      }

      try {
        const data = await readJson<{ session: SessionDetail; catalogRestSec?: number | null }>(
          await fetch(withBasePath(`/api/workouts/${detail.id}/exercises`), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name,
              kind,
              ...(extra?.muscle ? { muscleGroup: extra.muscle } : {}),
            }),
          }),
        );
        if (
          data.catalogRestSec &&
          data.catalogRestSec > 0 &&
          getExerciseRestSec(data.session.exercises.at(-1)?.name ?? name) == null
        ) {
          setExerciseRestSec(data.session.exercises.at(-1)?.name ?? name, data.catalogRestSec);
        }
        setExerciseName("");
        setLibraryHits([]);
        const created =
          data.session.exercises.find((e) => !prevIds.has(e.id)) ??
          data.session.exercises.at(-1);
        if (created) setFocusExerciseId(created.id);
        await refreshDetail(data.session);
      } catch (err) {
        if (isLikelyOfflineError(err) && !isLocalSessionId(detail.id)) {
          const draftId = enqueueWorkoutExerciseDraft({
            sessionId: detail.id,
            name,
            exerciseKind: kind,
          });
          if (!draftId) {
            setError("Не удалось добавить упражнение на устройстве");
            return;
          }
          setExerciseName("");
          setLibraryHits([]);
          setFocusExerciseId(draftId);
          // Ensure merge re-runs even if localStorage notify was skipped (quota).
          setQueueRev((n) => n + 1);
          setError("Упражнение на устройстве — отправим при связи");
          return;
        }
        setError(err instanceof Error ? err.message : "Не удалось добавить упражнение");
      }
    } finally {
      setBusy(false);
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
    (ex: SessionExercise, session: SessionDetail): boolean => {
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
      if (beat) {
        showPrToast(beat);
        return true;
      }
      return false;
    },
    [historicalPrsFor, showPrToast],
  );

  /** I1 — toast hit/close/miss vs remembered lever (skip if PR toast already fired). */
  const maybeAnnounceLeverFeedback = useCallback(
    (
      ex: SessionExercise,
      logged: {
        weightKg: number | null;
        reps: number | null;
        setType?: string | null;
      },
      opts?: { skip?: boolean; progressRate?: number },
    ) => {
      if (opts?.skip) return;
      if (ex.kind === "cardio") return;
      const rate = opts?.progressRate ?? detail?.progressRate ?? 1;
      const goal =
        resolveLeverSessionGoal({
          name: ex.name,
          kind: ex.kind,
          progressRate: rate,
          sets: ex.sets,
          lastTimeSets: ex.lastTime?.sets ?? null,
        }) ?? leverGoalFromMemory(getLeverMemory(ex.name));
      if (!goal) return;
      const verdict = compareSetToLeverGoal(
        {
          weightKg: logged.weightKg,
          reps: logged.reps,
          setType: logged.setType ?? "working",
          completed: true,
        },
        goal,
      );
      if (!verdict) return;
      showPrToast(formatLeverSetToast(verdict, goal, ex.name));
    },
    [detail?.progressRate, showPrToast],
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

  const addSet = async (exerciseId: string, draftOverride?: SetDraft): Promise<boolean> => {
    if (!detail) return false;
    // Resolve against merged view — offline-queued exercises only exist on displayDetail.
    const ex = (displayDetail ?? detail).exercises.find((e) => e.id === exerciseId);
    if (!ex) {
      setError("Упражнение не найдено — обновите экран и попробуйте снова");
      return false;
    }
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
      return false;
    }
    const body: Record<string, unknown> = { ...meta, ...validated.body };
    const kickClock = () => {
      if (detail.clockStatus === "idle") void patchClock("start");
    };

    const queueSetLocally = () => {
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
      startRestForExercise(ex, draft.setType);
      applyAutofillAfterComplete(
        ex,
        [
          ...ex.sets,
          {
            id: "local-next",
            weightKg: typeof body.weightKg === "number" ? body.weightKg : null,
            reps: typeof body.reps === "number" ? body.reps : null,
            distanceKm: typeof body.distanceKm === "number" ? body.distanceKm : null,
            durationSec: typeof body.durationSec === "number" ? body.durationSec : null,
            setType: draft.setType,
            completed: true,
            rpe: null,
            paceSecPerKm: null,
            load: 0,
          },
        ],
        detail.progressRate,
      );
      const queued = "Подход сохранён на устройстве — отправим при связи с сервером";
      setDraftErrors((prev) => ({ ...prev, [exerciseId]: queued }));
      setError(queued);
      kickClock();
    };

    if (isLocalSessionId(detail.id)) {
      queueSetLocally();
      return true;
    }

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
      const updatedEx = data.session.exercises.find((e) => e.id === exerciseId);
      const newSetId = updatedEx?.sets.at(-1)?.id ?? "";
      const prShown = maybeAnnouncePr(ex, data.session);
      maybeAnnounceLeverFeedback(
        ex,
        {
          weightKg: typeof body.weightKg === "number" ? body.weightKg : null,
          reps: typeof body.reps === "number" ? body.reps : null,
          setType: draft.setType,
        },
        { skip: prShown, progressRate: detail.progressRate },
      );
      advanceSupersetFocus(ex, data.session);
      if (newSetId) bumpCircuitIfNeeded(ex, newSetId, data.session);
      if (updatedEx) {
        applyAutofillAfterComplete(updatedEx, updatedEx.sets, detail.progressRate);
      }
      kickClock();
      return true;
    } catch (err) {
      if (isLikelyOfflineError(err)) {
        queueSetLocally();
        return true;
      }
      const message = err instanceof Error ? err.message : "Не удалось добавить подход";
      setDraftErrors((prev) => ({ ...prev, [exerciseId]: message }));
      setError(message);
      return false;
    }
  };

  const patchSet = async (
    setId: string,
    body: Record<string, unknown>,
    startTimer = false,
  ): Promise<boolean> => {
    if (!detail) return false;
    setError(null);
    const draftId = draftIdFromLocalSetId(setId);
    if (draftId) {
      const updated = updateWorkoutSetDraft(draftId, body);
      if (!updated) {
        setError("Черновик подхода не найден");
        return false;
      }
      if (startTimer) startRest();
      setError("Подход обновлён на устройстве — отправим при связи");
      return true;
    }
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
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить подход");
      return false;
    }
  };

  const applyAutofillAfterComplete = (
    ex: SessionExercise,
    setsAfter: SessionExercise["sets"],
    progressRate: number,
  ) => {
    const goal = resolveLeverSessionGoal({
      name: ex.name,
      kind: ex.kind,
      progressRate,
      sets: setsAfter,
      lastTimeSets: ex.lastTime?.sets ?? null,
      historyPoints: historyByName[ex.name]?.points ?? null,
    });
    // Weight lever (or no memory): allow kg bump after a completed set.
    const bump =
      !goal || goal.lever === "weight"
        ? { progressRate, bumpAfterComplete: true as const }
        : { progressRate, bumpAfterComplete: false as const };
    const fill = autofillNextDraft(setsAfter, bump);
    if (!fill) return;
    const merged = mergeDraftWithLeverGoal(
      {
        kg: fill.weightKg != null ? String(fill.weightKg) : "",
        reps: fill.reps != null ? String(fill.reps) : "",
      },
      goal,
    );
    setSetDrafts((prev) => ({
      ...prev,
      [ex.id]: {
        ...EMPTY_DRAFT,
        kg: merged.kg,
        reps: merged.reps,
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
    const pending = Boolean(set.pendingLocal || draftIdFromLocalSetId(set.id));
    await patchSet(set.id, { completed: next }, false);
    if (next && detail && !pending) {
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
        const prShown = maybeAnnouncePr(ex, sessionAfter);
        maybeAnnounceLeverFeedback(
          ex,
          {
            weightKg: set.weightKg,
            reps: set.reps,
            setType: set.setType,
          },
          { skip: prShown, progressRate: detail.progressRate },
        );
        bumpCircuitIfNeeded(ex, set.id, detail);
      }
    }
  };

  useEffect(() => {
    if (detail?.clockStatus !== "running") return;
    let released = false;
    let handle: { release: () => Promise<void> } | null = null;
    const acquire = () => {
      void (async () => {
        const next = await requestScreenWakeLock();
        if (released) {
          await next?.release();
          return;
        }
        if (handle && handle !== next) await handle.release();
        handle = next;
      })();
    };
    acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisible);
      void handle?.release();
    };
  }, [detail?.clockStatus, detail?.id]);

  /** One tap on ○ — write kg/reps onto a planned row and mark it done. */
  const completePlannedSet = async (
    exerciseId: string,
    setId: string,
    draft: SetDraft,
  ): Promise<boolean> => {
    if (!detail) return false;
    const ex = (displayDetail ?? detail).exercises.find((e) => e.id === exerciseId);
    const target = ex?.sets.find((s) => s.id === setId);
    if (!ex || !target || target.completed) return false;
    const validated = validateSetDraft(ex.kind, draft);
    if (!validated.ok) {
      failDraft(ex.id, validated.message, validated.field);
      return false;
    }
    const patch: Record<string, unknown> = {
      completed: true,
      setType: draft.setType,
      ...validated.body,
    };
    if (draft.rpe.trim()) {
      const rpe = Number(draft.rpe.replace(",", "."));
      if (Number.isFinite(rpe)) patch.rpe = rpe;
    }
    if (typeof patch.reps === "number") patch.reps = Math.round(patch.reps);
    const ok = await patchSet(setId, patch, false);
    if (!ok) return false;
    startRestForExercise(ex, draft.setType);
    if (detail.clockStatus === "idle") void patchClock("start");
    const setsAfter = ex.sets.map((s) =>
      s.id === setId
        ? {
            ...s,
            completed: true,
            weightKg: typeof patch.weightKg === "number" ? patch.weightKg : s.weightKg,
            reps: typeof patch.reps === "number" ? patch.reps : s.reps,
            distanceKm: typeof patch.distanceKm === "number" ? patch.distanceKm : s.distanceKm,
            durationSec: typeof patch.durationSec === "number" ? patch.durationSec : s.durationSec,
            setType: draft.setType,
          }
        : s,
    );
    applyAutofillAfterComplete(ex, setsAfter, detail.progressRate);
    const sessionAfter: SessionDetail = {
      ...detail,
      exercises: detail.exercises.map((e) => (e.id === ex.id ? { ...e, sets: setsAfter } : e)),
    };
    const prShown = maybeAnnouncePr(ex, sessionAfter);
    maybeAnnounceLeverFeedback(
      ex,
      {
        weightKg: typeof patch.weightKg === "number" ? patch.weightKg : target.weightKg,
        reps: typeof patch.reps === "number" ? patch.reps : target.reps,
        setType: draft.setType,
      },
      { skip: prShown, progressRate: detail.progressRate },
    );
    advanceSupersetFocus(ex, sessionAfter);
    bumpCircuitIfNeeded(ex, setId, sessionAfter);
    return true;
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

  const patchSessionDate = async (nextDate: string) => {
    if (!detail) return;
    const date = requireDateKey(nextDate);
    if (!date) {
      setError("Некорректная дата");
      return;
    }
    setError(null);
    if (isLocalSessionId(detail.id)) {
      updateLocalWorkoutSession(detail.id, { date });
      setDetail({ ...detail, date });
      void loadList();
      return;
    }
    try {
      const data = await readJson<{ session: SessionDetail; progress: Progress }>(
        await fetch(withBasePath(`/api/workouts/${detail.id}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
        }),
      );
      setDetail(data.session);
      setProgress(data.progress);
      void loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сменить дату");
    }
  };

  /** Materialize every lastTime set into the session (not just the next-draft slot). */
  const applyAllLastSets = async () => {
    if (!detail) return;
    setError(null);
    for (const ex of detail.exercises) {
      const hist = ex.lastTime?.sets ?? [];
      if (!hist.length) continue;
      for (const s of hist) {
        await addSet(ex.id, draftFromHistorySet(s, ex.kind));
      }
    }
  };

  const toggleExerciseHistory = async (
    name: string,
    kind: ExerciseKind,
    catalogId?: string | null,
  ) => {
    const open = !historyOpen[name];
    setHistoryOpen((prev) => ({ ...prev, [name]: open }));
    if (!open || historyByName[name]) return;
    try {
      const query = new URLSearchParams({ name });
      if (catalogId) query.set("catalogId", catalogId);
      const data = await readJson<{
        points: TimelinePoint[];
        chart: ChartPoint[];
        prSummary: string | null;
        kind: string;
        topWeightDeltaKg: number | null;
        bestPaceDeltaSec: number | null;
        linkedByCatalog?: boolean;
      }>(
        await fetch(withBasePath(`/api/workouts/exercise-history?${query.toString()}`)),
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
          linkedByCatalog: data.linkedByCatalog,
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить историю");
    }
  };

  const deleteSet = async (setId: string) => {
    if (!detail) return;
    const view = displayDetail ?? detail;
    const exercise = view.exercises.find((ex) => ex.sets.some((set) => set.id === setId));
    const index = exercise?.sets.findIndex((set) => set.id === setId) ?? -1;
    const set = index >= 0 ? exercise?.sets[index] : undefined;
    if (!exercise || !set) return;
    const draftId = draftIdFromLocalSetId(setId);
    const notice: DeletedSetUndo = {
      exerciseId: exercise.id,
      index,
      weightKg: set.weightKg,
      reps: set.reps,
      distanceKm: set.distanceKm,
      durationSec: set.durationSec,
      setType: set.setType,
      completed: set.completed,
      rpe: set.rpe,
      localBody: null,
    };
    if (draftId) {
      const queued = listWorkoutSetDraftsForSession(detail.id).find((item) => item.id === draftId);
      notice.localBody = queued?.body ?? null;
      notice.index = listWorkoutSetDraftsForSession(detail.id)
        .filter((item) => item.exerciseId === exercise.id)
        .findIndex((item) => item.id === draftId);
      if (notice.index < 0) notice.index = 0;
      removeWorkoutSetDraft(draftId);
      setDeletedSets((prev) => [...prev, notice]);
      setError(null);
      return;
    }
    const previous = detail;
    // Optimistic hide — reopen must not resurrect via cached GET / lever re-apply.
    setDetail({
      ...detail,
      exercises: detail.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.filter((s) => s.id !== setId),
      })),
    });
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/sets/${setId}`), {
          method: "DELETE",
          cache: "no-store",
        }),
      );
      await refreshDetail(data.session);
      setDeletedSets((prev) => [...prev, notice]);
    } catch (err) {
      setDetail(previous);
      setError(err instanceof Error ? err.message : "Не удалось удалить подход");
    }
  };

  const moveSet = async (setId: string, move: "up" | "down") => {
    if (!detail) return;
    const draftId = draftIdFromLocalSetId(setId);
    if (draftId) {
      moveWorkoutSetDraft(draftId, move);
      return;
    }
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/sets/${setId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ move }),
        }),
      );
      await refreshDetail(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось переместить подход");
    }
  };

  const undoDeleteSet = async () => {
    if (!detail || deletedSets.length === 0) return;
    const notice = deletedSets[deletedSets.length - 1]!;
    setDeletedSets((prev) => prev.slice(0, -1));
    if (notice.localBody) {
      const index = clampSetIndex(
        listWorkoutSetDraftsForSession(detail.id).filter((item) => item.exerciseId === notice.exerciseId)
          .length,
        notice.index,
      );
      insertWorkoutSetDraftAt({
        sessionId: detail.id,
        exerciseId: notice.exerciseId,
        body: notice.localBody,
        indexAmongExercise: index,
      });
      return;
    }
    const exercise = (displayDetail ?? detail).exercises.find((ex) => ex.id === notice.exerciseId);
    const insertAt = clampSetIndex(exercise?.sets.length ?? 0, notice.index);
    try {
      const data = await readJson<{ session: SessionDetail }>(
        await fetch(withBasePath(`/api/workouts/exercises/${notice.exerciseId}/sets`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weightKg: notice.weightKg,
            reps: notice.reps,
            distanceKm: notice.distanceKm,
            durationSec: notice.durationSec,
            setType: notice.setType,
            completed: notice.completed,
            rpe: notice.rpe,
            insertAt,
            restore: true,
          }),
        }),
      );
      await refreshDetail(data.session);
    } catch (err) {
      setDeletedSets((prev) => [...prev, notice]);
      setError(err instanceof Error ? err.message : "Не удалось вернуть подход");
    }
  };

  const deleteExercise = async (exerciseId: string) => {
    if (!detail) return;
    if (exerciseId.startsWith("local-ex-")) {
      removeWorkoutExerciseDraft(exerciseId);
      removeWorkoutSetDraftsForExercise(exerciseId);
      setFocusExerciseId((prev) => {
        if (prev !== exerciseId) return prev;
        const remaining = (displayDetail ?? detail).exercises.filter((e) => e.id !== exerciseId);
        return remaining[0]?.id ?? null;
      });
      setError(null);
      return;
    }
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
    if (isLocalSessionId(detail.id)) {
      removeLocalWorkoutSession(detail.id);
      leaveLiveSession();
      setDetail(null);
      setActiveId(null);
      setProgress(null);
      clearRest();
      await loadList();
      return;
    }
    try {
      await readJson(await fetch(withBasePath(`/api/workouts/${detail.id}`), { method: "DELETE" }));
      leaveLiveSession();
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

  if (activeId && detail && displayDetail) {
    return (
      <WorkoutActiveSession
        detail={displayDetail}
        progress={progress}
        todayKey={todayKey}
        progressLine={progressLine}
        showSummary={showSummary}
        setShowSummary={setShowSummary}
        busy={busy}
        error={error}
        restSeconds={restSeconds}
        setRestSeconds={setRestSeconds}
        restEndsAt={restEndsAt}
        restLeft={restLeft}
        restSound={restSound}
        setRestSound={setRestSound}
        startRest={startRest}
        extendRest={extendRest}
        clearRest={clearRest}
        restOptions={REST_OPTIONS}
        liveElapsedLabel={liveElapsedLabel}
        bodyWeightKg={weightKnown ? bodyWeightKg : undefined}
        focusExerciseId={focusExerciseId}
        setFocusExerciseId={setFocusExerciseId}
        circuitRound={circuitRound}
        prToast={prToast}
        draftErrors={draftErrors}
        setDrafts={setDrafts}
        historyByName={historyByName}
        historyOpen={historyOpen}
        setHistoryByName={setHistoryByName}
        queuedSets={queuedSets}
        flushSummary={gymFlushSummary}
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
        onLeaveSession={leaveLiveSession}
        onSummaryBackToList={() => {
          setShowSummary(false);
          leaveLiveSession();
          setActiveId(null);
          setDetail(null);
          setProgress(null);
          clearRest();
          void loadList();
        }}
        onSummaryGoToRation={() => {
          // Nudge already marked on finish — just open ration.
          setShowSummary(false);
          leaveLiveSession();
          setActiveId(null);
          setDetail(null);
          setProgress(null);
          clearRest();
          router.push(withBasePath("/ration"));
        }}
        onOpenRation={() => router.push(withBasePath("/ration"))}
        rememberExerciseRest={(name) => {
          setExerciseRestSec(name, restSeconds);
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
          showPrToast(`Отдых ${restSeconds}с для «${name}»`);
        }}
        patchDraft={patchDraft}
        nextSetType={nextSetType}
        patchClock={patchClock}
        patchSessionTimes={patchSessionTimes}
        patchSessionDate={patchSessionDate}
        applyAllLastSets={applyAllLastSets}
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
        moveSet={moveSet}
        deletedSetNotice={deletedSets.length > 0}
        undoDeleteSet={() => void undoDeleteSet()}
        deleteExercise={deleteExercise}
        addSet={addSet}
        completePlannedSet={completePlannedSet}
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
      <div className="cv-segment-tabs cv-segment-tabs--3" role="tablist" aria-label="Раздел зала">
        {(
          [
            ["today", "Сегодня"],
            ["templates", "Шаблоны"],
            ["history", "История"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            data-tour={id === "today" ? "gym-today" : undefined}
            aria-selected={hubTab === id || (id === "templates" && hubTab === "library")}
            onClick={() => {
              setHubTab(id);
              if (id === "today") {
                setFilterPeriod("all");
                setFilterDate(null);
              }
            }}
            className={`chip min-h-9 ${hubTab === id || (id === "templates" && hubTab === "library") ? "chip-active" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
      {hubTab === "templates" || hubTab === "library" ? (
        <button
          type="button"
          className="self-start text-sm font-semibold text-[var(--accent-ink)]"
          onClick={() => setHubTab(hubTab === "library" ? "templates" : "library")}
        >
          {hubTab === "library" ? "К шаблонам" : "Библиотека упражнений"}
        </button>
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
          lastRepeat={lastRepeat}
          recentRepeats={recentRepeats}
          routinesFallback={routines}
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
              prCount: s.prCount,
              energyLabel: s.energyLabel,
            }))}
          onOpenSession={(id, opts) => {
            void (async () => {
              const s = sessions.find((x) => x.id === id);
              if (s?.clockStatus === "running" || s?.clockStatus === "paused") {
                await openSession(id);
                return;
              }
              await openSession(id);
              if (s?.clockStatus === "finished") {
                // Итог → overlay; Изменить → editor (summary: false).
                setShowSummary(opts?.summary ?? true);
              }
            })();
          }}
          onStartBlank={() => {
            setCopyExercises(COPY_PREVIOUS_SESSION_DEFAULT);
            setCreating(true);
            setNewDate(viewDate);
          }}
          onRepeatLast={(id) => void repeatSession(id)}
          onStartRoutine={(id) => void startRoutine(id)}
          preferWeekOpen={preferWeekOpen}
          onEditRoutine={(id) => setEditingRoutineId(id)}
          onCreatePlanDay={(weekday) => {
            setNewRoutineWeekdays(
              weekday != null && Number.isFinite(weekday) ? [weekday] : null,
            );
            setEditingRoutineId("new");
          }}
          onPlanChanged={() => {
            void loadRoutines();
          }}
          onGoTemplates={() => setHubTab("templates")}
          muscleMap={insights?.muscleMap ?? null}
        />
      ) : null}

      {hubTab === "library" ? <WorkoutLibraryPanel /> : null}

      {hubTab === "templates" ? (
        <>
        <WorkoutProgramsPanel
          existingNames={routines.map((routine) => routine.name)}
          busy={busy}
          onStart={(id) => void startRoutine(id)}
          onSaveDrafts={async (drafts: RoutineDraft[]) => {
            let saved = 0;
            let skipped = 0;
            let firstId: string | null = null;
            for (const draft of drafts) {
              const existing = routines.find((routine) => routine.name === draft.name);
              if (existing) {
                skipped += 1;
                firstId ??= existing.id;
                continue;
              }
              const data = await readJson<{ routine: { id: string } }>(
                await fetch(withBasePath("/api/workouts/routines"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    name: draft.name,
                    note: draft.note,
                    muscleGroups: draft.muscleGroups,
                    exercises: draft.exercises,
                  }),
                }),
              );
              saved += 1;
              firstId ??= data.routine.id;
            }
            await loadRoutines();
            return { saved, skipped, firstId };
          }}
        />
        <WorkoutTemplatesPanel
          routines={routines}
          busy={busy}
          onCreateNew={() => setEditingRoutineId("new")}
          onStart={(id) => void startRoutine(id)}
          onEdit={(id) => setEditingRoutineId(id)}
          onDelete={(id) => void deleteRoutine(id)}
        />
        </>
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
          flushSummary={gymFlushSummary}
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
            setCopyExercises(COPY_PREVIOUS_SESSION_DEFAULT);
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
          onOpenSession={(id, opts) => {
            void (async () => {
              const s = sessions.find((x) => x.id === id);
              await openSession(id);
              if (s?.clockStatus === "finished") {
                // History row → editor by default; pass summary:true for overlay.
                setShowSummary(opts?.summary ?? false);
              }
            })();
          }}
          onRepeat={(id) => void repeatSession(id)}
          onSaveAsRoutine={(id, name) => void saveAsRoutine(id, name)}
        />
      ) : null}
        </>
      )}
    </div>
  );
}
