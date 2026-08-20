"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";

const PANEL_ID = "weekly-report";

type WeeklyReportData = {
  weekLabel: string;
  daysLogged: number;
  avgCalories: number;
  avgWaterMl: number;
  calorieTarget: number | null;
  insights: string[];
  topFoods: Array<{ dishName: string; count: number }>;
};

type WeeklyReportCardProps = {
  endDate: string;
};

export function WeeklyReportCard({ endDate }: WeeklyReportCardProps) {
  const [data, setData] = useState<WeeklyReportData | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, endDate));
  }, [endDate]);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/weekly-report?end=${endDate}`));
        if (!resp.ok) return;
        setData((await resp.json()) as WeeklyReportData);
      } catch {
        // non-critical
      }
    })();
  }, [endDate]);

  if (!data || data.daysLogged === 0) return null;

  if (hidden) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-indigo-200 px-4 py-2.5 text-sm text-indigo-600 hover:border-indigo-300"
        onClick={() => {
          showPanelToday(PANEL_ID, endDate);
          setHidden(false);
        }}
      >
        <span>Недельный отчёт — {data.weekLabel}</span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            Недельный отчёт
          </p>
          <p className="font-semibold text-indigo-900">{data.weekLabel}</p>
        </div>
        <button
          type="button"
          className="btn-quiet text-xs text-indigo-700 hover:bg-indigo-100"
          onClick={() => {
            hidePanelToday(PANEL_ID, endDate);
            setHidden(true);
          }}
        >
          Скрыть
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/80 px-3 py-2 text-center">
          <p className="text-xs text-slate-500">Дней с записями</p>
          <p className="text-lg font-bold text-indigo-900">{data.daysLogged}/7</p>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2 text-center">
          <p className="text-xs text-slate-500">Среднее ккал</p>
          <p className="text-lg font-bold text-indigo-900">{data.avgCalories}</p>
        </div>
        <div className="rounded-xl bg-white/80 px-3 py-2 text-center">
          <p className="text-xs text-slate-500">Вода/день</p>
          <p className="text-lg font-bold text-indigo-900">
            {data.avgWaterMl > 0 ? `${data.avgWaterMl} мл` : "—"}
          </p>
        </div>
      </div>

      {data.insights.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm text-indigo-900">
          {data.insights.map((line) => (
            <li key={line} className="flex gap-2">
              <span className="text-indigo-400">•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
