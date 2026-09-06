"use client";

import { useCallback, useEffect, useState } from "react";
import {
  countFailedSaves,
  countOfflineQueue,
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
import { emitMascotReaction } from "@/lib/mascot-reactions";
import { isNetworkFetchError, recognizePhotoFile } from "@/lib/recognize-photo-client";
import { withBasePath } from "@/lib/paths";

type OfflineMealQueueBannerProps = {
  onFlushed?: () => void;
  /** Fired when a queued photo was recognized — parent can open confirm card. */
  onRecognitionReady?: (selectedDate: string) => void;
};

/** Visible on ration when offline meal saves or photo recognition are queued. */
export function OfflineMealQueueBanner({ onFlushed, onRecognitionReady }: OfflineMealQueueBannerProps) {
  const [failedCount, setFailedCount] = useState(0);
  const [recognitionCount, setRecognitionCount] = useState(0);
  const [waterCount, setWaterCount] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const refreshCounts = useCallback(() => {
    setFailedCount(countFailedSaves());
    setRecognitionCount(countPendingRecognitions());
    setWaterCount(countWaterDrafts());
  }, []);

  useEffect(() => {
    refreshCounts();
    const unsubMeal = subscribeMealDraftQueue(refreshCounts);
    const unsubWater = subscribeWaterDraftQueue(refreshCounts);
    return () => {
      unsubMeal();
      unsubWater();
    };
  }, [refreshCounts]);

  const flush = useCallback(async () => {
    const pending = listPendingRecognitions();
    const failed = listFailedSaves();
    const water = listWaterDrafts();
    if (pending.length === 0 && failed.length === 0 && water.length === 0) return;

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
    function onOnline() {
      void flush();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  const totalCount = countOfflineQueue() + waterCount;
  if (totalCount <= 0) return null;

  const statusParts: string[] = [];
  if (recognitionCount > 0) {
    statusParts.push(
      `${recognitionCount} ${recognitionCount === 1 ? "фото ждёт распознавания" : "фото ждут распознавания"}`,
    );
  }
  if (failedCount > 0) {
    statusParts.push(
      `${failedCount} ${failedCount === 1 ? "запись ждёт отправки" : "записей ждут отправки"}`,
    );
  }
  if (waterCount > 0) {
    statusParts.push(
      `${waterCount} ${waterCount === 1 ? "запись воды ждёт отправки" : "записей воды ждут отправки"}`,
    );
  }

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
      role="status"
    >
      <p className="min-w-0 flex-1 font-medium">
        Офлайн-очередь: {statusParts.join(" · ")}
        {flushing ? " — отправляем…" : ""}
      </p>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-amber-900/10 px-3 py-1.5 text-xs font-semibold text-amber-950 hover:bg-amber-900/15 disabled:opacity-60"
        disabled={flushing}
        onClick={() => void flush()}
      >
        Отправить
      </button>
    </div>
  );
}
