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

type QueueRow = {
  id: string;
  kind: string;
  label: string;
  detail?: string;
  onDiscard: () => void;
  weightConflict?: WeightDraftItem;
};

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
      onDiscard: () => {
        // Keep the local list — only drop the sync debt marker.
        clearShoppingSyncDirty();
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
                ? "Пусто"
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
          <p className="py-6 text-center text-sm text-[var(--muted)]">Очередь пуста</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={`${row.kind}-${row.id}`} className="offline-queue-row">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--ink)]">
                      {row.label}
                    </p>
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
                      Заменить {row.weightConflict.conflictExistingKg} кг →{" "}
                      {row.weightConflict.weightKg} кг
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
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
