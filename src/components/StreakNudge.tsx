"use client";

import { useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import { MascotCompanionCard } from "@/components/MascotCompanionCard";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import {
  freezeBannerCopy,
  softRecoveryBody,
  softRecoveryTitle,
  streakAtRiskBody,
  streakAtRiskTitle,
} from "@/lib/motivation-voice";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";

const PANEL_ID = "streak-nudge";

type StreakNudgeData = {
  streakBeforeToday: number;
  streakAtRisk: boolean;
  loggedToday: boolean;
  canFreezeYesterday: boolean;
  yesterdayEmpty: boolean;
};

type StreakNudgeProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
  onAddFood: () => void;
  /** When hidden, return null so MotivationQueue can show the next card. */
  quietHide?: boolean;
};

function yesterdayEmptyFromLast14(
  last14: Array<{ date: string; logged: boolean; frozen: boolean }> | undefined,
): boolean {
  if (!last14 || last14.length < 2) return false;
  const yesterday = last14[last14.length - 2];
  return Boolean(yesterday && !yesterday.logged && !yesterday.frozen);
}

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
        yesterdayEmpty: yesterdayEmptyFromLast14(day.data.streak.last14),
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
        const json = (await resp.json()) as StreakNudgeData & {
          last14?: Array<{ date: string; logged: boolean; frozen: boolean }>;
        };
        setData({
          streakBeforeToday: json.streakBeforeToday,
          streakAtRisk: json.streakAtRisk,
          loggedToday: json.loggedToday,
          canFreezeYesterday: json.canFreezeYesterday,
          yesterdayEmpty: yesterdayEmptyFromLast14(json.last14),
        });
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
            prev
              ? {
                  ...prev,
                  canFreezeYesterday: false,
                  streakAtRisk: false,
                  yesterdayEmpty: false,
                }
              : prev,
          );
        }
      }
    } finally {
      setFreezing(false);
    }
  }

  if (!data || selectedDate !== today || data.loggedToday) {
    return null;
  }

  const showFreeze = data.canFreezeYesterday;
  const showAtRisk = data.streakAtRisk;
  const showSoftRecovery =
    !showAtRisk && !showFreeze && data.yesterdayEmpty;

  if (!showAtRisk && !showFreeze && !showSoftRecovery) {
    return null;
  }

  const title = showAtRisk
    ? streakAtRiskTitle(data.streakBeforeToday)
    : showFreeze
      ? "Вчера без записей"
      : softRecoveryTitle();

  const compactTitle = showAtRisk
    ? streakAtRiskTitle(data.streakBeforeToday, true)
    : showFreeze
      ? "Сохранить серию заморозкой"
      : softRecoveryTitle();

  const body = showFreeze && !showAtRisk
    ? freezeBannerCopy()
    : showFreeze
      ? `${streakAtRiskBody()} Можно также мягко сохранить серию заморозкой.`
      : showAtRisk
        ? streakAtRiskBody()
        : softRecoveryBody();

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
          {compactTitle}
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
      title={title}
      onHide={() => {
        hidePanelToday(PANEL_ID, selectedDate);
        setHidden(true);
      }}
      actions={
        <>
          <button type="button" className="btn btn-on-tint text-sm text-orange-800" onClick={onAddFood}>
            Добавить еду
          </button>
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
      <p className="text-orange-700">{body}</p>
    </MascotCompanionCard>
  );
}
