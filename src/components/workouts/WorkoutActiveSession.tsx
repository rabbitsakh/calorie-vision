"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  formatDateShort,
  formatDateWords,
} from "@/lib/dates";
import {
  formatDistanceKm,
  formatDurationMinutes,
  formatPace,
  formatPaceClock,
} from "@/lib/workouts/cardio";
import {
  EXERCISE_KINDS,
  EXERCISE_KIND_LABELS,
  EXERCISE_KIND_PLACEHOLDERS,
  fieldsForKind,
  kindUsesRestTimer,
  type ExerciseKind,
} from "@/lib/workouts/exercise-kind";
import { sessionElapsedSec } from "@/lib/workouts/session-clock";
import { formatWorkoutLoad } from "@/lib/workouts/format";
import {
  BLOCK_MODE_LABELS,
  BLOCK_MODES,
  type BlockMode,
  parseBlockMode,
} from "@/lib/workouts/block-mode";
import {
  adviseCardioProgression,
  adviseProgression,
  bumpKg,
  type ProgressionAdvice,
} from "@/lib/workouts/progression";
import { pickLastWorkingWeight, suggestNextWeightKg, formatSuggestedKg } from "@/lib/workouts/suggested-load";
import { WorkoutInlineSetRow } from "@/components/workouts/WorkoutInlineSetRow";
import {
  WorkoutRestTimerBanner,
  WorkoutRestTimerControls,
} from "@/components/workouts/WorkoutRestTimer";
import { WorkoutLiveStage } from "@/components/workouts/WorkoutLiveStage";
import { WorkoutSessionSummary } from "@/components/workouts/WorkoutSessionSummary";
import {
  EFFORT_FIELD_ARIA,
  EFFORT_FIELD_HINT,
  EFFORT_FIELD_LABEL,
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

const formatLoad = formatWorkoutLoad;

function sparklinePath(values: number[], width: number, height: number): string {
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
  highlightLast,
}: {
  points: ChartPoint[];
  metric: HistoryBundle["metric"];
  highlightLast?: boolean;
}) {
  const values = points
    .map((p) => {
      if (metric === "weight") return p.weight;
      if (metric === "volume") return p.volume;
      if (metric === "pace") return p.pace ?? 0;
      if (metric === "reps") return p.reps;
      if (metric === "distance") return p.distance;
      return p.duration;
    })
    .filter((v) => Number.isFinite(v) && (metric === "pace" ? v > 0 : true));
  if (values.length < 2) {
    return <p className="mt-2 text-xs text-[var(--muted)]">Мало точек для графика</p>;
  }
  const w = 240;
  const h = 56;
  const d = sparklinePath(values, w, h);
  const last = values[values.length - 1]!;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lx = ((values.length - 1) / (values.length - 1)) * w;
  const ly = h - ((last - min) / span) * (h - 4) - 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-14 w-full max-w-xs" aria-hidden>
      <path d={d} fill="none" stroke="var(--accent, #0f766e)" strokeWidth="2" />
      {highlightLast ? (
        <circle cx={lx} cy={ly} r="3.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="1" />
      ) : null}
    </svg>
  );
}

