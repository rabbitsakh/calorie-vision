"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";
import { pluralDays } from "@/lib/russian-text";

const PANEL_ID = "streak-nudge";

type StreakNudgeData = {
  streakBeforeToday: number;
  streakAtRisk: boolean;
  loggedToday: boolean;
};

type StreakNudgeProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
  onAddFood: () => void;
  /** When hidden, return null so MotivationQueue can show the next card. */
  quietHide?: boolean;
};

export function StreakNudge({
  selectedDate,
  today,
  refreshKey,
  onAddFood,
  quietHide = false,
}: StreakNudgeProps) {
  const [data, setData] = useState<StreakNudgeData | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate !== today) {
      setData(null);
      return;
    }

    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/streak?today=${today}`));
        if (!resp.ok) return;
        const json = (await resp.json()) as StreakNudgeData;
        setData(json);
      } catch {
        // non-critical
      }
    })();
  }, [selectedDate, today, refreshKey]);

  if (!data || selectedDate !== today || data.loggedToday || !data.streakAtRisk) {
    return null;
  }

  if (hidden) {
    if (quietHide) return null;
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-orange-200 px-4 py-2.5 text-sm text-orange-600 hover:border-orange-300"
        onClick={() => {
          showPanelToday(PANEL_ID, selectedDate);
          setHidden(false);
        }}
      >
        <span className="flex items-center gap-1.5">
          <Mascot pose="tip" size="sm" animate={false} />
          Серия {data.streakBeforeToday} {pluralDays(data.streakBeforeToday)} под угрозой
        </span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Mascot pose="tip" size="md" className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-orange-900">
            Не потеряйте серию — {data.streakBeforeToday} {pluralDays(data.streakBeforeToday)}!
          </p>
          <p className="mt-0.5 text-sm text-orange-700">
            Сегодня ещё нет записей. Добавьте хотя бы один приём пищи, чтобы сохранить серию.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-on-tint text-sm text-orange-800"
              onClick={onAddFood}
            >
              Добавить еду
            </button>
            <button
              type="button"
              className="btn-quiet text-sm text-orange-700 hover:bg-orange-100"
              onClick={() => {
                hidePanelToday(PANEL_ID, selectedDate);
                setHidden(true);
              }}
            >
              Скрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
