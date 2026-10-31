"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  listFailedDeletes,
  listFailedPatches,
  listFailedSaves,
  listPendingRecognitions,
  removeMealDraft,
  subscribeMealDraftQueue,
} from "@/lib/meal-draft-queue";
import {
  listWaterDrafts,
  removeWaterDraft,
  subscribeWaterDraftQueue,
} from "@/lib/water-draft-queue";
import {
  listWeightDrafts,
  patchWeightDraft,
  removeWeightDraft,
  subscribeWeightDraftQueue,
  type WeightDraftItem,
} from "@/lib/weight-draft-queue";
import {
  listDiaryNoteDrafts,
  removeDiaryNoteDraft,
  subscribeDiaryNoteDraftQueue,
} from "@/lib/diary-note-draft-queue";
import {
  listLocalWorkoutSessions,
  removeLocalWorkoutSession,
  subscribeLocalWorkoutSessions,
} from "@/lib/workout-local-session";
import {
  listWorkoutExerciseDrafts,
  removeWorkoutExerciseDraft,
  subscribeWorkoutExerciseDraftQueue,
} from "@/lib/workout-exercise-draft-queue";
import {
  listWorkoutFinishDrafts,
  listWorkoutSetDrafts,
  removeWorkoutFinishDraft,
  removeWorkoutSetDraft,
  subscribeWorkoutSetDraftQueue,
} from "@/lib/workout-set-draft-queue";
import {
  clearShoppingSyncDirty,
  isShoppingSyncDirty,
  subscribeShoppingSyncDraft,
} from "@/lib/shopping-sync-draft";
import {
  listAssistantApplyQueue,
  removeAssistantApply,
  subscribeAssistantApplyQueue,
  type AssistantApplyKind,
} from "@/lib/assistant-apply-queue";
import {
  listRewardsDrafts,
  removeRewardsDraft,
  subscribeRewardsDraftQueue,
} from "@/lib/rewards-draft-queue";
import {
  hasOfflineQueueFlushError,
  subscribeOfflineQueueFlushErrors,
} from "@/lib/offline-queue-flush-errors";
import {
  formatWeightKeepCta,
  formatWeightReplaceCta,
} from "@/lib/weight-day-conflict";

const ASSISTANT_APPLY_LABEL: Record<AssistantApplyKind, string> = {
  photo: "AI · фото",
  meals: "AI · дневник",
  routine: "AI · план зала",
  shopping: "AI · покупки",
  start: "AI · старт",
  startEmpty: "AI · пустой зал",
  repeat: "AI · повтор зала",
  patchWorkout: "AI · правка зала",
  water: "AI · вода",
  weight: "AI · вес",
  deleteMeals: "AI · удаление",
  patchMeals: "AI · правка",
};

/** T5/T8 — row status for offline queue clarity. */
type QueueRowStatus = "waiting" | "conflict" | "local" | "error";

type QueueRow = {
  id: string;
  kind: string;
  label: string;
  detail?: string;
  status: QueueRowStatus;
  onDiscard: () => void;
  weightConflict?: WeightDraftItem;
};

type QueueCategory = "food" | "gym" | "ai" | "rewards" | "other";

function categoryForKind(kind: string): QueueCategory {
  if (kind.startsWith("assistant-") || kind.startsWith("AI")) return "ai";
  if (kind.startsWith("gym-")) return "gym";
  if (kind.startsWith("rewards-")) return "rewards";
  if (
    kind === "photo" ||
    kind === "meal" ||
    kind === "patch" ||
    kind === "delete" ||
    kind === "water" ||
    kind === "weight" ||
    kind === "diary"
  ) {
    return "food";
  }
  return "other";
}

