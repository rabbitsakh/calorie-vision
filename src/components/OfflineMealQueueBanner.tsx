"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPendingConfirmHint } from "@/lib/confirm-review-cta";
import {
  clearPendingConfirmDraft,
  countFailedSaves,
  countOfflineQueue,
  countPendingRecognitions,
  getPendingConfirmDraft,
  listFailedSaves,
  listPendingRecognitions,
  pendingRecognitionToFile,
  removeMealDraft,
  subscribeMealDraftQueue,
  upsertPendingConfirmDraft,
  type PendingConfirmDraft,
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
import { emitMascotReaction } from "@/lib/mascot-reactions";
import { requestOpenPendingConfirm } from "@/lib/open-food-camera";
import { isNetworkFetchError, recognizePhotoFile } from "@/lib/recognize-photo-client";
import { withBasePath } from "@/lib/paths";

type OfflineMealQueueBannerProps = {
  selectedDate?: string;
  onFlushed?: () => void;
  /** Fired when a queued photo was recognized — parent can open confirm card. */
  onRecognitionReady?: (selectedDate: string) => void;
};

function pendingHint(draft: PendingConfirmDraft): string {
  const fromUi = draft.ui?.dishes?.[0]?.dishName?.trim();
  const recognition = draft.result.recognition;
  const dishName =
    fromUi ||
    recognition.items?.[0]?.dishName?.trim() ||
    recognition.dishName?.trim() ||
    null;
  let calories: number | null = null;
  if (draft.ui?.dishes?.length) {
    const sum = draft.ui.dishes.reduce((acc, d) => acc + (Number(d.calories) || 0), 0);
    if (sum > 0) calories = sum;
  }
  if (calories == null && recognition.items?.length) {
    const sum = recognition.items.reduce((acc, item) => acc + (Number(item.calories) || 0), 0);
    if (sum > 0) calories = sum;
  }
  if (calories == null) {
    const cal = Number(recognition.calories);
    calories = Number.isFinite(cal) && cal > 0 ? cal : null;
  }
  const uiCount = draft.ui?.dishes?.length ?? 0;
  const items = recognition.items?.length ?? 0;
  const multiCount = uiCount > 1 ? uiCount : items > 1 ? items : 1;
  return formatPendingConfirmHint({
    dishName,
    calories,
    photoKind: recognition.photoKind,
    multiCount,
  });
}

/** One sync surface: offline drafts + unfinished confirm. */
export function OfflineMealQueueBanner({
  selectedDate,
  onFlushed,
  onRecognitionReady,
}: OfflineMealQueueBannerProps) {
  const [failedCount, setFailedCount] = useState(0);
  const [recognitionCount, setRecognitionCount] = useState(0);
  const [waterCount, setWaterCount] = useState(0);
  const [weightCount, setWeightCount] = useState(0);
  const [pendingDraft, setPendingDraft] = useState<PendingConfirmDraft | null>(null);
  const [flushing, setFlushing] = useState(false);
  const [online, setOnline] = useState(
    () => (typeof navigator === "undefined" ? true : navigator.onLine),
  );

  const refreshCounts = useCallback(() => {
    setFailedCount(countFailedSaves());
    setRecognitionCount(countPendingRecognitions());
    setWaterCount(countWaterDrafts());
    setWeightCount(countWeightDrafts());
    setPendingDraft(selectedDate ? getPendingConfirmDraft(selectedDate) : null);
  }, [selectedDate]);

  useEffect(() => {
    refreshCounts();
    const unsubMeal = subscribeMealDraftQueue(refreshCounts);
    const unsubWater = subscribeWaterDraftQueue(refreshCounts);
    const unsubWeight = subscribeWeightDraftQueue(refreshCounts);
    return () => {
      unsubMeal();
      unsubWater();
      unsubWeight();
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
    if (pending.length === 0 && failed.length === 0 && water.length === 0 && weights.length === 0) return;

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

  const totalCount = countOfflineQueue() + waterCount + weightCount;
  const hasPending = Boolean(pendingDraft?.result);
  if (totalCount <= 0 && !hasPending) return null;

  const lines: string[] = [];
  if (recognitionCount > 0) {
    lines.push(
      recognitionCount === 1
        ? "1 фото — распознать при сети"
        : `${recognitionCount} фото — распознать при сети`,
    );
  }
  if (failedCount > 0) {
    lines.push(
      failedCount === 1
        ? "1 блюдо — отправить в дневник"
        : `${failedCount} блюда — отправить в дневник`,
    );
  }
  if (waterCount > 0) {
    lines.push(
      waterCount === 1 ? "1 запись воды" : `${waterCount} записи воды`,
    );
  }
  if (weightCount > 0) {
    lines.push(
      weightCount === 1 ? "1 запись веса" : `${weightCount} записи веса`,
    );
  }

  const queueTitle = flushing
    ? "Отправляем черновики…"
    : !online
      ? `Нет сети · ${totalCount} на устройстве`
      : `Не отправлено · ${totalCount} на устройстве`;

  return (
    <div className="flex flex-col gap-2" role="status">
      {totalCount > 0 ? (
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
                  ? "Нажмите «Отправить» — фото уйдут в проверку, блюда в дневник. Или дождитесь появления сети."
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
      ) : null}

      {hasPending && pendingDraft ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-2.5 text-sm text-teal-950">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Досохраните блюдо</p>
            <p className="mt-0.5 text-xs text-teal-900/85">{pendingHint(pendingDraft)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900"
              onClick={() => requestOpenPendingConfirm()}
            >
              Продолжить
            </button>
            {selectedDate ? (
              <button
                type="button"
                className="rounded-lg border border-teal-300 bg-white/70 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-white"
                onClick={() => {
                  clearPendingConfirmDraft(selectedDate);
                  refreshCounts();
                }}
              >
                Удалить
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
