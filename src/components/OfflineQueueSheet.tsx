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
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" aria-modal>
      <button type="button" className="flex-1 cursor-default" aria-label="Закрыть" onClick={onClose} />
      <div className="max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-[var(--foreground)]">Очередь офлайн</p>
            <p className="text-xs text-[var(--muted)]">
              {rows.length === 0
                ? "Пусто"
                : `${rows.length} на устройстве — можно отменить до отправки`}
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-[var(--muted)]"
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
              <li
                key={`${row.kind}-${row.id}`}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface-mist)]/60 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {row.label}
                    </p>
                    {row.detail ? (
                      <p className="truncate text-[11px] text-[var(--muted)]">{row.detail}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-xs font-semibold text-rose-700"
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
                      className="rounded-lg bg-teal-700 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
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

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn btn-secondary flex-1"
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
