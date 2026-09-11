"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearPendingConfirmDraft,
  getPendingConfirmDraft,
  subscribeMealDraftQueue,
  type PendingConfirmDraft,
} from "@/lib/meal-draft-queue";
import { requestOpenPendingConfirm } from "@/lib/open-food-camera";

function draftDishName(draft: PendingConfirmDraft): string | null {
  const fromUi = draft.ui?.dishes?.[0]?.dishName?.trim();
  if (fromUi) return fromUi;
  const recognition = draft.result.recognition;
  const fromItems = recognition.items?.[0]?.dishName?.trim();
  if (fromItems) return fromItems;
  const fromDish = recognition.dishName?.trim();
  return fromDish || null;
}

/** Soft resume CTA when a confirm draft sits on device (1.11.0 — no auto-hijack). */
export function PendingConfirmBanner({ selectedDate }: { selectedDate: string }) {
  const [draft, setDraft] = useState<PendingConfirmDraft | null>(null);

  const refresh = useCallback(() => {
    setDraft(getPendingConfirmDraft(selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    refresh();
    return subscribeMealDraftQueue(refresh);
  }, [refresh]);

  if (!draft?.result) return null;

  const dishName = draftDishName(draft);

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-2.5 text-sm text-teal-950"
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Есть незавершённая проверка</p>
        <p className="mt-0.5 text-xs text-teal-900/85">
          {dishName
            ? `«${dishName}» — продолжите порцию и сохранение.`
            : "Черновик на устройстве — продолжите порцию и сохранение."}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900"
          onClick={() => requestOpenPendingConfirm()}
        >
          Продолжить
        </button>
        <button
          type="button"
          className="rounded-lg border border-teal-300 bg-white/70 px-3 py-1.5 text-xs font-semibold text-teal-900 hover:bg-white"
          onClick={() => clearPendingConfirmDraft(selectedDate)}
        >
          Удалить
        </button>
      </div>
    </div>
  );
}
