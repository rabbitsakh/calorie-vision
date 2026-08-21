"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";

const PANEL_ID = "motivation-tip";
const CACHE_PREFIX = "motivation-tip-";

type MotivationTipProps = {
  today: string;
  selectedDate: string;
};

export function MotivationTip({ today, selectedDate }: MotivationTipProps) {
  const [tip, setTip] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate !== today) {
      setTip(null);
      return;
    }

    try {
      const cached = localStorage.getItem(`${CACHE_PREFIX}${today}`);
      if (cached) {
        setTip(cached);
        return;
      }
    } catch {
      // continue to fetch
    }

    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/motivation-tip"));
        if (!resp.ok) return;
        const data = (await resp.json()) as { tip?: string; date?: string };
        if (!data.tip || data.date !== today) return;
        setTip(data.tip);
        try {
          localStorage.setItem(`${CACHE_PREFIX}${today}`, data.tip);
        } catch {
          // ignore
        }
      } catch {
        // non-critical
      }
    })();
  }, [today, selectedDate]);

  if (!tip || selectedDate !== today) return null;

  if (hidden) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-500 hover:border-slate-300"
        onClick={() => {
          showPanelToday(PANEL_ID, selectedDate);
          setHidden(false);
        }}
      >
        <span>Совет дня</span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-teal-50/40 p-4">
      <div className="flex items-start gap-3">
        <Mascot pose="tip" size="sm" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-teal-700">Совет дня</p>
            <button
              type="button"
              className="btn-quiet shrink-0 text-xs text-slate-500"
              onClick={() => {
                hidePanelToday(PANEL_ID, selectedDate);
                setHidden(true);
              }}
            >
              Скрыть
            </button>
          </div>
          <p className="mt-1 text-sm text-slate-800">{tip}</p>
        </div>
      </div>
    </div>
  );
}
