"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toDateKeyTz } from "@/lib/dates";
import { notifyDietTargetsChanged } from "@/lib/diet-refresh";
import { trackWeightLoggedGoal } from "@/lib/metrika-funnel";
import { OPEN_WEIGHT_QUICK_EVENT } from "@/lib/open-weight-quick";
import { withBasePath } from "@/lib/paths";
import { useTimezone } from "@/lib/use-timezone";
import { enqueueWeightDraft } from "@/lib/weight-draft-queue";

/**
 * Bottom sheet from center «+» → Вес. Logs today's kg without opening /weight.
 */
export function WeightQuickSheet() {
  const timezone = useTimezone();
  const [open, setOpen] = useState(false);
  const [weightInput, setWeightInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
      setError(null);
      setDoneMsg(null);
      setWeightInput("");
    }
    window.addEventListener(OPEN_WEIGHT_QUICK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_WEIGHT_QUICK_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  async function saveWeight(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setDoneMsg(null);

    const now = new Date();
    const dateKey = toDateKeyTz(now, timezone);
    const weightKg = Number(String(weightInput).replace(",", "."));
    if (!Number.isFinite(weightKg) || weightKg < 20 || weightKg > 300) {
      setError("Укажите вес от 20 до 300 кг");
      setSaving(false);
      return;
    }
    const measuredAt = now.toISOString();

    try {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueueWeightDraft({ date: dateKey, weightKg, measuredAt, note: null });
        setDoneMsg("Нет сети — вес в офлайн-очереди");
        setWeightInput("");
        notifyDietTargetsChanged();
        return;
      }

      const response = await fetch(withBasePath("/api/weights"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateKey, weightKg, measuredAt, note: null }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось сохранить вес");
      }
      trackWeightLoggedGoal();
      notifyDietTargetsChanged();
      setWeightInput("");
      setDoneMsg(`Сохранено: ${weightKg} кг`);
      window.setTimeout(() => setOpen(false), 700);
    } catch (err) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      if (offline || (err instanceof TypeError && /fetch|network|failed/i.test(err.message))) {
        enqueueWeightDraft({ date: dateKey, weightKg, measuredAt, note: null });
        setDoneMsg("Нет сети — вес в офлайн-очереди");
        setWeightInput("");
        notifyDietTargetsChanged();
      } else {
        setError(err instanceof Error ? err.message : "Ошибка сохранения");
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weight-quick-title"
      onClick={close}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p id="weight-quick-title" className="font-semibold text-slate-900">
              Вес сегодня
            </p>
            <p className="text-xs text-slate-500">Быстрая запись из «+»</p>
          </div>
          <button type="button" className="btn-quiet text-sm text-slate-500" onClick={close}>
            Закрыть
          </button>
        </div>

        <form
          className="flex flex-col gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
          onSubmit={(event) => void saveWeight(event)}
        >
          <div className="field">
            <label htmlFor="weight-quick-kg">Вес, кг</label>
            <input
              id="weight-quick-kg"
              type="number"
              inputMode="decimal"
              min={20}
              max={300}
              step={0.1}
              placeholder="78.5"
              value={weightInput}
              disabled={saving}
              autoFocus
              required
              onChange={(event) => setWeightInput(event.target.value)}
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {doneMsg ? <p className="text-sm text-teal-700">{doneMsg}</p> : null}

          <button type="submit" className="btn btn-primary w-full" disabled={saving}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>

          <Link
            href={withBasePath("/weight")}
            className="btn-quiet text-center text-sm text-teal-800"
            onClick={close}
          >
            Журнал и цель веса
          </Link>
        </form>
      </div>
    </div>
  );
}
