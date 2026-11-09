"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ExerciseAddSheet } from "@/components/workouts/ExerciseAddSheet";
import { ExerciseHistorySheet, type ExerciseHistoryBundle } from "@/components/workouts/ExerciseHistorySheet";
import { ExerciseRow } from "@/components/workouts/ExerciseRow";
import type { OverflowMenuItem } from "@/components/workouts/OverflowMenu";
import { OverflowMenu } from "@/components/workouts/OverflowMenu";
import { RestTimer } from "@/components/workouts/RestTimer";
import { WorkoutRestTimerBanner } from "@/components/workouts/WorkoutRestTimer";
import { SessionSheet } from "@/components/workouts/SessionSheet";
import { SetTable, type SetTableFields } from "@/components/workouts/SetTable";
import { WorkoutSessionSummary } from "@/components/workouts/WorkoutSessionSummary";
import {
  dateKeyAndTimeToIso,
  formatDateWords,
  toTimeInputValue,
} from "@/lib/dates";
import {
  buildSetTableRows,
  exerciseSetCounts,
  formatBestTarget,
  formatLastTimePhrase,
  nextUnfinishedExerciseId,
  pickInitialExpandedId,
  shouldAutoExpandNext,
  toggleExpanded,
  type ExerciseExpandInput,
  type ExtraDraftLike,
  type SetTableRowModel,
} from "@/lib/workouts/active-set-table";
import { durationSecToMinutesInput } from "@/lib/workouts/cardio";
import {
  EXERCISE_KIND_LABELS,
  fieldsForKind,
  kindUsesRestTimer,
  type ExerciseKind,
} from "@/lib/workouts/exercise-kind";
import { sessionElapsedSec } from "@/lib/workouts/session-clock";
import {
  estimateSessionEnergy,
  formatSessionEnergyCaption,
  formatSessionEnergyKcal,
} from "@/lib/workouts/energy";
import { formatWorkoutLoad } from "@/lib/workouts/format";
import {
  BLOCK_MODE_LABELS,
  BLOCK_MODES,
  type BlockMode,
  parseBlockMode,
} from "@/lib/workouts/block-mode";
import { adviseProgression } from "@/lib/workouts/progression";
import {
  pickLastWorkingWeight,
  pickTopWorkingSet,
  suggestNextWeightKg,
} from "@/lib/workouts/suggested-load";
import { buildNextSessionTargets } from "@/lib/workouts/next-session-targets";
import {
  adviceWithPreferredLever,
  collectPreferredLevers,
} from "@/lib/workouts/progression-lever-memory";
import { validateSetDraft } from "@/lib/workouts/set-draft";
import { getExerciseRestSec, REST_OPTIONS, setExerciseRestSec } from "@/lib/workouts/rest-timer";
import { SET_TYPE_LABELS, type SetType } from "@/lib/workouts/set-meta";

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

type ExtraDraft = ExtraDraftLike & { setType: SetType };

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
  prHits?: Array<{ name: string; label: string }>;
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
    pendingLocal?: boolean;
  }>;
  lastTime?: { date: string; kind?: ExerciseKind; sets: HistorySet[] } | null;
};

export type SessionDetail = SessionSummary & {
  exercises: SessionExercise[];
};

type InsightSuggestion = {
  name: string;
  count: number;
  lastDate: string;
  lastSets: HistorySet[];
};

type Insights = {
  suggestions: InsightSuggestion[];
};

type LibraryEntry = {
  id: string;
  name: string;
  kind: ExerciseKind;
  defaultMuscleGroup: string | null;
  useCount: number;
  lastUsedAt: string;
};

type HistoryBundle = ExerciseHistoryBundle;

