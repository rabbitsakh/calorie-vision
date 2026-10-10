"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { isLikelyOfflineError } from "@/lib/connectivity";
import { toDateKeyTz } from "@/lib/dates";
import { notifyDietTargetsChanged } from "@/lib/diet-refresh";
import { trackWeightLoggedGoal } from "@/lib/metrika-funnel";
import { OPEN_WEIGHT_QUICK_EVENT } from "@/lib/open-weight-quick";
import { withBasePath } from "@/lib/paths";
import { readRationDayCache } from "@/lib/ration-day-cache";
import { useTimezone } from "@/lib/use-timezone";
import {
  formatWeightDayConflictPrompt,
  isWeightDayConflictPayload,
  weightsDiffer,
} from "@/lib/weight-day-conflict";
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
  const [existingKg, setExistingKg] = useState<number | null>(null);
  const [pendingConflict, setPendingConflict] = useState<{
    existingKg: number;
    nextKg: number;
    dateKey: string;
    measuredAt: string;
  } | null>(null);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
      setError(null);
      setDoneMsg(null);
      setPendingConflict(null);
      setWeightInput("");
      const dateKey = toDateKeyTz(new Date(), timezone);
      const cached = readRationDayCache(dateKey)?.weightKg;
      setExistingKg(typeof cached === "number" && cached > 0 ? cached : null);
    }
    window.addEventListener(OPEN_WEIGHT_QUICK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_WEIGHT_QUICK_EVENT, onOpen);
  }, [timezone]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  async function postWeight(options: {
    dateKey: string;
    weightKg: number;
    measuredAt: string;
    confirmReplace?: boolean;
  }) {
    const response = await fetch(withBasePath("/api/weights"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: options.dateKey,
        weightKg: options.weightKg,
        measuredAt: options.measuredAt,
        note: null,
        confirmReplace: options.confirmReplace === true,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    return { response, payload };
  }

  function finishOk(weightKg: number) {
    trackWeightLoggedGoal();
    notifyDietTargetsChanged();
    setWeightInput("");
    setPendingConflict(null);
    setExistingKg(weightKg);
    setDoneMsg(`Сохранено: ${weightKg} кг`);
    window.setTimeout(() => setOpen(false), 700);
  }

  function queueOffline(dateKey: string, weightKg: number, measuredAt: string) {
    enqueueWeightDraft({ date: dateKey, weightKg, measuredAt, note: null });
    setDoneMsg("Не удалось отправить — вес в очереди на устройстве");
    setWeightInput("");
    setPendingConflict(null);
    setExistingKg(weightKg);
    notifyDietTargetsChanged();
  }

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
      const { response, payload } = await postWeight({ dateKey, weightKg, measuredAt });
      if (response.status === 409 && isWeightDayConflictPayload(payload)) {
        setPendingConflict({
          existingKg: payload.conflict.weightKg,
          nextKg: weightKg,
          dateKey,
          measuredAt,
        });
        setExistingKg(payload.conflict.weightKg);
        setSaving(false);
        return;
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось сохранить вес");
      }
      finishOk(weightKg);
    } catch (err) {
      if (isLikelyOfflineError(err)) {
        const cachedKg = readRationDayCache(dateKey)?.weightKg;
        if (
          typeof cachedKg === "number" &&
          weightsDiffer(cachedKg, weightKg) &&
          !pendingConflict
        ) {
          setPendingConflict({
            existingKg: cachedKg,
            nextKg: weightKg,
            dateKey,
            measuredAt,
          });
          setExistingKg(cachedKg);
        } else {
          queueOffline(dateKey, weightKg, measuredAt);
        }
      } else {
        setError(err instanceof Error ? err.message : "Ошибка сохранения");
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmReplace() {
    if (!pendingConflict) return;
    setSaving(true);
    setError(null);
    const { dateKey, nextKg, measuredAt } = pendingConflict;
    try {
      const { response, payload } = await postWeight({
        dateKey,
        weightKg: nextKg,
        measuredAt,
        confirmReplace: true,
      });
      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось сохранить вес");
      }
      finishOk(nextKg);
    } catch (err) {
      if (isLikelyOfflineError(err)) {
        queueOffline(dateKey, nextKg, measuredAt);
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
      className="fixed inset-0 z-[70] flex items-end justify-center bg-[var(--accent-ink)]/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="weight-quick-title"
      onClick={close}
    >
      <div
        className="food-add-sheet flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl shadow-xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[rgba(13,115,119,0.08)] px-4 py-3">
          <div className="min-w-0">
            <p id="weight-quick-title" className="font-semibold text-[var(--foreground)]">
              Вес сегодня
            </p>
            <p className="text-xs text-[var(--muted)]">
              {existingKg != null
                ? `Сейчас: ${existingKg} кг`
                : "Быстрая запись из «+»"}
            </p>
          </div>
          <button type="button" className="btn-quiet text-sm text-[var(--muted)]" onClick={close}>
            Закрыть
          </button>
        </div>

        <form
          className="flex flex-col gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
          onSubmit={(event) => void saveWeight(event)}
        >
          <div className="rounded-2xl border border-[rgba(13,115,119,0.08)] bg-[var(--surface-mist)]/80 p-3">
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
                disabled={saving || pendingConflict != null}
                autoFocus
                required
                onChange={(event) => setWeightInput(event.target.value)}
              />
            </div>
            <Link
              href={withBasePath("/weight")}
              className="mt-2 inline-flex text-sm font-medium text-teal-800 underline-offset-2 hover:underline"
              onClick={close}
            >
              Открыть журнал веса
            </Link>
          </div>

          {pendingConflict ? (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950"
              role="status"
            >
              <p className="font-medium">
                {formatWeightDayConflictPrompt(
                  pendingConflict.existingKg,
                  pendingConflict.nextKg,
                )}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  disabled={saving}
                  onClick={() => void confirmReplace()}
                >
                  {saving ? "Сохраняем…" : "Заменить"}
                </button>
                <button
                  type="button"
                  className="btn-quiet text-sm"
                  disabled={saving}
                  onClick={() => setPendingConflict(null)}
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          {doneMsg ? <p className="text-sm text-teal-700">{doneMsg}</p> : null}

          {!pendingConflict ? (
            <button type="submit" className="btn btn-primary w-full" disabled={saving}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
