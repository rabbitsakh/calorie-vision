"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";

type WaterResponse = {
  totalMl: number;
  target: number;
};

const QUICK_AMOUNTS = [200, 250, 350, 500];
const PANEL_ID = "water";

export function WaterTracker({ selectedDate }: { selectedDate: string }) {
  const [totalMl, setTotalMl] = useState(0);
  const [target, setTarget] = useState(2000);
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
    <section className="card p-4 md:p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Вода</h2>
            <button type="button" className="btn-quiet" onClick={handleHide}>
              Скрыть
            </button>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {totalMl} мл из {target} мл
            {remaining > 0 ? ` · ещё ${remaining} мл` : " · норма выполнена!"}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {glasses > 0
              ? `≈ ${glasses} ${glasses === 1 ? "стакан" : glasses < 5 ? "стакана" : "стаканов"}`
              : "Начните пить воду сегодня"}
          </p>
        </div>

        <div className="relative shrink-0">
          <svg width="72" height="72" viewBox="0 0 72 72">
            <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
            <circle
              cx="36" cy="36" r={r} fill="none"
              stroke={done ? "var(--accent)" : "var(--accent-water)"}
              strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              strokeDashoffset={circ / 4}
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-700">
            {done ? (
              <svg aria-hidden="true" className="h-6 w-6 text-teal-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="M5 12.5l5 5L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              `${pct}%`
            )}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {QUICK_AMOUNTS.map((ml) => (
          <button
            key={ml} type="button"
            className="min-h-10 rounded-xl px-4 text-sm font-semibold transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--accent-water-soft)", color: "var(--accent-water)" }}
            disabled={loading}
            onClick={() => void add(ml)}
          >
            +{ml} мл
          </button>
        ))}
      </div>
    </section>
  );
}