function formatPct(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

function toExpandInput(ex: SessionExercise): ExerciseExpandInput {
  return {
    id: ex.id,
    completed: ex.sets.filter((s) => s.completed).length,
    incomplete: ex.sets.filter((s) => !s.completed).length,
    lastSetCount: ex.lastTime?.sets.length ?? 0,
  };
}

function historyToDraft(set: HistorySet, kind: ExerciseKind): SetDraft {
  const spec = fieldsForKind(kind);
  return {
    ...EMPTY_DRAFT,
    kg: spec.usesWeight && set.weightKg != null ? String(set.weightKg) : "",
    reps: spec.usesReps && set.reps != null ? String(set.reps) : "",
    km:
      spec.usesDistance && set.distanceKm != null && set.distanceKm > 0
        ? String(set.distanceKm)
        : "",
    time:
      spec.usesDuration && set.durationSec != null && set.durationSec > 0
        ? durationSecToMinutesInput(set.durationSec)
        : "",
  };
}

function bestAndTarget(
  ex: SessionExercise,
  progressRate: number,
  hist: HistoryBundle | undefined,
): { best: number | null; target: number | null } {
  const spec = fieldsForKind(ex.kind);
  if (!spec.usesWeight) return { best: null, target: null };
  const lastKg = pickLastWorkingWeight([
    ...(ex.lastTime?.sets ?? []).map((s) => ({
      weightKg: s.weightKg,
      setType: "working" as const,
      completed: true,
    })),
    ...ex.sets,
  ]);
  const suggested = suggestNextWeightKg(lastKg, progressRate);
  const progression = hist
    ? adviseProgression(
        hist.points.map((p) => ({
          date: p.date,
          topWeightKg: p.topWeightKg,
          topReps: p.topReps,
          totalLoad: p.totalLoad,
        })),
        progressRate,
        lastKg,
      )
    : null;
  const preferred = progression ? adviceWithPreferredLever(progression, ex.name) : null;
  return {
    best: lastKg,
    target: preferred?.suggestedKg ?? progression?.suggestedKg ?? suggested,
  };
}

const CLOCK_HINT: Record<NonNullable<SessionDetail["clockStatus"]>, string> = {
  idle: "Старт",
  running: "Идёт",
  paused: "Пауза",
  finished: "Готово",
};

export type WorkoutActiveSessionProps = {
  detail: SessionDetail;
  progress: Progress | null;
  todayKey: string;
  progressLine: string | null;
  showSummary: boolean;
  setShowSummary: (v: boolean) => void;
  busy: boolean;
  error: string | null;
  restSeconds: number;
  setRestSeconds: (n: number) => void;
  restEndsAt: number | null;
  restLeft: number;
  restSound: boolean;
  setRestSound: (v: boolean) => void;
  startRest: (sec?: number) => void;
  extendRest?: () => void;
  clearRest: () => void;
  restOptions: readonly number[];
  liveElapsedLabel: string;
  /** undefined — вес ещё не загружен; null — измерений нет. */
  bodyWeightKg?: number | null;
  focusExerciseId: string | null;
  setFocusExerciseId: (id: string | null) => void;
  circuitRound: number;
  prToast: string | null;
  draftErrors: Record<string, string>;
  setDrafts: Record<string, SetDraft>;
  historyByName: Record<string, HistoryBundle>;
  historyOpen: Record<string, boolean>;
  setHistoryByName: (
    updater: (prev: Record<string, HistoryBundle>) => Record<string, HistoryBundle>,
  ) => void;
  queuedSets: number;
  flushSummary?: string | null;
  insights: Insights | null;
  libraryHits: LibraryEntry[];
  newExerciseKind: ExerciseKind;
  setNewExerciseKind: (k: ExerciseKind) => void;
  exerciseName: string;
  setExerciseName: (v: string) => void;
  pasteText: string;
  setPasteText: (v: string) => void;
  setActiveId: (id: string | null) => void;
  setDetail: (d: SessionDetail | null) => void;
  setProgress: (p: Progress | null) => void;
  loadList: () => Promise<void>;
  onSummaryBackToList: () => void;
  onSummaryGoToRation: () => void;
  onOpenRation: () => void;
  rememberExerciseRest: (name: string) => void;
  patchDraft: (exerciseId: string, patch: Partial<SetDraft>) => void;
  nextSetType: (current: SetType) => SetType;
  patchClock: (action: "start" | "pause" | "resume" | "finish") => Promise<void>;
  patchSessionTimes: (times: { startedAt: string; endedAt: string }) => Promise<void>;
  patchSessionDate: (date: string) => Promise<void>;
  applyAllLastSets: () => void | Promise<void>;
  saveAsRoutine: (sessionId: string, name: string) => Promise<void>;
  deleteSession: () => Promise<void>;
  toggleExerciseHistory: (
    name: string,
    kind: ExerciseKind,
    catalogId?: string | null,
  ) => Promise<void>;
  saveSessionNote: (note: string) => Promise<void>;
  flushQueuedSets: () => Promise<void>;
  moveExercise: (id: string, dir: "up" | "down") => Promise<void>;
  setExerciseBlockMode: (id: string, mode: BlockMode) => Promise<void>;
  linkExerciseSuperset: (id: string, prevId: string) => Promise<void>;
  clearExerciseSuperset: (id: string) => Promise<void>;
  saveExerciseNote: (id: string, note: string) => Promise<void>;
  toggleSetCompleted: (set: SessionExercise["sets"][number]) => Promise<void>;
  cycleSetType: (set: SessionExercise["sets"][number]) => Promise<void>;
  saveSetFields: (
    setId: string,
    patch: Partial<{
      weightKg: number | null;
      reps: number | null;
      distanceKm: number | null;
      durationSec: number | null;
      rpe: number | null;
    }>,
  ) => Promise<void>;
  deleteSet: (setId: string) => Promise<void>;
  moveSet: (setId: string, direction: "up" | "down") => Promise<void>;
  deletedSetNotice: boolean;
  undoDeleteSet: () => void;
  deleteExercise: (exerciseId: string) => Promise<void>;
  addSet: (exerciseId: string, draft?: SetDraft) => Promise<boolean>;
  completePlannedSet: (exerciseId: string, setId: string, draft: SetDraft) => Promise<boolean>;
  addExercise: (
    name?: string,
    kind?: ExerciseKind,
    extra?: { restSec?: number; muscle?: string },
  ) => Promise<void>;
  applyPasteLog: () => Promise<void>;
};

export function WorkoutActiveSession({
  detail,
  progress,
  todayKey,
  progressLine,
  showSummary,
  setShowSummary,
  busy,
  error,
  restSeconds,
  setRestSeconds,
  restEndsAt,
  restLeft,
  restSound,
  setRestSound,
  startRest,
  extendRest,
  clearRest,
  restOptions,
  liveElapsedLabel,
  bodyWeightKg,
  focusExerciseId,
  setFocusExerciseId,
  circuitRound,
  prToast,
  draftErrors,
  setDrafts,
  historyByName,
  historyOpen,
  setHistoryByName,
  queuedSets,
  flushSummary = null,
  insights,
  newExerciseKind,
  setNewExerciseKind,
  exerciseName,
  setExerciseName,
  pasteText,
  setPasteText,
  setActiveId,
  setDetail,
  setProgress,
  loadList,
  onSummaryBackToList,
  onSummaryGoToRation,
  onOpenRation,
  rememberExerciseRest,
  patchDraft,
  nextSetType,
  patchClock,
  patchSessionTimes,
  patchSessionDate,
  applyAllLastSets,
  saveAsRoutine,
  deleteSession,
  toggleExerciseHistory,
  saveSessionNote,
  flushQueuedSets,
  moveExercise,
  setExerciseBlockMode,
  linkExerciseSuperset,
  clearExerciseSuperset,
  saveExerciseNote,
  toggleSetCompleted,
  cycleSetType,
  saveSetFields,
  deleteSet,
  moveSet,
  deletedSetNotice,
  undoDeleteSet,
  deleteExercise,
  addSet,
  completePlannedSet,
  addExercise,
  applyPasteLog,
}: WorkoutActiveSessionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [extras, setExtras] = useState<Record<string, ExtraDraft[]>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [noteExerciseId, setNoteExerciseId] = useState<string | null>(null);
  const [exerciseRestSec, setExerciseRestSecState] = useState(restSeconds);
  const [historyName, setHistoryName] = useState<string | null>(null);
  const [editStartTime, setEditStartTime] = useState(() =>
    detail.startedAt ? toTimeInputValue(detail.startedAt) : "12:00",
  );
  const [editEndTime, setEditEndTime] = useState(() =>
    detail.endedAt ? toTimeInputValue(detail.endedAt) : toTimeInputValue(new Date()),
  );
  const [timeBusy, setTimeBusy] = useState(false);
  const prevFocus = useRef(focusExerciseId);
  const liveEnergy = useMemo(() => {
    if (bodyWeightKg === undefined) return null;
    void liveElapsedLabel;
    return estimateSessionEnergy({
      weightKg: bodyWeightKg,
      elapsedSec: sessionElapsedSec({
        startedAt: detail.startedAt ?? null,
        endedAt: detail.endedAt ?? null,
        pausedAt: detail.pausedAt ?? null,
        pausedMs: detail.pausedMs ?? 0,
      }),
      exercises: detail.exercises.map((exercise) => ({
        name: exercise.name,
        kind: exercise.kind,
        catalogId: exercise.catalogId,
        sets: exercise.sets.map((set) => ({
          completed: set.completed,
          durationSec: set.durationSec,
          distanceKm: set.distanceKm,
          setType: set.setType,
        })),
      })),
    });
  }, [bodyWeightKg, detail, liveElapsedLabel]);
  const liveEnergyLabel =
    liveEnergy && liveEnergy.kcal > 0 ? formatSessionEnergyKcal(liveEnergy) : null;
  const liveEnergyCaption =
    liveEnergy && liveEnergy.kcal > 0 ? formatSessionEnergyCaption(liveEnergy) : null;

  useEffect(() => {
    setExpandedId(pickInitialExpandedId(detail.exercises.map(toExpandInput)));
    setExtras({});
    // New session only — logging sets must not collapse the open row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.id]);

  useEffect(() => {
    if (expandedId && !detail.exercises.some((ex) => ex.id === expandedId)) {
      setExpandedId(pickInitialExpandedId(detail.exercises.map(toExpandInput)));
    }
  }, [detail.exercises, expandedId]);

  useEffect(() => {
    if (!focusExerciseId || focusExerciseId === prevFocus.current) return;
    prevFocus.current = focusExerciseId;
    setExpandedId(focusExerciseId);
  }, [focusExerciseId]);

  useEffect(() => {
    if (detail.startedAt) setEditStartTime(toTimeInputValue(detail.startedAt));
    if (detail.endedAt) setEditEndTime(toTimeInputValue(detail.endedAt));
  }, [detail.id, detail.startedAt, detail.endedAt]);

  const delta = formatPct(progress?.deltaPctVsPrevious);
  const summaryExercises = detail.exercises.map((ex) => {
    const hist = historyByName[ex.name];
    return {
      name: ex.name,
      load: ex.load,
      setCount: ex.sets.length,
      completedCount: ex.sets.filter((s) => s.completed).length,
      prLine:
        (detail.prHits ?? []).find((hit) => hit.name === ex.name)?.label ??
        hist?.prSummary ??
        null,
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

  const preferredLevers = collectPreferredLevers(detail.exercises.map((ex) => ex.name));
  const nextTargets = buildNextSessionTargets(
    detail.exercises.map((ex) => {
      const hist = historyByName[ex.name];
      const top =
        pickTopWorkingSet(ex.sets) ??
        pickTopWorkingSet(
          (ex.lastTime?.sets ?? []).map((s) => ({
            weightKg: s.weightKg,
            reps: s.reps,
            setType: "working" as const,
            completed: true,
          })),
        );
      const prevCardioPace =
        hist?.points
          .map((p) => p.bestPaceSecPerKm)
          .filter((p): p is number => p != null && p > 0)
          .sort((a, b) => a - b)[0] ?? ex.cardioBestPaceSecPerKm;
      const workingSets = ex.sets.filter(
        (s) => s.completed && (s.setType ?? "working") !== "warmup" && (s.setType ?? "working") !== "drop",
      );
      const lastTimeCount = ex.lastTime?.sets?.length ?? 0;
      return {
        name: ex.name,
        kind: ex.kind,
        lastWorkingKg: top?.weightKg ?? null,
        lastWorkingReps: top?.reps ?? null,
        points: (hist?.points ?? []).map((p) => ({
          date: p.date,
          topWeightKg: p.topWeightKg,
          topReps: p.topReps,
          totalLoad: p.totalLoad,
        })),
        load: ex.load,
        completedCount: ex.sets.filter((s) => s.completed).length,
        sessionWorkingCount: workingSets.length,
        lastWorkingCount: lastTimeCount > 0 ? lastTimeCount : null,
        cardioDistanceKm: ex.cardioDistanceKm,
        cardioDurationSec: ex.cardioDurationSec,
        previousBestPaceSecPerKm: prevCardioPace ?? null,
      };
    }),
    detail.progressRate,
    3,
    preferredLevers,
  );

  const leave = () => {
    setActiveId(null);
    setDetail(null);
    setProgress(null);
    setShowSummary(false);
    clearRest();
    void loadList();
  };

  const advanceAfterLog = (
    ex: SessionExercise,
    loggedNumber: number,
    incompleteRemaining: number,
    extraRemaining: number,
  ) => {
    if (
      !shouldAutoExpandNext({
        loggedNumber,
        lastSetCount: ex.lastTime?.sets.length ?? 0,
        incompleteRemaining,
        extraDraftsRemaining: extraRemaining,
      })
    ) {
      return;
    }
    const next = nextUnfinishedExerciseId(detail.exercises.map(toExpandInput), ex.id);
    setExpandedId(next);
    if (next) {
      prevFocus.current = next;
      setFocusExerciseId(next);
    }
  };

  const draftFromFields = (row: SetTableRowModel, fields: SetTableFields): SetDraft => ({
    kg: fields.kg,
    reps: fields.reps,
    km: fields.km,
    time: fields.time,
    setType: (row.setType as SetType) || "working",
    rpe: row.rpe,
  });

  const onLog = async (ex: SessionExercise, row: SetTableRowModel, fields: SetTableFields) => {
    if (row.completed && row.setId) {
      const set = ex.sets.find((s) => s.id === row.setId);
      if (set) await toggleSetCompleted(set);
      return;
    }
    const draft = draftFromFields(row, fields);
    const ok = row.setId
      ? await completePlannedSet(ex.id, row.setId, draft)
      : await addSet(ex.id, draft);
    if (!ok) return;
    let extraRemaining = extras[ex.id]?.length ?? 0;
    if (row.extraId) {
      extraRemaining = Math.max(0, extraRemaining - 1);
      setExtras((prev) => ({
        ...prev,
        [ex.id]: (prev[ex.id] ?? []).filter((item) => item.id !== row.extraId),
      }));
    }
    const incompleteRemaining = ex.sets.filter((s) => !s.completed && s.id !== row.setId).length;
    advanceAfterLog(ex, row.number, incompleteRemaining, extraRemaining);
  };

  const onFieldChange = (ex: SessionExercise, row: SetTableRowModel, fields: SetTableFields) => {
    if (row.extraId) {
      setExtras((prev) => ({
        ...prev,
        [ex.id]: (prev[ex.id] ?? []).map((item) =>
          item.id === row.extraId ? { ...item, ...fields } : item,
        ),
      }));
      return;
    }
    if (row.source === "draft") patchDraft(ex.id, fields);
  };

  const onCommit = async (ex: SessionExercise, row: SetTableRowModel, fields: SetTableFields) => {
    if (!row.setId) return;
    const validated = validateSetDraft(ex.kind, fields);
    if (!validated.ok) return;
    await saveSetFields(row.setId, validated.body);
  };

  const onCycleType = (ex: SessionExercise, row: SetTableRowModel) => {
    const next = nextSetType((row.setType as SetType) || "working");
    if (row.setId) {
      const set = ex.sets.find((s) => s.id === row.setId);
      if (set) void cycleSetType(set);
      return;
    }
    if (row.extraId) {
      setExtras((prev) => ({
        ...prev,
        [ex.id]: (prev[ex.id] ?? []).map((item) =>
          item.id === row.extraId ? { ...item, setType: next } : item,
        ),
      }));
      return;
    }
    patchDraft(ex.id, { setType: next });
  };

  const onAddExtra = (ex: SessionExercise, rows: SetTableRowModel[]) => {
    const last = rows[rows.length - 1];
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setExtras((prev) => ({
      ...prev,
      [ex.id]: [
        ...(prev[ex.id] ?? []),
        {
          id,
          kg: last?.kg ?? "",
          reps: last?.reps ?? "",
          km: last?.km ?? "",
          time: last?.time ?? "",
          setType: ((last?.setType as SetType) || "working") as SetType,
          rpe: last?.rpe ?? "",
        },
      ],
    }));
  };

  const clock = detail.clockStatus ?? "idle";
  const noteExercise = detail.exercises.find((ex) => ex.id === noteExerciseId) ?? null;
  useEffect(() => {
    if (!noteExercise) return;
    setExerciseRestSecState(getExerciseRestSec(noteExercise.name) ?? restSeconds);
  }, [noteExercise, restSeconds]);
  const historyExercise = detail.exercises.find((ex) => ex.name === historyName) ?? null;

  const workoutMenu: OverflowMenuItem[] = [
    { key: "summary", label: "Итог", onClick: () => setShowSummary(true) },
    { key: "note", label: "Заметка", onClick: () => setNoteOpen(true) },
    {
      key: "paste-sets",
      label: "Вставить прошлые подходы",
      disabled: busy || !detail.exercises.some((ex) => (ex.lastTime?.sets.length ?? 0) > 0),
      onClick: () => void applyAllLastSets(),
    },
    { key: "paste-text", label: "Вставить текстом", onClick: () => setPasteOpen(true) },
    {
      key: "clock",
      label: clock === "running" ? "Пауза" : clock === "paused" ? "Продолжить" : "Старт",
      disabled: clock === "finished" || detail.exercises.length === 0,
      onClick: () =>
        void patchClock(clock === "running" ? "pause" : clock === "paused" ? "resume" : "start"),
    },
    {
      key: "time",
      label: "Время тренировки",
      disabled: clock !== "finished",
      onClick: () => setTimeOpen(true),
    },
    { key: "date", label: "Дата", onClick: () => setDateOpen(true) },
    {
      key: "routine",
      label: "Как шаблон",
      disabled: busy || detail.exercises.length === 0,
      onClick: () =>
        void saveAsRoutine(detail.id, detail.note?.trim() || detail.muscleLabels.join(" · ")),
    },
    ...(clock === "finished"
      ? [{ key: "ration", label: "К рациону", onClick: () => onOpenRation() }]
      : []),
    { key: "delete", label: "Удалить тренировку", danger: true, onClick: () => void deleteSession() },
  ];

  return (
    <div className="gym-session-scene">
      <WorkoutRestTimerBanner
        restEndsAt={restEndsAt}
        restLeft={restLeft}
        restSeconds={restSeconds}
        onSkip={clearRest}
        onAdd={extendRest}
      />
      {showSummary ? (
        <WorkoutSessionSummary
          date={detail.date}
          elapsedSec={sessionElapsedSec({
            startedAt: detail.startedAt ?? null,
            endedAt: detail.endedAt ?? null,
            pausedAt: detail.pausedAt ?? null,
            pausedMs: detail.pausedMs ?? 0,
          })}
          totalLoad={detail.totalLoad}
          cardioDistanceKm={detail.cardioDistanceKm}
          cardioDurationSec={detail.cardioDurationSec}
          cardioOnly={detail.cardioOnly}
          deltaPctVsPrevious={progress?.deltaPctVsPrevious ?? null}
          deltaPctVsTarget={progress?.deltaPctVsTarget ?? null}
          previousLoad={progress?.previousLoad ?? 0}
          targetLoad={progress?.targetLoad ?? 0}
          exercises={summaryExercises}
          recordLines={(detail.prHits ?? []).map((hit) => {
            const rest = hit.label.replace(/^PR\s+/, "");
            return `${hit.name} · ${rest}`;
          })}
          energyLabel={liveEnergyLabel}
          energyNote={liveEnergyCaption}
          nextTargets={nextTargets}
          onClose={() => setShowSummary(false)}
          onBackToList={onSummaryBackToList}
          onGoToRation={onSummaryGoToRation}
        />
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="min-h-[44px] text-sm font-medium text-[var(--accent)]"
          onClick={leave}
        >
          ← К списку
        </button>
        <OverflowMenu label="Действия тренировки" items={workoutMenu} />
      </div>
      <div className="-mt-2 px-0.5">
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
          {formatDateWords(detail.date)}
          {detail.muscleLabels.length ? ` · ${detail.muscleLabels.join(" · ")}` : ""}
        </p>
        <p className="truncate text-xs text-[var(--muted)]">
          {detail.cardioOnly
            ? progressLine
            : [
                detail.totalLoad > 0 ? `${formatWorkoutLoad(detail.totalLoad)} кг·повт` : null,
                delta ? `к прошлой ${delta}` : null,
                detail.date !== todayKey ? "задним числом" : null,
              ]
                .filter(Boolean)
                .join(" · ") || progressLine}
        </p>
      </div>

      <div className="sticky top-0 z-30 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-quiet)] bg-white/95 px-2 py-1 shadow-sm backdrop-blur">
        <button
          type="button"
          className="min-h-[44px] min-w-[44px] px-1 text-left"
          aria-label={
            liveEnergyLabel
              ? `Время тренировки, расход ${liveEnergyLabel}`
              : "Время тренировки"
          }
          onClick={() => {
            if (clock === "idle") void patchClock("start");
          }}
        >
          <span className="block text-lg font-semibold tabular-nums leading-none text-[var(--foreground)]">
            {liveElapsedLabel}
          </span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {CLOCK_HINT[clock]}
          </span>
          {liveEnergyLabel ? (
            <span className="gym-energy-live" title={liveEnergyCaption ?? undefined}>
              <span className="gym-energy-live__kcal">{liveEnergyLabel}</span>
              {liveEnergyCaption ? <span className="gym-energy-live__note">{liveEnergyCaption}</span> : null}
            </span>
          ) : null}
        </button>
        {!detail.cardioOnly && clock !== "finished" ? (
          <RestTimer
            restSeconds={restSeconds}
            setRestSeconds={setRestSeconds}
            restEndsAt={restEndsAt}
            restLeft={restLeft}
            restSound={restSound}
            setRestSound={setRestSound}
            startRest={startRest}
            clearRest={clearRest}
            options={restOptions}
          />
        ) : (
          <span className="text-xs text-[var(--muted)]">{clock === "finished" ? "Завершена" : ""}</span>
        )}
        {clock === "finished" ? (
          <button
            type="button"
            className="min-h-[44px] rounded-xl bg-[var(--accent-ink)] px-3 text-sm font-semibold text-white"
            onClick={() => setShowSummary(true)}
          >
            Итог
          </button>
        ) : (
          <button
            type="button"
            className="min-h-[44px] rounded-xl bg-[var(--accent-ink)] px-3 text-sm font-semibold text-white"
            onClick={() => void patchClock("finish")}
          >
            Завершить
          </button>
        )}
      </div>

      {prToast ? (
        <div
          className="rounded-xl bg-[var(--accent-streak-soft)] px-3 py-2 text-center text-sm font-bold text-[var(--accent-ink)]"
          role="status"
        >
          {prToast}
        </div>
      ) : null}

      {queuedSets > 0 ? (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="min-w-0 font-medium">
            {flushSummary
              ? flushSummary
              : queuedSets === 1
                ? "1 подход ждёт сеть"
                : `${queuedSets} подхода ждут сеть`}
          </p>
          <button
            type="button"
            className="min-h-[44px] shrink-0 px-2 text-xs font-semibold"
            onClick={() => void flushQueuedSets()}
          >
            Отправить
          </button>
        </div>
      ) : flushSummary ? (
        <div className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent-ink)]" role="status">
          {flushSummary}
        </div>
      ) : null}
      {deletedSetNotice ? (
        <div
          className="flex items-center justify-between gap-3 rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm font-medium text-[var(--accent-ink)]"
          role="status"
        >
          <span>Подход удалён</span>
          <button type="button" className="min-h-[44px] font-semibold underline" onClick={undoDeleteSet}>
            Отменить
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {detail.exercises.length === 0 ? (
        <div className="scene-empty">
          <p className="scene-empty__title">Пока нет упражнений</p>
          <p className="scene-empty__hint">
            {clock === "finished"
              ? "Можно добавить упражнения к уже завершённой тренировке."
              : "Добавьте первое — подходы записываются в этой же ленте."}
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {detail.exercises.map((ex, exIndex) => {
          const draft = setDrafts[ex.id] ?? EMPTY_DRAFT;
          const rows = buildSetTableRows({
            kind: ex.kind,
            sets: ex.sets,
            lastSets: ex.lastTime?.sets ?? [],
            draft,
            extraDrafts: extras[ex.id] ?? [],
          });
          const counts = exerciseSetCounts(ex.sets, ex.lastTime?.sets.length ?? 0);
          const goal = bestAndTarget(ex, detail.progressRate, historyByName[ex.name]);
          const bestTarget = formatBestTarget(goal.best, goal.target);
          const lastLine = formatLastTimePhrase(ex.lastTime?.sets?.[0], ex.kind);
          const expanded = expandedId === ex.id;
          const prevEx = detail.exercises[exIndex - 1];
          const addLabel =
            ex.kind === "cardio" ? "+ Отрезок" : ex.kind === "duration" ? "+ Раунд" : "+ Подход";
          const menu: OverflowMenuItem[] = [
            { key: "note", label: "Ещё", onClick: () => setNoteExerciseId(ex.id) },
            {
              key: "history",
              label: "Прогресс и PR",
              onClick: () => {
                setHistoryName(ex.name);
                if (!historyOpen[ex.name]) void toggleExerciseHistory(ex.name, ex.kind, ex.catalogId);
              },
            },
            ...((ex.lastTime?.sets.length ?? 0) > 0
              ? [
                  {
                    key: "last",
                    label: "Вставить прошлые подходы",
                    disabled: busy,
                    onClick: () => {
                      const hist = ex.lastTime?.sets ?? [];
                      void (async () => {
                        for (const set of hist) {
                          const ok = await addSet(ex.id, historyToDraft(set, ex.kind));
                          if (!ok) break;
                        }
                      })();
                    },
                  } satisfies OverflowMenuItem,
                ]
              : []),
            {
              key: "type",
              label: `Тип следующего: ${SET_TYPE_LABELS[(draft.setType as SetType) || "working"]}`,
              onClick: () => patchDraft(ex.id, { setType: nextSetType(draft.setType || "working") }),
            },
            ...BLOCK_MODES.map((mode) => ({
              key: `mode-${mode}`,
              label:
                parseBlockMode(ex.blockMode) === mode
                  ? `✓ ${BLOCK_MODE_LABELS[mode]}`
                  : BLOCK_MODE_LABELS[mode],
              onClick: () => void setExerciseBlockMode(ex.id, mode),
            })),
            ...(prevEx
              ? [
                  {
                    key: "ss",
                    label: "Суперсет с предыдущим",
                    onClick: () => void linkExerciseSuperset(ex.id, prevEx.id),
                  } satisfies OverflowMenuItem,
                ]
              : []),
            ...(ex.supersetGroup
              ? [
                  {
                    key: "ss-off",
                    label: "Убрать из суперсета",
                    onClick: () => void clearExerciseSuperset(ex.id),
                  } satisfies OverflowMenuItem,
                ]
              : []),
            ...(kindUsesRestTimer(ex.kind)
              ? [
                  {
                    key: "rest",
                    label: "Запомнить отдых",
                    onClick: () => rememberExerciseRest(ex.name),
                  } satisfies OverflowMenuItem,
                ]
              : []),
            {
              key: "up",
              label: "Выше",
              disabled: exIndex === 0,
              onClick: () => void moveExercise(ex.id, "up"),
            },
            {
              key: "down",
              label: "Ниже",
              disabled: exIndex === detail.exercises.length - 1,
              onClick: () => void moveExercise(ex.id, "down"),
            },
            ...(ex.sets.length > 0
              ? [
                  {
                    key: "drop-set",
                    label: "Удалить последний подход",
                    onClick: () => {
                      const last = ex.sets.at(-1);
                      if (last) void deleteSet(last.id);
                    },
                  } satisfies OverflowMenuItem,
                ]
              : []),
            {
              key: "delete",
              label: "Удалить упражнение",
              danger: true,
              onClick: () => void deleteExercise(ex.id),
            },
          ];
          return (
            <ExerciseRow
              key={ex.id}
              name={ex.name}
              muscle={ex.muscleLabel ?? EXERCISE_KIND_LABELS[ex.kind]}
              doneLabel={
                ex.blockMode === "circuit" && circuitRound > 1
                  ? `${counts.label} · круг ${circuitRound}`
                  : counts.label
              }
                bestTarget={bestTarget}
                lastLine={lastLine}
                expanded={expanded}
              superset={ex.supersetGroup ?? null}
              pending={ex.sets.some((s) => s.pendingLocal)}
              menu={menu}
              onToggle={() => {
                const next = toggleExpanded(expandedId, ex.id);
                setExpandedId(next);
                if (next) {
                  prevFocus.current = next;
                  setFocusExerciseId(next);
                }
              }}
            >
              <SetTable
                kind={ex.kind}
                rows={rows}
                busy={busy}
                addLabel={addLabel}
                onFieldChange={(row, fields) => onFieldChange(ex, row, fields)}
                onCommit={(row, fields) => void onCommit(ex, row, fields)}
                onLog={(row, fields) => void onLog(ex, row, fields)}
                onCycleType={(row) => onCycleType(ex, row)}
                onAddSet={() => onAddExtra(ex, rows)}
                onMoveSet={(setId, direction) => void moveSet(setId, direction)}
                onDeleteSet={(setId) => void deleteSet(setId)}
              />
              {draftErrors[ex.id] ? (
                <p className="px-3 pb-2 text-sm text-red-600" role="alert">
                  {draftErrors[ex.id]}
                </p>
              ) : null}
            </ExerciseRow>
          );
        })}
      </div>

      <button
        type="button"
        className="min-h-[44px] w-full rounded-xl border border-dashed border-[var(--accent)] bg-white/70 text-sm font-semibold text-[var(--accent-ink)]"
        onClick={() => setAddOpen(true)}
      >
        + Упражнение
      </button>

      {addOpen ? (
        <ExerciseAddSheet
          busy={busy}
          kind={newExerciseKind}
          name={exerciseName}
          suggestions={(insights?.suggestions ?? []).slice(0, 8).map((s) => ({
            name: s.name,
            count: s.count,
          }))}
          onKind={setNewExerciseKind}
          onName={setExerciseName}
          onAdd={(name, kind, extra) => {
            const typed = (name ?? exerciseName).trim();
            if (!typed) return;
            void addExercise(name, kind, extra).then(() => setAddOpen(false));
          }}
          onClose={() => setAddOpen(false)}
        />
      ) : null}

      {noteOpen ? (
        <SessionSheet title="Заметка к тренировке" onClose={() => setNoteOpen(false)}>
          <input
            className="min-h-[44px] w-full rounded-lg border border-[var(--border-quiet)] px-3 text-base"
            defaultValue={detail.note ?? ""}
            placeholder="Самочувствие, зал…"
            onBlur={(e) => {
              if ((detail.note ?? "") !== e.target.value.trim()) void saveSessionNote(e.target.value);
            }}
          />
        </SessionSheet>
      ) : null}

      {noteExercise ? (
        <SessionSheet title="Ещё" onClose={() => setNoteExerciseId(null)}>
          <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">{noteExercise.name}</p>
          <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
            Заметка
            <input
              className="min-h-[44px] rounded-lg border border-[var(--border-quiet)] px-3 text-base text-[var(--foreground)]"
              defaultValue={noteExercise.note ?? ""}
              placeholder="Хват, амплитуда…"
              onBlur={(e) => {
                if ((noteExercise.note ?? "") !== e.target.value.trim()) {
                  void saveExerciseNote(noteExercise.id, e.target.value);
                }
              }}
            />
          </label>
          <div className="mt-3">
            <p className="text-xs text-[var(--muted)]">Отдых после этого упражнения</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {REST_OPTIONS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`gym-chip ${exerciseRestSec === sec ? "is-on" : ""}`}
                    onClick={() => {
                      setExerciseRestSec(noteExercise.name, sec);
                      setExerciseRestSecState(sec);
                    }}
                  >
                    {sec} с
                  </button>
                ))}
            </div>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-xs text-[var(--muted)]">
            Усилие, RPE
            <input
              inputMode="decimal"
              className="min-h-[44px] rounded-lg border border-[var(--border-quiet)] px-3 text-base"
              placeholder="8"
              value={(setDrafts[noteExercise.id] ?? EMPTY_DRAFT).rpe}
              onChange={(e) => patchDraft(noteExercise.id, { rpe: e.target.value })}
            />
          </label>
        </SessionSheet>
      ) : null}

      {pasteOpen ? (
        <SessionSheet title="Вставить текстом" onClose={() => setPasteOpen(false)}>
          <p className="text-xs text-[var(--muted)]">
            Пример: «Жим лёжа 80x8, 80x8» — по строке на упражнение.
          </p>
          <textarea
            className="mt-2 w-full rounded-lg border border-[var(--border-quiet)] px-3 py-2 text-base"
            rows={4}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"Жим лёжа 80x8, 82.5x6\nТяга блока 40x12"}
          />
          <button
            type="button"
            disabled={busy || !pasteText.trim()}
            className="mt-2 min-h-[44px] w-full rounded-lg bg-[var(--accent)] text-sm font-semibold text-white disabled:opacity-40"
            onClick={() => void applyPasteLog().then(() => setPasteOpen(false))}
          >
            Разобрать и добавить
          </button>
        </SessionSheet>
      ) : null}

      {timeOpen ? (
        <SessionSheet title="Время тренировки" onClose={() => setTimeOpen(false)}>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-medium text-[var(--muted-strong)]">
              Начало
              <input
                type="time"
                value={editStartTime}
                disabled={busy || timeBusy}
                onChange={(e) => setEditStartTime(e.target.value)}
                className="mt-1 block min-h-[44px] rounded-lg border border-[var(--border-quiet)] px-2 text-base tabular-nums"
              />
            </label>
            <label className="text-xs font-medium text-[var(--muted-strong)]">
              Конец
              <input
                type="time"
                value={editEndTime}
                disabled={busy || timeBusy}
                onChange={(e) => setEditEndTime(e.target.value)}
                className="mt-1 block min-h-[44px] rounded-lg border border-[var(--border-quiet)] px-2 text-base tabular-nums"
              />
            </label>
            <button
              type="button"
              disabled={busy || timeBusy}
              className="min-h-[44px] rounded-lg bg-[var(--accent)] px-3 text-sm font-semibold text-white disabled:opacity-40"
              onClick={() => {
                const startIso = dateKeyAndTimeToIso(detail.date, editStartTime);
                let endIso = dateKeyAndTimeToIso(detail.date, editEndTime);
                if (!startIso || !endIso) return;
                if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
                  endIso = new Date(new Date(endIso).getTime() + 24 * 60 * 60 * 1000).toISOString();
                }
                setTimeBusy(true);
                void patchSessionTimes({ startedAt: startIso, endedAt: endIso }).finally(() =>
                  setTimeBusy(false),
                );
              }}
            >
              {timeBusy ? "…" : "Сохранить время"}
            </button>
          </div>
        </SessionSheet>
      ) : null}

      {dateOpen ? (
        <SessionSheet title="Дата тренировки" onClose={() => setDateOpen(false)}>
          <input
            type="date"
            value={detail.date}
            disabled={busy}
            className="min-h-[44px] rounded-lg border border-[var(--border-quiet)] px-3 text-base"
            onChange={(e) => {
              const next = e.target.value;
              if (next && next !== detail.date) void patchSessionDate(next);
            }}
          />
        </SessionSheet>
      ) : null}

      {historyExercise ? (
        <ExerciseHistorySheet
          name={historyExercise.name}
          kind={historyExercise.kind}
          bundle={historyByName[historyExercise.name]}
          onMetric={(metric) =>
            setHistoryByName((prev) => ({
              ...prev,
              [historyExercise.name]: { ...prev[historyExercise.name]!, metric },
            }))
          }
          onClose={() => {
            if (historyOpen[historyExercise.name]) {
              void toggleExerciseHistory(
                historyExercise.name,
                historyExercise.kind,
                historyExercise.catalogId,
              );
            }
            setHistoryName(null);
          }}
        />
      ) : null}
    </div>
  );
}