function categoryPill(cat: QueueCategory): { label: string; className: string } {
  if (cat === "food") {
    return { label: "Еда", className: "bg-[var(--accent-soft)] text-[var(--accent-ink)]" };
  }
  if (cat === "gym") {
    return { label: "Зал", className: "bg-[var(--surface-mist)] text-[var(--foreground)]" };
  }
  if (cat === "ai") {
    return { label: "AI", className: "bg-[var(--accent)]/15 text-[var(--accent-ink)]" };
  }
  if (cat === "rewards") {
    return { label: "Сундук", className: "bg-[var(--accent-soft)] text-[var(--accent-ink)]" };
  }
  return { label: "Прочее", className: "bg-[var(--border-quiet)]/60 text-[var(--muted-strong)]" };
}

function statusPill(status: QueueRowStatus, flushing: boolean): { label: string; className: string } {
  if (flushing) {
    return {
      label: "Отправка…",
      className: "bg-[var(--accent-soft)] text-[var(--accent-ink)]",
    };
  }
  if (status === "conflict") {
    return {
      label: "Конфликт",
      className: "bg-amber-100 text-amber-950",
    };
  }
  if (status === "error") {
    return {
      label: "Ошибка",
      className: "bg-rose-100 text-rose-950",
    };
  }
  if (status === "local") {
    return {
      label: "На устройстве",
      className: "bg-[var(--surface-mist)] text-[var(--muted-strong)]",
    };
  }
  return {
    label: "Ждёт сеть",
    className: "bg-[var(--accent-soft)]/80 text-[var(--accent-ink)]",
  };
}

function rowStatus(id: string, base: "waiting" | "local"): QueueRowStatus {
  return hasOfflineQueueFlushError(id) ? "error" : base;
}

type Props = {
  flushing: boolean;
  onClose: () => void;
  onFlush: () => void;
  onChanged: () => void;
};

