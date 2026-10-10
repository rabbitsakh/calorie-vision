"use client";

import { useCallback, useEffect, useState } from "react";
import {
  countFailedSaves,
  countPendingRecognitions,
  listFailedSaves,
  listPendingRecognitions,
  pendingRecognitionToFile,
  removeMealDraft,
  subscribeMealDraftQueue,
  upsertPendingConfirmDraft,
} from "@/lib/meal-draft-queue";
import {
  countWaterDrafts,
  listWaterDrafts,
  removeWaterDraft,
  subscribeWaterDraftQueue,
} from "@/lib/water-draft-queue";
import {
  countWeightDrafts,
  listWeightDrafts,
  removeWeightDraft,
  subscribeWeightDraftQueue,
} from "@/lib/weight-draft-queue";
import {
  countLocalWorkoutSessions,
  subscribeLocalWorkoutSessions,
} from "@/lib/workout-local-session";
import { flushLocalWorkoutSessions } from "@/lib/workout-local-session-flush";
import {
  countWorkoutExerciseDrafts,
  subscribeWorkoutExerciseDraftQueue,
} from "@/lib/workout-exercise-draft-queue";
import { flushWorkoutExerciseDrafts } from "@/lib/workout-exercise-draft-flush";
import {
  countWorkoutFinishDrafts,
  countWorkoutSetDrafts,
  listWorkoutFinishDrafts,
  listWorkoutSetDrafts,
  removeWorkoutFinishDraft,
  removeWorkoutSetDraft,
  subscribeWorkoutSetDraftQueue,
} from "@/lib/workout-set-draft-queue";
import { emitMascotReaction } from "@/lib/mascot-reactions";
import { isLikelyOfflineError, subscribeConnectivity } from "@/lib/connectivity";
import { isNetworkFetchError, recognizePhotoFile } from "@/lib/recognize-photo-client";
import { withBasePath } from "@/lib/paths";

type OfflineMealQueueBannerProps = {
  selectedDate?: string;
  onFlushed?: () => void;
  /** Fired when a queued photo was recognized — parent can open confirm card. */
  onRecognitionReady?: (selectedDate: string) => void;
};

