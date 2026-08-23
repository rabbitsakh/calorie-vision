"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";
import { WATER_DAILY_TARGET_ML } from "@/lib/water-target";

type WaterResponse = {
  totalMl: number;
  target: number;
};

const QUICK_AMOUNTS = [200, 250, 350, 500];
const PANEL_ID = "water";

export function WaterTracker({
  selectedDate,
  onChanged,
}: {
  selectedDate: string;
  onChanged?: () => void;
}) {
  const [totalMl, setTotalMl] = useState(0);
  const [target, setTarget] = useState(WATER_DAILY_TARGET_ML);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath(`/api/water?date=${selectedDate}`));
      if (!resp.ok) return;
      const data = (await resp.json()) as WaterResponse;
      setTotalMl(data.totalMl);
      setTarget(data.target);
    } catch {
      // non-critical
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!hidden) void load();
  }, [load, hidden]);

  function handleHide() {
    hidePanelToday(PANEL_ID, selectedDate);
    setHidden(true);
  }

  async function add(ml: number) {
    setLoading(true);
    try {
      const resp = await fetch(withBasePath("/api/water"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, ml }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as WaterResponse;
        setTotalMl(data.totalMl);
        setTarget(data.target);
        onChanged?.();
      }
    } finally {
      setLoading(false);
    }
  }

  if (hidden) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-400 hover:border-slate-300"
        onClick={() => { showPanelToday(PANEL_ID, selectedDate); setHidden(false); }}
      >
        <span>💧 Вода — {totalMl} / {target} мл</span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  const pct = Math.min(100, Math.round((totalMl / target) * 100));
  const done = pct >= 100;
  const glasses = Math.floor(totalMl / 250);
  const remaining = Math.max(0, target - totalMl);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <section className="card overflow-hidden">
      <div className="border-b border-sky-100 bg-[var(--accent-water-soft)] px-4 py-3 md:px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>💧</span>
              <h2 className="text-base font-semibold text-sky-950">Вода</h2>
            </div>
            <p className="mt-0.5 text-sm text-sky-900/80">
              {totalMl} / {target} мл
              {remaining > 0 ? ` · осталось ${remaining} мл` : " · норма выполнена"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <svg width="64" height="64" viewBox="0 0 72 72" aria-hidden>
                <circle cx="36" cy="36" r={r} fill="none" stroke="#bae6fd" strokeWidth="5" />
                <circle
                  cx="36" cy="36" r={r} fill="none"
                  stroke={done ? "var(--accent)" : "var(--accent-water)"}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  strokeDashoffset={circ / 4}
                  className="transition-all duration-500"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-sky-900">
                {done ? "✓" : `${pct}%`}
              </span>
            </div>
            <button type="button" className="btn-quiet text-sky-800" onClick={handleHide}>
              Скрыть
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 md:px-5">
        <p className="mb-3 text-xs text-slate-500">
          {glasses > 0
            ? `≈ ${glasses} ${glasses === 1 ? "стакан" : glasses < 5 ? "стакана" : "стаканов"}`
            : "Быстрые кнопки — добавьте стакан воды"}
        </p>
        <div className="chip-row-fill">
          {QUICK_AMOUNTS.map((ml) => (
            <button
              key={ml}
              type="button"
              className="chip min-h-10 justify-center font-semibold text-sky-800"
              style={{ background: "var(--accent-water-soft)" }}
              disabled={loading}
              onClick={() => void add(ml)}
            >
              +{ml} мл
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
