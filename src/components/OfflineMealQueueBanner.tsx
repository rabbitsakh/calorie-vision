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
  countWorkoutSetDrafts,
  listWorkoutSetDrafts,
  removeWorkoutSetDraft,
  subscribeWorkoutSetDraftQueue,
} from "@/lib/workout-set-draft-queue";
import { emitMascotReaction } from "@/lib/mascot-reactions";
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
  const [flushing, setFlushing] = useState(false);
  const [online, setOnline] = useState(
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
  );

  const refreshCounts = useCallback(() => {
    setFailedCount(countFailedSaves());
    setRecognitionCount(countPendingRecognitions());
    setWaterCount(countWaterDrafts());
    setWeightCount(countWeightDrafts());
    setWorkoutSetCount(countWorkoutSetDrafts());
  }, []);

  useEffect(() => {
    refreshCounts();
    const unsubs = [
      subscribeMealDraftQueue(refreshCounts),
      subscribeWaterDraftQueue(refreshCounts),
      subscribeWeightDraftQueue(refreshCounts),
      subscribeWorkoutSetDraftQueue(refreshCounts),
    ];
    return () => {
      for (const unsub of unsubs) unsub();
    };
  }, [refreshCounts]);

  useEffect(() => {
    function onOnline() {
      setOnline(true);
    }
    function onOffline() {
      setOnline(false);
    }
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const flush = useCallback(async () => {
    const pending = listPendingRecognitions();
    const failed = listFailedSaves();
    const water = listWaterDrafts();
    const weights = listWeightDrafts();
    const workoutSets = listWorkoutSetDrafts();
    if (
      pending.length === 0 &&
      failed.length === 0 &&
      water.length === 0 &&
      weights.length === 0 &&
      workoutSets.length === 0
    ) {
      return;
    }

    setFlushing(true);
    let savedAny = false;
    let recognizedAny = false;

    try {
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
        } catch {
          // stay queued
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
    function onOnlineFlush() {
      void flush();
    }
    window.addEventListener("online", onOnlineFlush);
    return () => window.removeEventListener("online", onOnlineFlush);
  }, [flush]);

  const totalCount =
    failedCount + recognitionCount + waterCount + weightCount + workoutSetCount;
  if (totalCount <= 0) return null;

  const lines: string[] = [];
  if (recognitionCount > 0) {
    lines.push(
      recognitionCount === 1
        ? "1 фото ждёт сеть — распознаем при появлении интернета"
        : `${recognitionCount} фото ждут сеть — распознаем при появлении интернета`,
    );
  }
  if (failedCount > 0) {
    lines.push(
      failedCount === 1
        ? "1 блюдо ждёт сеть — отправим в дневник"
        : `${failedCount} блюда ждут сеть — отправим в дневник`,
    );
  }
  if (waterCount > 0) {
    lines.push(
      waterCount === 1 ? "1 запись воды ждёт сеть" : `${waterCount} записи воды ждут сеть`,
    );
  }
  if (weightCount > 0) {
    lines.push(
      weightCount === 1 ? "1 запись веса ждёт сеть" : `${weightCount} записи веса ждут сеть`,
    );
  }
  if (workoutSetCount > 0) {
    lines.push(
      workoutSetCount === 1
        ? "1 подход в зале ждёт сеть"
        : `${workoutSetCount} подхода в зале ждут сеть`,
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
                ? "Нажмите «Отправить» — фото уйдут в проверку, блюда и подходы в приложение. Или дождитесь появления сети."
                : "Черновики на телефоне. Когда появится сеть — нажмите «Отправить» или откройте рацион снова."}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded-lg bg-amber-900/10 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-900/15 disabled:opacity-60"
          disabled={flushing || !online}
          onClick={() => void flush()}
        >
          {flushing ? "Отправка…" : online ? "Отправить" : "Ждём сеть"}
        </button>
      </div>
    </div>
  );
}