/** Sync surface for offline drafts (photos, meals, water, weight, gym sets). */
export function OfflineMealQueueBanner({
  selectedDate: _selectedDate,
  onFlushed,
  onRecognitionReady,
}: OfflineMealQueueBannerProps) {
  const [failedCount, setFailedCount] = useState(0);
  const [recognitionCount, setRecognitionCount] = useState(0);
  const [waterCount, setWaterCount] = useState(0);
  const [weightCount, setWeightCount] = useState(0);
  const [workoutSetCount, setWorkoutSetCount] = useState(0);
  const [workoutFinishCount, setWorkoutFinishCount] = useState(0);
  const [workoutLocalCount, setWorkoutLocalCount] = useState(0);
  const [workoutExerciseCount, setWorkoutExerciseCount] = useState(0);
  const [flushing, setFlushing] = useState(false);
  // Optimistic online — Android WebView lies about navigator.onLine.
  const [online, setOnline] = useState(true);

  const refreshCounts = useCallback(() => {
    setFailedCount(countFailedSaves());
    setRecognitionCount(countPendingRecognitions());
    setWaterCount(countWaterDrafts());
    setWeightCount(countWeightDrafts());
    setWorkoutSetCount(countWorkoutSetDrafts());
    setWorkoutFinishCount(countWorkoutFinishDrafts());
    setWorkoutLocalCount(countLocalWorkoutSessions());
    setWorkoutExerciseCount(countWorkoutExerciseDrafts());
  }, []);

  useEffect(() => {
    refreshCounts();
    const unsubs = [
      subscribeMealDraftQueue(refreshCounts),
      subscribeWaterDraftQueue(refreshCounts),
      subscribeWeightDraftQueue(refreshCounts),
      subscribeWorkoutSetDraftQueue(refreshCounts),
      subscribeLocalWorkoutSessions(refreshCounts),
      subscribeWorkoutExerciseDraftQueue(refreshCounts),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [refreshCounts]);

  const flush = useCallback(async () => {
    const pending = listPendingRecognitions();
    const failed = listFailedSaves();
    const water = listWaterDrafts();
    const weights = listWeightDrafts();
    const workoutSets = listWorkoutSetDrafts();
    const workoutFinishes = listWorkoutFinishDrafts();
    const workoutLocals = countLocalWorkoutSessions();
    const workoutExercises = countWorkoutExerciseDrafts();
    if (
      pending.length === 0 &&
      failed.length === 0 &&
      water.length === 0 &&
      weights.length === 0 &&
      workoutSets.length === 0 &&
      workoutFinishes.length === 0 &&
      workoutLocals === 0 &&
      workoutExercises === 0
    ) {
      return;
    }

    setFlushing(true);
    let savedAny = false;
    let recognizedAny = false;

    try {
      const localFlush = await flushLocalWorkoutSessions();
      if (localFlush.flushed > 0) savedAny = true;
      const exFlush = await flushWorkoutExerciseDrafts();
      if (exFlush.flushed > 0) savedAny = true;

      for (const item of pending) {
        try {
          const file = await pendingRecognitionToFile(item);
          if (!file) {
            removeMealDraft(item.id);
            continue;
          }

          const result = await recognizePhotoFile(file, {
            restaurantMode: item.restaurantMode,
            barcode: item.barcode,
          });
          upsertPendingConfirmDraft(item.selectedDate, result);
          removeMealDraft(item.id);
          recognizedAny = true;
          onRecognitionReady?.(item.selectedDate);
        } catch (err) {
          if (isNetworkFetchError(err)) {
            break;
          }
          removeMealDraft(item.id);
        }
      }

      for (const item of failed) {
        try {
          const response = await fetch(withBasePath("/api/meals"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.body),
          });
          if (!response.ok) continue;
          removeMealDraft(item.id);
          savedAny = true;
        } catch {
          // stay queued
        }
      }

      for (const item of water) {
        try {
          const response = await fetch(withBasePath("/api/water"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: item.selectedDate, ml: item.ml }),
          });
          if (!response.ok) break;
          removeWaterDraft(item.id);
          savedAny = true;
        } catch {
          break;
        }
      }

      for (const item of weights) {
        try {
          const response = await fetch(withBasePath("/api/weights"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: item.date,
              weightKg: item.weightKg,
              measuredAt: item.measuredAt,
              note: item.note,
            }),
          });
          if (!response.ok) break;
          removeWeightDraft(item.id);
          savedAny = true;
        } catch {
          break;
        }
      }

      for (const item of workoutSets) {
        try {
          const response = await fetch(
            withBasePath(`/api/workouts/exercises/${item.exerciseId}/sets`),
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item.body),
            },
          );
          if (!response.ok) continue;
          removeWorkoutSetDraft(item.id);
          savedAny = true;
        } catch (err) {
          // Network flake — stop so we don't spin remaining drafts.
          if (isLikelyOfflineError(err)) break;
          // stay queued
        }
      }

      for (const item of workoutFinishes) {
        try {
          const response = await fetch(withBasePath(`/api/workouts/${item.sessionId}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clock: "finish" }),
          });
          if (!response.ok) continue;
          removeWorkoutFinishDraft(item.id);
          savedAny = true;
        } catch (err) {
          if (isLikelyOfflineError(err)) break;
        }
      }
    } finally {
      setFlushing(false);
      refreshCounts();
      if (savedAny || recognizedAny) {
        if (savedAny) {
          emitMascotReaction("save");
        }
        onFlushed?.();
      }
    }
  }, [onFlushed, onRecognitionReady, refreshCounts]);

  useEffect(() => {
    let wasOnline = true;
    return subscribeConnectivity((next) => {
      setOnline(next);
      // Probe can recover without a browser `online` event — flush then.
      if (next && !wasOnline) {
        void flush();
      }
      wasOnline = next;
    });
  }, [flush]);

  const totalCount =
    failedCount +
    recognitionCount +
    waterCount +
    weightCount +
    workoutSetCount +
    workoutFinishCount +
    workoutLocalCount +
    workoutExerciseCount;
  if (totalCount <= 0) return null;

  const lines: string[] = [];
  if (recognitionCount > 0) {
    lines.push(
      recognitionCount === 1
        ? "1 фото ждёт отправку — распознаем при связи с сервером"
        : `${recognitionCount} фото ждут отправку — распознаем при связи с сервером`,
    );
  }
  if (failedCount > 0) {
    lines.push(
      failedCount === 1
        ? "1 блюдо ждёт отправку — отправим в дневник"
        : `${failedCount} блюда ждут отправку — отправим в дневник`,
    );
  }
  if (waterCount > 0) {
    lines.push(
      waterCount === 1 ? "1 запись воды ждёт отправку" : `${waterCount} записи воды ждут отправку`,
    );
  }
  if (weightCount > 0) {
    lines.push(
      weightCount === 1 ? "1 запись веса ждёт отправку" : `${weightCount} записи веса ждут отправку`,
    );
  }
  if (workoutLocalCount > 0) {
    lines.push(
      workoutLocalCount === 1
        ? "1 тренировка создана на устройстве"
        : `${workoutLocalCount} тренировки на устройстве ждут отправку`,
    );
  }
  if (workoutExerciseCount > 0) {
    lines.push(
      workoutExerciseCount === 1
        ? "1 упражнение ждёт отправку"
        : `${workoutExerciseCount} упражнения ждут отправку`,
    );
  }
  if (workoutSetCount > 0) {
    lines.push(
      workoutSetCount === 1
        ? "1 подход в зале ждёт отправку"
        : `${workoutSetCount} подхода в зале ждут отправку`,
    );
  }
  if (workoutFinishCount > 0) {
    lines.push(
      workoutFinishCount === 1
        ? "1 завершение тренировки ждёт отправку"
        : `${workoutFinishCount} завершения тренировок ждут отправку`,
    );
  }

  const queueTitle = flushing
    ? "Отправляем черновики…"
    : !online
      ? `Ждёт сеть · ${totalCount} на устройстве`
      : `Ждёт отправку · ${totalCount} на устройстве`;

  return (
    <div className="flex flex-col gap-2" role="status">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{queueTitle}</p>
          <ul className="mt-0.5 list-none space-y-0.5 text-xs font-medium text-amber-900/90">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {!flushing ? (
            <p className="mt-1 text-[11px] text-amber-800/80">
              {online
                ? "Нажмите «Отправить» — фото уйдут в проверку, блюда и подходы в приложение."
                : "Черновики на телефоне. Нажмите «Отправить» — попробуем связаться с сервером."}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-amber-900/10 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-900/15 disabled:opacity-60"
          disabled={flushing}
          onClick={() => void flush()}
        >
          {flushing ? "Отправка…" : "Отправить"}
        </button>
      </div>
    </div>
  );
}
