"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  countFailedDeletes,
  countFailedPatches,
  countFailedSaves,
  countPendingRecognitions,
  listFailedDeletes,
  listFailedPatches,
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
  patchWeightDraft,
  removeWeightDraft,
  subscribeWeightDraftQueue,
} from "@/lib/weight-draft-queue";
import { OfflineQueueSheet } from "@/components/OfflineQueueSheet";
import {
  countDiaryNoteDrafts,
  listDiaryNoteDrafts,
  removeDiaryNoteDraft,
  subscribeDiaryNoteDraftQueue,
} from "@/lib/diary-note-draft-queue";
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
import {
  clearShoppingSyncDirty,
  countShoppingSyncDrafts,
  isShoppingSyncDirty,
  subscribeShoppingSyncDraft,
} from "@/lib/shopping-sync-draft";
import { loadList } from "@/lib/shopping-list";
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
  const [patchCount, setPatchCount] = useState(0);
  const [deleteCount, setDeleteCount] = useState(0);
  const [recognitionCount, setRecognitionCount] = useState(0);
  const [waterCount, setWaterCount] = useState(0);
  const [weightCount, setWeightCount] = useState(0);
  const [diaryNoteCount, setDiaryNoteCount] = useState(0);
  const [workoutSetCount, setWorkoutSetCount] = useState(0);
  const [workoutFinishCount, setWorkoutFinishCount] = useState(0);
  const [workoutLocalCount, setWorkoutLocalCount] = useState(0);
  const [workoutExerciseCount, setWorkoutExerciseCount] = useState(0);
  const [shoppingSyncCount, setShoppingSyncCount] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  /** T1: brief «Ушло N» after a flush so the queue doesn't vanish without feedback. */
  const [flushSummary, setFlushSummary] = useState<string | null>(null);
  // Optimistic online — Android WebView lies about navigator.onLine.
  const [online, setOnline] = useState(true);
  const { data: session } = useSession();
  const shoppingUserId = session?.user?.id ?? null;

  const refreshCounts = useCallback(() => {
    setFailedCount(countFailedSaves());
    setPatchCount(countFailedPatches());
    setDeleteCount(countFailedDeletes());
    setRecognitionCount(countPendingRecognitions());
    setWaterCount(countWaterDrafts());
    setWeightCount(countWeightDrafts());
    setDiaryNoteCount(countDiaryNoteDrafts());
    setWorkoutSetCount(countWorkoutSetDrafts());
    setWorkoutFinishCount(countWorkoutFinishDrafts());
    setWorkoutLocalCount(countLocalWorkoutSessions());
    setWorkoutExerciseCount(countWorkoutExerciseDrafts());
    setShoppingSyncCount(countShoppingSyncDrafts());
  }, []);

  useEffect(() => {
    refreshCounts();
    const unsubs = [
      subscribeMealDraftQueue(refreshCounts),
      subscribeWaterDraftQueue(refreshCounts),
      subscribeWeightDraftQueue(refreshCounts),
      subscribeDiaryNoteDraftQueue(refreshCounts),
      subscribeWorkoutSetDraftQueue(refreshCounts),
      subscribeLocalWorkoutSessions(refreshCounts),
      subscribeWorkoutExerciseDraftQueue(refreshCounts),
      subscribeShoppingSyncDraft(refreshCounts),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [refreshCounts]);

  const flush = useCallback(async () => {
    const pending = listPendingRecognitions();
    const failed = listFailedSaves();
    const patches = listFailedPatches();
    const deletes = listFailedDeletes();
    const water = listWaterDrafts();
    const weights = listWeightDrafts();
    const diaryNotes = listDiaryNoteDrafts();
    const workoutSets = listWorkoutSetDrafts();
    const workoutFinishes = listWorkoutFinishDrafts();
    const workoutLocals = countLocalWorkoutSessions();
    const workoutExercises = countWorkoutExerciseDrafts();
    const shoppingDirty = isShoppingSyncDirty();
    if (
      pending.length === 0 &&
      failed.length === 0 &&
      patches.length === 0 &&
      deletes.length === 0 &&
      water.length === 0 &&
      weights.length === 0 &&
      diaryNotes.length === 0 &&
      workoutSets.length === 0 &&
      workoutFinishes.length === 0 &&
      workoutLocals === 0 &&
      workoutExercises === 0 &&
      !shoppingDirty
    ) {
      return;
    }

    setFlushing(true);
    let savedAny = false;
    let recognizedAny = false;
    let flushedCount = 0;

    try {
      const localFlush = await flushLocalWorkoutSessions();
      if (localFlush.flushed > 0) {
        savedAny = true;
        flushedCount += localFlush.flushed;
      }
      const exFlush = await flushWorkoutExerciseDrafts();
      if (exFlush.flushed > 0) {
        savedAny = true;
        flushedCount += exFlush.flushed;
      }

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
          flushedCount += 1;
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
          flushedCount += 1;
        } catch {
          // stay queued
        }
      }

      // Patches before deletes so a delete can supersede a racey patch on the server.
      for (const item of patches) {
        try {
          const response = await fetch(withBasePath(`/api/meals/${item.mealId}`), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.patch),
          });
          if (response.status === 404) {
            removeMealDraft(item.id);
            continue;
          }
          if (!response.ok) continue;
          removeMealDraft(item.id);
          savedAny = true;
          flushedCount += 1;
        } catch (err) {
          if (isLikelyOfflineError(err)) break;
        }
      }

      for (const item of deletes) {
        try {
          const response = await fetch(withBasePath(`/api/meals/${item.mealId}`), {
            method: "DELETE",
          });
          if (response.ok || response.status === 404) {
            removeMealDraft(item.id);
            savedAny = true;
            flushedCount += 1;
          }
        } catch (err) {
          if (isLikelyOfflineError(err)) break;
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
          flushedCount += 1;
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
              confirmReplace: item.confirmReplace === true,
            }),
          });
          if (response.status === 409) {
            const conflict = (await response.json().catch(() => null)) as {
              conflict?: { weightKg?: number };
            } | null;
            const existingKg = conflict?.conflict?.weightKg;
            patchWeightDraft(item.id, {
              conflictExistingKg:
                typeof existingKg === "number" ? existingKg : item.weightKg,
            });
            // Keep draft — surface in queue sheet; do not silent-overwrite.
            continue;
          }
          if (!response.ok) break;
          removeWeightDraft(item.id);
          savedAny = true;
          flushedCount += 1;
        } catch {
          break;
        }
      }

      for (const item of diaryNotes) {
        try {
          const response = await fetch(withBasePath("/api/diary-note"), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date: item.date,
              note: item.note,
              mood: item.mood,
            }),
          });
          if (!response.ok) continue;
          removeDiaryNoteDraft(item.id);
          savedAny = true;
          flushedCount += 1;
        } catch (err) {
          if (isLikelyOfflineError(err)) break;
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
          flushedCount += 1;
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
          flushedCount += 1;
        } catch (err) {
          if (isLikelyOfflineError(err)) break;
        }
      }

      if (shoppingDirty && shoppingUserId) {
        try {
          const items = loadList({ userId: shoppingUserId });
          const response = await fetch(withBasePath("/api/shopping-list"), {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
          if (response.ok) {
            clearShoppingSyncDirty();
            savedAny = true;
            flushedCount += 1;
          }
        } catch (err) {
          if (isLikelyOfflineError(err)) {
            // stay dirty
          }
        }
      }
    } finally {
      setFlushing(false);
      refreshCounts();
      if (flushedCount > 0) {
        const remaining =
          countFailedSaves() +
          countFailedPatches() +
          countFailedDeletes() +
          countPendingRecognitions() +
          countWaterDrafts() +
          countWeightDrafts() +
          countDiaryNoteDrafts() +
          countWorkoutSetDrafts() +
          countWorkoutFinishDrafts() +
          countLocalWorkoutSessions() +
          countWorkoutExerciseDrafts() +
          countShoppingSyncDrafts();
        setFlushSummary(
          remaining > 0
            ? `Ушло ${flushedCount} · ещё ждёт ${remaining}`
            : `Ушло ${flushedCount} — очередь пуста`,
        );
      }
      if (savedAny || recognizedAny) {
        if (savedAny) {
          emitMascotReaction("save");
        }
        onFlushed?.();
      }
    }
  }, [onFlushed, onRecognitionReady, refreshCounts, shoppingUserId]);

  useEffect(() => {
    if (!flushSummary) return;
    const timer = window.setTimeout(() => setFlushSummary(null), 4500);
    return () => window.clearTimeout(timer);
  }, [flushSummary]);

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
    patchCount +
    deleteCount +
    recognitionCount +
    waterCount +
    weightCount +
    diaryNoteCount +
    workoutSetCount +
    workoutFinishCount +
    workoutLocalCount +
    workoutExerciseCount +
    shoppingSyncCount;
  if (totalCount <= 0 && !flushSummary) return null;

  if (totalCount <= 0 && flushSummary) {
    return (
      <div className="flex flex-col gap-2" role="status">
        <div className="offline-chrome offline-chrome-pad text-sm">
          <p className="font-semibold text-teal-900">{flushSummary}</p>
        </div>
      </div>
    );
  }

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
  if (patchCount > 0) {
    lines.push(
      patchCount === 1
        ? "1 правка в дневнике ждёт отправку"
        : `${patchCount} правки в дневнике ждут отправку`,
    );
  }
  if (deleteCount > 0) {
    lines.push(
      deleteCount === 1
        ? "1 удаление в дневнике ждёт отправку"
        : `${deleteCount} удаления в дневнике ждут отправку`,
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
  if (diaryNoteCount > 0) {
    lines.push(
      diaryNoteCount === 1
        ? "1 вечерний чек-ин ждёт отправку"
        : `${diaryNoteCount} вечерних чек-ина ждут отправку`,
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
  if (shoppingSyncCount > 0) {
    lines.push("Список покупок ждёт синхронизацию");
  }

  const queueTitle = flushing
    ? "Отправляем черновики…"
    : flushSummary
      ? flushSummary
      : !online
        ? `Ждёт сеть · ${totalCount} на устройстве`
        : `Ждёт отправку · ${totalCount} на устройстве`;

  return (
    <div className="flex flex-col gap-2" role="status">
      <div className="offline-chrome offline-chrome-pad flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setSheetOpen(true)}
        >
          <p className="font-semibold">{queueTitle}</p>
          <ul className="mt-0.5 list-none space-y-0.5 text-xs font-medium text-[var(--offline-glass-muted)]">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {!flushing ? (
            <p className="mt-1 text-[11px] text-[var(--offline-glass-muted)]">
              {online
                ? "Нажмите очередь — список и отмена; «Отправить» — синхронизация."
                : "Черновики на телефоне. Откройте очередь или нажмите «Отправить»."}
            </p>
          ) : null}
        </button>
        <div className="flex shrink-0 flex-col gap-1.5">
          <button
            type="button"
            className="offline-chrome-cta"
            disabled={flushing}
            onClick={() => void flush()}
          >
            {flushing ? "Отправка…" : "Отправить"}
          </button>
          <button
            type="button"
            className="offline-chrome-link px-1 py-0.5 text-left"
            onClick={() => setSheetOpen(true)}
          >
            Очередь
          </button>
        </div>
      </div>
      {sheetOpen ? (
        <OfflineQueueSheet
          flushing={flushing}
          onClose={() => setSheetOpen(false)}
          onFlush={() => void flush()}
          onChanged={refreshCounts}
        />
      ) : null}
    </div>
  );
}
