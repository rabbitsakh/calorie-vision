"use client";

import { useCallback, useEffect, useState } from "react";
import { toDateKeyTz } from "@/lib/dates";
import { trackWaterLoggedGoal } from "@/lib/metrika-funnel";
import { notifyWaterLogged, OPEN_WATER_QUICK_EVENT } from "@/lib/open-water-quick";
import { withBasePath } from "@/lib/paths";
import { useTimezone } from "@/lib/use-timezone";
import { enqueueWaterDraft } from "@/lib/water-draft-queue";
import { WATER_DAILY_TARGET_ML } from "@/lib/water-target";

const QUICK_AMOUNTS = [200, 250, 350, 500];

type WaterResponse = {
  totalMl: number;
  target: number;
};

/**
 * Bottom sheet from center «+» → Вода. Logs today's ml without scrolling the ration.
 */
export function WaterQuickSheet() {
  const timezone = useTimezone();
  const [open, setOpen] = useState(false);
  const [totalMl, setTotalMl] = useState(0);
  const [target, setTarget] = useState(WATER_DAILY_TARGET_ML);
  const [loading, setLoading] = useState(false);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const dateKey = toDateKeyTz(new Date(), timezone);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath(`/api/water?date=${encodeURIComponent(dateKey)}`));
      if (!resp.ok) return;
      const data = (await resp.json()) as WaterResponse;
      setTotalMl(data.totalMl);
      setTarget(data.target);
    } catch {
      // non-critical
    }
  }, [dateKey]);

  useEffect(() => {
    function onOpen() {
      setOpen(true);
      setDoneMsg(null);
      void load();
    }
    window.addEventListener(OPEN_WATER_QUICK_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_WATER_QUICK_EVENT, onOpen);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = useCallback(() => setOpen(false), []);

  async function add(ml: number) {
    setLoading(true);
    setDoneMsg(null);
    try {
      const resp = await fetch(withBasePath("/api/water"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateKey, ml }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as WaterResponse;
        setTotalMl(data.totalMl);
        setTarget(data.target);
        trackWaterLoggedGoal();
        notifyWaterLogged();
        setDoneMsg(`+${ml} мл`);
        window.setTimeout(() => setOpen(false), 650);
        return;
      }
      enqueueWaterDraft(dateKey, ml);
      setTotalMl((v) => v + ml);
      trackWaterLoggedGoal();
      notifyWaterLogged();
      setDoneMsg("Нет сети — вода в офлайн-очереди");
      window.setTimeout(() => setOpen(false), 900);
    } catch {
      enqueueWaterDraft(dateKey, ml);
      setTotalMl((v) => v + ml);
      trackWaterLoggedGoal();
      notifyWaterLogged();
      setDoneMsg("Нет сети — вода в офлайн-очереди");
      window.setTimeout(() => setOpen(false), 900);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const pct = Math.min(100, Math.round((totalMl / Math.max(1, target)) * 100));
  const done = pct >= 100;
  const remaining = Math.max(0, target - totalMl);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="water-quick-title"
      onClick={close}
    >
      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0">
            <p id="water-quick-title" className="font-semibold text-slate-900">
              Вода сегодня
            </p>
            <p className="text-xs text-slate-500">Быстрая запись из «+»</p>
          </div>
          <button type="button" className="btn-quiet text-sm text-slate-500" onClick={close}>
            Закрыть
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="rounded-2xl border border-sky-100 bg-[var(--accent-water-soft)] px-4 py-3">
            <p className="text-sm font-semibold text-sky-950">
              {totalMl} / {target} мл
              <span className="ml-2 text-xs font-bold text-sky-800">
                {done ? "✓ норма" : `${pct}%`}
              </span>
            </p>
            <p className="mt-0.5 text-xs text-sky-900/80">
              {done ? "Норма выполнена" : remaining > 0 ? `Осталось ${remaining} мл` : "Быстрые кнопки"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {QUICK_AMOUNTS.map((ml) => (
              <button
                key={ml}
                type="button"
                className="min-h-12 rounded-2xl border border-sky-200 bg-sky-50 text-base font-semibold text-sky-900 hover:border-sky-400 hover:bg-sky-100 disabled:opacity-50"
                disabled={loading}
                onClick={() => void add(ml)}
              >
                +{ml} мл
              </button>
            ))}
          </div>

          {doneMsg ? <p className="text-sm text-teal-700">{doneMsg}</p> : null}
        </div>
      </div>
    </div>
  );
}
