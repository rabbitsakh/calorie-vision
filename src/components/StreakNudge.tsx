"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { MascotCompanionCard } from "@/components/MascotCompanionCard";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { freezeBannerCopy, streakAtRiskBody, streakAtRiskTitle } from "@/lib/motivation-voice";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";

const PANEL_ID = "streak-nudge";

type StreakNudgeData = {
  streakBeforeToday: number;
  streakAtRisk: boolean;
  loggedToday: boolean;
  canFreezeYesterday: boolean;
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
  const day = useOptionalRationDay();
  const [data, setData] = useState<StreakNudgeData | null>(null);
  const [hidden, setHidden] = useState(false);
  const [freezing, setFreezing] = useState(false);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate !== today) {
      setData(null);
      return;
    }

    if (day?.data?.streak && day.today === today) {
      setData({
        streakBeforeToday: day.data.streak.streakBeforeToday,
        streakAtRisk: day.data.streak.streakAtRisk,
        loggedToday: day.data.streak.loggedToday,
        canFreezeYesterday: day.data.streak.canFreezeYesterday,
      });
      return;
    }

    if (day && day.today === today && day.loading) {
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
  }, [selectedDate, today, refreshKey, day]);

  async function applyFreeze() {
    if (!data?.canFreezeYesterday || freezing) return;
    const yesterday = (() => {
      const d = new Date(today + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

    setFreezing(true);
    try {
      const resp = await fetch(withBasePath("/api/streak"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: yesterday, today }),
      });
      if (resp.ok) {
        if (day?.refresh) {
          await day.refresh(true);
        } else {
          setData((prev) =>
            prev ? { ...prev, canFreezeYesterday: false, streakAtRisk: false } : prev,
          );
        }
      }
    } finally {
      setFreezing(false);
    }
  }

  if (
    !data ||
    selectedDate !== today ||
    data.loggedToday ||
    (!data.streakAtRisk && !data.canFreezeYesterday)
  ) {
    return null;
  }

  const showFreeze = data.canFreezeYesterday;
  const showAtRisk = data.streakAtRisk;

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
          {showAtRisk
            ? streakAtRiskTitle(data.streakBeforeToday, true)
            : "Сохранить серию заморозкой"}
        </span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  return (
    <MascotCompanionCard
      pose="tip"
      size="md"
      tone="orange"
      title={
        showAtRisk
          ? streakAtRiskTitle(data.streakBeforeToday)
          : "Вчера без записей"
      }
      onHide={() => {
        hidePanelToday(PANEL_ID, selectedDate);
        setHidden(true);
      }}
      actions={
        <>
          {showAtRisk ? (
            <button type="button" className="btn btn-on-tint text-sm text-orange-800" onClick={onAddFood}>
              Добавить еду
            </button>
          ) : null}
          {showFreeze ? (
            <button
              type="button"
              className="btn-quiet text-sm text-sky-800"
              disabled={freezing}
              onClick={() => void applyFreeze()}
            >
              {freezing ? "Сохраняем…" : "Заморозить вчера"}
            </button>
          ) : null}
        </>
      }
    >
      <p className="text-orange-700">
        {showFreeze && !showAtRisk
          ? freezeBannerCopy()
          : showFreeze
            ? `${streakAtRiskBody()} Можно также мягко сохранить серию заморозкой.`
            : streakAtRiskBody()}
      </p>
    </MascotCompanionCard>
  );
}
