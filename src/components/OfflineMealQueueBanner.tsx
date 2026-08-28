"use client";

import { useCallback, useEffect, useState } from "react";
import {
  countFailedSaves,
  listFailedSaves,
  removeMealDraft,
  subscribeMealDraftQueue,
} from "@/lib/meal-draft-queue";
import { emitMascotReaction } from "@/lib/mascot-reactions";
import { withBasePath } from "@/lib/paths";

type OfflineMealQueueBannerProps = {
  onFlushed?: () => void;
};

/** Visible anywhere on ration when failed meal saves are queued offline. */
export function OfflineMealQueueBanner({ onFlushed }: OfflineMealQueueBannerProps) {
  const [queuedCount, setQueuedCount] = useState(0);
  const [flushing, setFlushing] = useState(false);

  const refreshCount = useCallback(() => {
    setQueuedCount(countFailedSaves());
  }, []);

  useEffect(() => {
    refreshCount();
    return subscribeMealDraftQueue(refreshCount);
  }, [refreshCount]);

  useEffect(() => {
    function onOnline() {
      void flush();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function flush() {
    const failed = listFailedSaves();
    if (failed.length === 0) return;
    setFlushing(true);
    let savedAny = false;
    try {
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
    } finally {
      setFlushing(false);
      refreshCount();
      if (savedAny) {
        emitMascotReaction("save");
        onFlushed?.();
      }
    }
  }

  if (queuedCount <= 0) return null;

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
      role="status"
    >
      <p className="min-w-0 flex-1 font-medium">
        Офлайн-очередь: {queuedCount}{" "}
        {queuedCount === 1 ? "запись ждёт отправки" : "записей ждут отправки"}
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
