"use client";

import { useEffect, useMemo, useState } from "react";
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

type QueueCategory = "food" | "gym" | "ai" | "other";

function categoryForKind(kind: string): QueueCategory {
  if (kind.startsWith("assistant-") || kind.startsWith("AI")) return "ai";
  if (kind.startsWith("gym-")) return "gym";
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
      subscribeOfflineQueueFlushErrors(bump),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" aria-modal>
      <button type="button" className="flex-1 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <div className="offline-queue-sheet max-h-[75vh] overflow-y-auto rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="confirm-family-skim !mb-0.5">Очередь офлайн</p>
            <p className="text-xs text-[var(--muted)]">
              {rows.length === 0
                ? "Черновиков нет"
                : `${rows.length} на устройстве — можно отменить до отправки`}
            </p>
          </div>
          <button
            type="button"
            className="confirm-family-secondary !min-h-8 !px-2.5 !text-[11px]"
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="confirm-family my-4 border-dashed py-6 text-center">
            <p className="confirm-family-skim !mb-1">Очередь пуста</p>
            <p className="text-xs text-[var(--muted-strong)]">
              Офлайн-записи появятся здесь — фото, дневник, зал, AI.
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
          <ul className="space-y-2">
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

        <div className="confirm-family-actions mt-4 flex gap-2 !border-t-0 !pt-0">
          <button
            type="button"
            className="confirm-family-cta flex-1"
            disabled={flushing || rows.length === 0}
            onClick={onFlush}
          >
            {flushing ? "Отправка…" : "Отправить всё"}
          </button>
        </div>
      </div>
    </div>
  );
}