function formatPct(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}%`;
}

function lastSetHint(lastTime: SessionExercise["lastTime"], kind: ExerciseKind): string | null {
  if (!lastTime?.sets.length) return null;
  const parts = lastTime.sets.map((s) =>
    formatHistoryChip(s, kind === "cardio" || lastTime.kind === "cardio" ? "cardio" : kind),
  );
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
    return set.durationSec != null && set.durationSec > 0 ? formatDurationMinutes(set.durationSec) : "—";
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

export type WorkoutActiveSessionProps = {
  detail: SessionDetail;
  progress: Progress | null;
  todayKey: string;
  progressLine: string | null;
  showSummary: boolean;
  setShowSummary: (v: boolean) => void;
  stageOpen: boolean;
  setStageOpen: (v: boolean) => void;
  busy: boolean;
  error: string | null;
  restSeconds: number;
  setRestSeconds: (n: number) => void;
  restEndsAt: number | null;
  restLeft: number;
  restSound: boolean;
  setRestSound: (v: boolean) => void;
  startRest: () => void;
  clearRest: () => void;
  restOptions: readonly number[];
  liveElapsedLabel: string;
  focusExerciseId: string | null;
  setFocusExerciseId: (id: string | null) => void;
  focusExForStage: SessionExercise | undefined;
  stageAdvice: ProgressionAdvice | null;
  stageSuggestedKg: number | null;
  stageDraft: SetDraft;
  circuitRound: number;
  prToast: string | null;
  draftErrors: Record<string, string>;
  setDrafts: Record<string, SetDraft>;
  historyByName: Record<string, HistoryBundle>;
  historyOpen: Record<string, boolean>;
  setHistoryByName: Dispatch<SetStateAction<Record<string, HistoryBundle>>>;
  queuedSets: number;
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
  onRememberRestOnStage: () => void;
  patchDraft: (exerciseId: string, patch: Partial<SetDraft>) => void;
  nextSetType: (current: SetType) => SetType;
  completeCurrentOnStage: () => Promise<void>;
  addAndCompleteOnStage: () => Promise<void>;
  restPauseOnStage: () => void;
  patchClock: (action: "start" | "pause" | "resume" | "finish") => Promise<void>;
  saveAsRoutine: (sessionId: string, name: string) => Promise<void>;
  deleteSession: () => Promise<void>;
  toggleExerciseHistory: (name: string, kind: ExerciseKind) => Promise<void>;
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
  deleteExercise: (exerciseId: string) => Promise<void>;
  applyLastSet: (exerciseId: string, set: HistorySet, kind: ExerciseKind) => void;
  addSet: (exerciseId: string) => Promise<void>;
  addExercise: (name?: string, kind?: ExerciseKind) => Promise<void>;
  applyPasteLog: () => Promise<void>;
};

export function WorkoutActiveSession({
  detail,
  progress,
  todayKey,
  progressLine,
  showSummary,
  setShowSummary,
  stageOpen,
  setStageOpen,
  busy,
  error,
  restSeconds,
  setRestSeconds,
  restEndsAt,
  restLeft,
  restSound,
  setRestSound,
  startRest,
  clearRest,
  restOptions,
  liveElapsedLabel,
  focusExerciseId,
  setFocusExerciseId,
  focusExForStage,
  stageAdvice,
  stageSuggestedKg,
  stageDraft,
  circuitRound,
  prToast,
  draftErrors,
  setDrafts,
  historyByName,
  historyOpen,
  setHistoryByName,
  queuedSets,
  insights,
  libraryHits,
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
  onRememberRestOnStage,
  patchDraft,
  nextSetType,
  completeCurrentOnStage,
  addAndCompleteOnStage,
  restPauseOnStage,
  patchClock,
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
  deleteExercise,
  applyLastSet,
  addSet,
  addExercise,
  applyPasteLog,
}: WorkoutActiveSessionProps) {
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
        onBackToList={onSummaryBackToList}
        onGoToRation={onSummaryGoToRation}
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
            distanceKm: s.distanceKm,
            durationSec: s.durationSec,
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
        draftKm={stageDraft.km}
        draftTime={stageDraft.time}
        draftSetType={stageDraft.setType}
        draftRpe={stageDraft.rpe}
        circuitRound={circuitRound}
        prToast={prToast}
        draftError={draftErrors[focusExForStage.id] ?? null}
        onDraftKg={(v) => patchDraft(focusExForStage.id, { kg: v })}
        onDraftReps={(v) => patchDraft(focusExForStage.id, { reps: v })}
        onDraftKm={(v) => patchDraft(focusExForStage.id, { km: v })}
        onDraftTime={(v) => patchDraft(focusExForStage.id, { time: v })}
        onDraftRpe={(v) => patchDraft(focusExForStage.id, { rpe: v })}
        onCycleSetType={() =>
          patchDraft(focusExForStage.id, { setType: nextSetType(stageDraft.setType) })
        }
        onBumpKg={(delta) => {
          const cur = Number(stageDraft.kg.replace(",", ".")) || 0;
          patchDraft(focusExForStage.id, { kg: String(bumpKg(cur, delta)) });
        }}
        onApplySuggested={() => {
          if (stageSuggestedKg == null) return;
          patchDraft(focusExForStage.id, {
            kg: formatSuggestedKg(stageSuggestedKg),
          });
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
        onRememberRest={onRememberRestOnStage}
        busy={busy}
      />
    ) : null}

    <div className="flex items-start justify-between gap-3">
      <div>
        <button
          type="button"
          className="text-sm font-medium text-[var(--accent)]"
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
        <h2 className="mt-1 text-xl font-semibold text-[var(--foreground)]">
          {formatDateWords(detail.date)}
          {detail.date !== todayKey ? (
            <span className="ml-2 text-sm font-medium text-amber-700">задним числом</span>
          ) : null}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted-strong)]">{detail.muscleLabels.join(" · ")}</p>
        {detail.clockStatus === "finished" ? (
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-[var(--accent)] underline-offset-2 hover:underline"
            onClick={() => onOpenRation()}
          >
            К рациону
          </button>
        ) : null}
      </div>
      <details className="relative shrink-0">
        <summary className="cursor-pointer list-none rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--muted-strong)] hover:bg-[var(--surface-mist)] [&::-webkit-details-marker]:hidden">
          Ещё ▾
        </summary>
        <div className="absolute right-0 z-20 mt-1 flex min-w-[9rem] flex-col rounded-xl border border-[var(--border-quiet)] bg-white py-1 shadow-md">
          <button
            type="button"
            disabled={busy || detail.exercises.length === 0}
            className="px-3 py-2 text-left text-sm font-medium text-[var(--accent)] disabled:opacity-40"
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
            className="px-3 py-2 text-left text-sm text-red-600"
            onClick={() => void deleteSession()}
          >
            Удалить
          </button>
        </div>
      </details>
    </div>

    {detail.date === todayKey || detail.startedAt ? (
      <section className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
              Таймер тренировки
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--foreground)]">
              {liveElapsedLabel}
            </p>
            <p className="text-xs text-[var(--muted)]">
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
            {detail.exercises.length > 0 &&
            (detail.clockStatus === "idle" || !detail.startedAt) ? (
              <button
                type="button"
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
                onClick={() => void patchClock("start")}
              >
                Старт
              </button>
            ) : null}
            {detail.clockStatus !== "finished" && detail.exercises.length > 0 ? (
              <button
                type="button"
                className="rounded-lg bg-[var(--accent-ink)] px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  if (!detail.startedAt) void patchClock("start");
                  setStageOpen(true);
                  if (focusExerciseId && !historyByName[focusExForStage?.name ?? ""]) {
                    void toggleExerciseHistory(
                      focusExForStage!.name,
                      focusExForStage!.kind,
                    );
                  }
                }}
              >
                К подходам
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
                className="rounded-lg border border-[rgba(13,115,119,0.14)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
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
                className="rounded-lg border border-[rgba(13,115,119,0.14)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
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
            options={restOptions}
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

    {!stageOpen && prToast ? (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm font-bold text-amber-950">
        {prToast}
      </div>
    ) : null}

    <section className="rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white p-4">
      {detail.cardioOnly ? (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Кардио · км / мин
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--foreground)]">
            {detail.cardioDistanceKm > 0
              ? `${formatDistanceKm(detail.cardioDistanceKm)} км`
              : formatDurationMinutes(detail.cardioDurationSec)}
          </p>
          {progressLine ? <p className="mt-2 text-sm text-[var(--muted-strong)]">{progressLine}</p> : null}
        </>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Нагрузка, кг·повт
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-[var(--foreground)]">
            {formatLoad(detail.totalLoad)}
          </p>
          {progressLine ? <p className="mt-2 text-sm text-[var(--muted-strong)]">{progressLine}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {delta ? (
              <span
                className={
                  progress && (progress.deltaPctVsPrevious ?? 0) >= 0
                    ? "text-teal-700"
                    : "text-[var(--muted-strong)]"
                }
              >
                к прошлой {delta}
              </span>
            ) : null}
            {vsTarget && progress?.targetLoad ? (
              <span className="text-[var(--muted)]">к цели {vsTarget}</span>
            ) : null}
          </div>
        </>
      )}
    </section>

    <section className="rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white p-4">
      <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
        Заметка к тренировке
        <input
          className="rounded-lg border border-[rgba(13,115,119,0.14)] px-3 py-2 text-base text-[var(--foreground)]"
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

    {queuedSets > 0 ? (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        <p className="min-w-0 font-medium">
          {queuedSets === 1
            ? "1 подход ждёт сеть"
            : `${queuedSets} подхода ждут сеть`}
        </p>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-amber-900/10 px-3 py-1 text-xs font-semibold hover:bg-amber-900/15"
          onClick={() => void flushQueuedSets()}
        >
          Отправить
        </button>
      </div>
    ) : null}
    {error ? <p className="text-sm text-red-600">{error}</p> : null}

    {/* List is always a vertical stack. One-exercise paging lives only in «К подходам» stage. */}
    {detail.exercises.length === 0 && detail.clockStatus !== "finished" ? (
      <p className="rounded-2xl border border-dashed border-[rgba(13,115,119,0.22)] bg-[var(--accent-soft)]/40 px-4 py-3 text-sm text-[var(--muted-strong)]">
        Пока нет упражнений. Добавьте первое ниже — потом «Старт» таймера или «К
        подходам» для записи весов.
      </p>
    ) : null}
    <div className="flex flex-col gap-3">
      {detail.exercises.map((ex, exIndex) => {
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
        const prevCardioPace =
          hist?.points
            .map((p) => p.bestPaceSecPerKm)
            .filter((p): p is number => p != null && p > 0)
            .sort((a, b) => a - b)[0] ?? ex.cardioBestPaceSecPerKm;
        const progression = isCardio
          ? adviseCardioProgression({
              lastDistanceKm: ex.cardioDistanceKm,
              lastDurationSec: ex.cardioDurationSec,
              previousBestPaceSecPerKm: prevCardioPace,
            })
          : hist
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
            className={`rounded-[var(--radius-lg)] border bg-white p-4 ${
              ex.supersetGroup ? "border-teal-300" : "border-[var(--border-hairline)]"
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
                  <h3 className="font-semibold text-[var(--foreground)]">{ex.name}</h3>
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                    {EXERCISE_KIND_LABELS[ex.kind]}
                  </span>
                  <button
                    type="button"
                    className="rounded px-1.5 text-xs text-[var(--muted)] hover:bg-[var(--accent-soft)]"
                    title="Выше"
                    onClick={() => void moveExercise(ex.id, "up")}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded px-1.5 text-xs text-[var(--muted)] hover:bg-[var(--accent-soft)]"
                    title="Ниже"
                    onClick={() => void moveExercise(ex.id, "down")}
                  >
                    ↓
                  </button>
                </div>
                <p className="text-xs text-[var(--muted)]">
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
                {progression && (progression.kind === "stall" || isCardio) ? (
                  <p
                    className={`mt-1 text-xs ${
                      progression.kind === "stall" || progression.kind === "hold"
                        ? "text-amber-800"
                        : "text-[var(--accent)]"
                    }`}
                  >
                    {progression.detail}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {BLOCK_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        parseBlockMode(ex.blockMode) === mode
                          ? "bg-teal-700 text-white"
                          : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
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
                      className="text-[var(--muted)]"
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
                className="text-xs text-[var(--muted)] hover:text-red-600"
                onClick={() => void deleteExercise(ex.id)}
              >
                Удалить
              </button>
            </div>

            {historyOpen[ex.name] ? (
              <div className="mt-2 rounded-lg bg-[var(--surface-mist)] px-3 py-2 text-xs text-[var(--muted-strong)]">
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
                            historyByName[ex.name]!.metric === m
                              ? "bg-teal-700 text-white"
                              : "bg-white text-[var(--muted-strong)]"
                          }`}
                          onClick={() =>
                            setHistoryByName((prev) => ({
                              ...prev,
                              [ex.name]: {
                                ...prev[ex.name]!,
                                metric: m as HistoryBundle["metric"],
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
                      metric={historyByName[ex.name]!.metric}
                      highlightLast
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

            <label className="mt-2 flex flex-col gap-1 text-xs text-[var(--muted)]">
              Заметка
              <input
                className="rounded-lg border border-[rgba(13,115,119,0.14)] px-2 py-2 text-base text-[var(--foreground)]"
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

            {ex.lastTime?.sets?.length ? (
              <div className="mt-3 rounded-[var(--radius-md)] bg-[var(--surface-mist)] px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Прошлые подходы
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">
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

            <div className="mt-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-end gap-2">
                {spec.usesDistance ? (
                  <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                    Км
                    <input
                      data-draft-field={`${ex.id}-km`}
                      inputMode="decimal"
                      className={`w-24 rounded-lg border px-2 py-2 text-base text-[var(--foreground)] ${
                        draftErrors[ex.id] && !draft.km.trim()
                          ? "border-red-400"
                          : "border-[rgba(13,115,119,0.14)]"
                      }`}
                      value={draft.km}
                      onChange={(e) => patchDraft(ex.id, { km: e.target.value })}
                    />
                  </label>
                ) : null}
                {spec.usesDuration ? (
                  <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                    Мин
                    <input
                      data-draft-field={`${ex.id}-time`}
                      inputMode="decimal"
                      className={`w-24 rounded-lg border px-2 py-2 text-base text-[var(--foreground)] ${
                        draftErrors[ex.id] && !draft.time.trim()
                          ? "border-red-400"
                          : "border-[rgba(13,115,119,0.14)]"
                      }`}
                      placeholder={ex.kind === "duration" ? "1" : "30"}
                      value={draft.time}
                      onChange={(e) => patchDraft(ex.id, { time: e.target.value })}
                    />
                  </label>
                ) : null}
                {spec.usesWeight ? (
                  <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                    {ex.kind === "assisted"
                      ? "Помощь"
                      : ex.kind === "weighted_bw"
                        ? "+Кг"
                        : "Кг"}
                    <input
                      data-draft-field={`${ex.id}-kg`}
                      inputMode="decimal"
                      className={`w-20 rounded-lg border px-2 py-2 text-base text-[var(--foreground)] ${
                        draftErrors[ex.id] && !draft.kg.trim()
                          ? "border-red-400"
                          : "border-[rgba(13,115,119,0.14)]"
                      }`}
                      value={draft.kg}
                      onChange={(e) => patchDraft(ex.id, { kg: e.target.value })}
                    />
                  </label>
                ) : null}
                {spec.usesReps ? (
                  <label className="flex flex-col gap-1 text-xs text-[var(--muted)]">
                    Повт.
                    <input
                      data-draft-field={`${ex.id}-reps`}
                      inputMode="numeric"
                      className={`w-20 rounded-lg border px-2 py-2 text-base text-[var(--foreground)] ${
                        draftErrors[ex.id] && !draft.reps.trim()
                          ? "border-red-400"
                          : "border-[rgba(13,115,119,0.14)]"
                      }`}
                      value={draft.reps}
                      onChange={(e) => patchDraft(ex.id, { reps: e.target.value })}
                    />
                  </label>
                ) : null}
                {ex.kind !== "cardio" ? (
                  <button
                    type="button"
                    title={`${SET_TYPE_LABELS[draft.setType]} — нажмите, чтобы сменить тип подхода`}
                    className="rounded-lg border border-[rgba(13,115,119,0.14)] bg-white px-2 py-2 text-xs font-bold text-[var(--muted-strong)]"
                    onClick={() =>
                      patchDraft(ex.id, { setType: nextSetType(draft.setType) })
                    }
                  >
                    {SET_TYPE_SHORT[draft.setType]}
                  </button>
                ) : null}
                {kindUsesRestTimer(ex.kind) ? (
                  <label
                    className="flex flex-col gap-1 text-xs text-[var(--muted)]"
                    title={EFFORT_FIELD_ARIA}
                  >
                    {EFFORT_FIELD_LABEL}
                    <input
                      inputMode="decimal"
                      className="w-14 rounded-lg border border-[rgba(13,115,119,0.14)] px-2 py-2 text-base text-[var(--foreground)]"
                      placeholder="8"
                      aria-label={EFFORT_FIELD_ARIA}
                      value={draft.rpe}
                      onChange={(e) => patchDraft(ex.id, { rpe: e.target.value })}
                    />
                  </label>
                ) : null}
                {suggestedKg != null && spec.usesWeight ? (
                  <button
                    type="button"
                    className="rounded-lg border border-teal-200 bg-teal-50 px-2 py-2 text-xs font-semibold text-teal-900"
                    onClick={() =>
                      patchDraft(ex.id, { kg: formatSuggestedKg(suggestedKg) })
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
                  {isCardio
                    ? "+ Отрезок"
                    : ex.kind === "duration"
                      ? "+ Раунд"
                      : "+ Подход"}
                </button>
              </div>
              {ex.kind !== "cardio" ? (
                <p className="text-[11px] leading-snug text-[var(--muted)]">
                  Тип: {SET_TYPE_LABELS[draft.setType]}
                  {draft.setType === "rest_pause"
                    ? " — короткий отдых внутри подхода"
                    : ""}
                  {" · "}
                  {EFFORT_FIELD_LABEL}: {EFFORT_FIELD_HINT}
                </p>
              ) : null}
              {draftErrors[ex.id] ? (
                <p className="text-sm text-red-600" role="alert">
                  {draftErrors[ex.id]}
                </p>
              ) : null}
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
            className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--muted-strong)] hover:bg-teal-50 hover:text-teal-900"
            onClick={() => void addExercise(s.name)}
          >
            {s.name}
          </button>
        ))}
      </div>
    ) : null}

    <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-[rgba(13,115,119,0.22)] p-4">
      <div className="flex flex-wrap gap-1">
        {EXERCISE_KINDS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setNewExerciseKind(key)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              newExerciseKind === key
                ? "bg-teal-700 text-white"
                : "bg-[var(--accent-soft)] text-[var(--muted-strong)]"
            }`}
          >
            {EXERCISE_KIND_LABELS[key]}
          </button>
        ))}
      </div>
      <div className="relative flex flex-wrap items-end gap-2">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-[var(--muted)]">
          Упражнение
          <input
            className="rounded-lg border border-[rgba(13,115,119,0.14)] px-3 py-2 text-base text-[var(--foreground)]"
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
          className="rounded-lg border border-[rgba(13,115,119,0.14)] bg-white px-3 py-2 text-sm font-semibold text-[var(--foreground)]"
          onClick={() => void addExercise()}
        >
          Добавить упражнение
        </button>
        {libraryHits.length > 0 ? (
          <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-auto rounded-xl border border-[rgba(13,115,119,0.14)] bg-white py-1 shadow-md">
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
                  <span className="font-medium text-[var(--foreground)]">{hit.name}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {EXERCISE_KIND_LABELS[hit.kind]} · {hit.useCount}×
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>

    <section className="rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        Вставить текстом
      </p>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Пример: «Жим лёжа 80x8, 80x8» — по строке на упражнение. Свободный текст — через AI.
      </p>
      <textarea
        className="mt-2 w-full rounded-lg border border-[rgba(13,115,119,0.14)] px-3 py-2 text-base text-[var(--foreground)]"
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