function buildRows(onChanged: () => void): QueueRow[] {
  const rows: QueueRow[] = [];

  for (const item of listPendingRecognitions()) {
    rows.push({
      id: item.id,
      kind: "photo",
      label: "Фото на распознавание",
      detail: item.selectedDate,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeMealDraft(item.id);
        onChanged();
      },
    });
  }
  for (const item of listFailedSaves()) {
    const dishName =
      "entries" in item.body
        ? item.body.entries[0]?.dishName
        : item.body.dishName;
    rows.push({
      id: item.id,
      kind: "meal",
      label: dishName ? `Блюдо: ${dishName}` : "Блюдо в дневник",
      detail: item.selectedDate,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeMealDraft(item.id);
        onChanged();
      },
    });
  }
  for (const item of listFailedPatches()) {
    rows.push({
      id: item.id,
      kind: "patch",
      label: "Правка в дневнике",
      detail: item.mealId,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeMealDraft(item.id);
        onChanged();
      },
    });
  }
  for (const item of listFailedDeletes()) {
    rows.push({
      id: item.id,
      kind: "delete",
      label: "Удаление из дневника",
      detail: item.mealId,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeMealDraft(item.id);
        onChanged();
      },
    });
  }
  for (const item of listWaterDrafts()) {
    rows.push({
      id: item.id,
      kind: "water",
      label: `Вода · ${item.ml} мл`,
      detail: item.selectedDate,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeWaterDraft(item.id);
        onChanged();
      },
    });
  }
  for (const item of listWeightDrafts()) {
    const conflict =
      item.conflictExistingKg != null && !item.confirmReplace
        ? `Конфликт: на сервере ${item.conflictExistingKg} кг`
        : undefined;
    rows.push({
      id: item.id,
      kind: "weight",
      label: `Вес · ${item.weightKg} кг`,
      detail: conflict ?? item.date,
      status: conflict ? "conflict" : rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeWeightDraft(item.id);
        onChanged();
      },
      weightConflict: conflict ? item : undefined,
    });
  }
  for (const item of listDiaryNoteDrafts()) {
    rows.push({
      id: item.id,
      kind: "diary",
      label: "Вечерний чек-ин",
      detail: item.date,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeDiaryNoteDraft(item.id);
        onChanged();
      },
    });
  }
  for (const item of listLocalWorkoutSessions()) {
    rows.push({
      id: item.id,
      kind: "gym-local",
      label: `Тренировка · ${item.exercises.length} упр.`,
      detail: item.date,
      status: rowStatus(item.id, "local"),
      onDiscard: () => {
        removeLocalWorkoutSession(item.id);
        onChanged();
      },
    });
  }
  for (const item of listWorkoutExerciseDrafts()) {
    rows.push({
      id: item.id,
      kind: "gym-ex",
      label: `Упражнение · ${item.name}`,
      detail: item.sessionId,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeWorkoutExerciseDraft(item.id);
        onChanged();
      },
    });
  }
  for (const item of listWorkoutSetDrafts()) {
    rows.push({
      id: item.id,
      kind: "gym-set",
      label: "Подход в зале",
      detail: item.exerciseId,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeWorkoutSetDraft(item.id);
        onChanged();
      },
    });
  }
  for (const item of listWorkoutFinishDrafts()) {
    rows.push({
      id: item.id,
      kind: "gym-finish",
      label: "Завершение тренировки",
      detail: item.sessionId,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeWorkoutFinishDraft(item.id);
        onChanged();
      },
    });
  }
  if (isShoppingSyncDirty()) {
    rows.push({
      id: "shopping-sync",
      kind: "shopping",
      label: "Список покупок",
      detail: "локальные правки ещё не на сервере",
      status: rowStatus("shopping-sync", "local"),
      onDiscard: () => {
        // Keep the local list — only drop the sync debt marker.
        clearShoppingSyncDirty();
        onChanged();
      },
    });
  }

  // T6: assistant confirm payloads queued offline from ActionCard.
  for (const item of listAssistantApplyQueue()) {
    rows.push({
      id: item.id,
      kind: `assistant-${item.kind}`,
      label: ASSISTANT_APPLY_LABEL[item.kind] ?? `AI · ${item.kind}`,
      detail: typeof item.body.date === "string" ? item.body.date : undefined,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeAssistantApply(item.id);
        onChanged();
      },
    });
  }

  // Wave R/O — chest mark / open while offline.
  for (const item of listRewardsDrafts()) {
    rows.push({
      id: item.id,
      kind: `rewards-${item.kind}`,
      label: item.kind === "open" ? "Открыть сундук" : "Отметить день сундука",
      detail: typeof item.body.date === "string" ? item.body.date : item.body.source,
      status: rowStatus(item.id, "waiting"),
      onDiscard: () => {
        removeRewardsDraft(item.id);
        onChanged();
      },
    });
  }

  return rows;
}

