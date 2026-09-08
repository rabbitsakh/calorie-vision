"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPendingConfirmDraft,
  subscribeMealDraftQueue,
} from "@/lib/meal-draft-queue";
import { requestOpenPendingConfirm } from "@/lib/open-food-camera";

/** Soft resume CTA when a confirm draft sits on device (1.11.0 — no auto-hijack). */
export function PendingConfirmBanner({ selectedDate }: { selectedDate: string }) {
  const [visible, setVisible] = useState(false);

  const refresh = useCallback(() => {
    const draft =
      getPendingConfirmDraft(selectedDate) ?? getPendingConfirmDraft() ?? null;
    setVisible(Boolean(draft?.result));
  }, [selectedDate]);

  useEffect(() => {
    refresh();
    return subscribeMealDraftQueue(refresh);
  }, [refresh]);

  if (!visible) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-2.5 text-sm text-teal-950"
      role="status"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Есть незавершённая проверка</p>
        <p className="mt-0.5 text-xs text-teal-900/85">
          Черновик на устройстве — продолжите порцию и сохранение.
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-900"
        onClick={() => requestOpenPendingConfirm()}
      >
        Продолжить
      </button>
    </div>
  );
}