/** Visible offline queue — discard per item, confirm weight conflicts. */
export function OfflineQueueSheet({ flushing, onClose, onFlush, onChanged }: Props) {
  const [tick, setTick] = useState(0);
  const rows = useMemo(() => buildRows(onChanged), [onChanged, tick]);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const unsubs = [
      subscribeMealDraftQueue(bump),
      subscribeWaterDraftQueue(bump),
      subscribeWeightDraftQueue(bump),
      subscribeDiaryNoteDraftQueue(bump),
      subscribeLocalWorkoutSessions(bump),
      subscribeWorkoutExerciseDraftQueue(bump),
      subscribeWorkoutSetDraftQueue(bump),
      subscribeShoppingSyncDraft(bump),
      subscribeAssistantApplyQueue(bump),
      subscribeRewardsDraftQueue(bump),
      subscribeOfflineQueueFlushErrors(bump),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  /* Portal to <html>: AppShell / ration transforms would pin `fixed` to the
   * page bottom (far from the top banner). Same pattern as FoodAddModePicker. */
  const overlay = (
    <div
      className="offline-queue-overlay fixed inset-0 z-[70] flex flex-col justify-end bg-[var(--accent-ink)]/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="offline-queue-title"
    >
      <button type="button" className="min-h-0 flex-1 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <div
        className="offline-queue-sheet flex max-h-[min(92dvh,920px)] w-full flex-col overflow-hidden rounded-t-2xl px-3 pt-2 sm:px-4 sm:pt-3"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="offline-queue-handle mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-[var(--border-quiet)]" aria-hidden />
        <div className="mb-2 flex shrink-0 items-start justify-between gap-2 sm:mb-3">
          <div className="min-w-0">
            <p id="offline-queue-title" className="confirm-family-skim !mb-0.5">
              Очередь офлайн
            </p>
            <p className="text-[11px] text-[var(--muted)] sm:text-xs">
              {rows.length === 0
                ? "Черновиков нет"
                : `${rows.length} на устройстве — можно отменить до отправки`}
            </p>
          </div>
          <button
            type="button"
            className="confirm-family-secondary !min-h-8 shrink-0 !px-2.5 !text-[11px]"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1">
          {rows.length === 0 ? (
            <div className="confirm-family my-3 border-dashed py-5 text-center sm:my-4 sm:py-6">
              <p className="confirm-family-skim !mb-1">Очередь пуста</p>
              <p className="text-xs text-[var(--muted-strong)]">
                Офлайн-записи появятся здесь — фото, дневник, зал, AI, сундуки.
              </p>
              <button
                type="button"
                className="confirm-family-secondary mt-3 !min-h-8"
                onClick={onClose}
              >
                Понятно
              </button>
            </div>
          ) : (
            <ul className="space-y-1.5 sm:space-y-2">
              {rows.map((row) => {
                const pill = statusPill(row.status, flushing);
                const cat = categoryPill(categoryForKind(row.kind));
                return (
                  <li key={`${row.kind}-${row.id}`} className="offline-queue-row">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cat.className}`}
                          >
                            {cat.label}
                          </span>
                          <p className="truncate text-sm font-semibold text-[var(--ink)]">
                            {row.label}
                          </p>
                          <span
                            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${pill.className}`}
                          >
                            {pill.label}
                          </span>
                        </div>
                        {row.detail ? (
                          <p className="truncate text-[11px] text-[var(--muted)]">{row.detail}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-xs font-semibold text-[var(--danger)]"
                        disabled={flushing}
                        onClick={row.onDiscard}
                      >
                        Убрать
                      </button>
                    </div>
                    {row.weightConflict ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="confirm-family-cta !min-h-8 !px-2.5 !text-[11px]"
                          disabled={flushing}
                          onClick={() => {
                            patchWeightDraft(row.weightConflict!.id, {
                              confirmReplace: true,
                              conflictExistingKg: null,
                            });
                            onChanged();
                            setTick((n) => n + 1);
                          }}
                        >
                          {formatWeightReplaceCta(row.weightConflict.weightKg)}
                        </button>
                        <button
                          type="button"
                          className="confirm-family-secondary !min-h-8 !px-2.5 !text-[11px]"
                          disabled={flushing}
                          onClick={() => {
                            removeWeightDraft(row.weightConflict!.id);
                            onChanged();
                            setTick((n) => n + 1);
                          }}
                        >
                          {formatWeightKeepCta(row.weightConflict.conflictExistingKg!)}
                        </button>
                      </div>
                    ) : null}
                    {row.status === "error" ? (
                      <div className="mt-2">
                        <button
                          type="button"
                          className="confirm-family-cta !min-h-8 !px-2.5 !text-[11px]"
                          disabled={flushing}
                          onClick={onFlush}
                        >
                          Повторить
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="offline-queue-sheet-footer shrink-0 pt-2 pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] sm:pt-3">
          <button
            type="button"
            className="confirm-family-cta w-full !min-h-11"
            disabled={flushing || rows.length === 0}
            onClick={onFlush}
          >
            {flushing ? "Отправка…" : "Отправить всё"}
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(overlay, document.documentElement);
}
