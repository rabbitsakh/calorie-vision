"use client";

import { useEffect, useState } from "react";
import { MascotCompanionCard } from "@/components/MascotCompanionCard";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";

const PANEL_ID = "motivation-tip";
const CACHE_PREFIX = "motivation-tip-";

type MotivationTipProps = {
  today: string;
  selectedDate: string;
  quietHide?: boolean;
};

export function MotivationTip({ today, selectedDate, quietHide = false }: MotivationTipProps) {
  const day = useOptionalRationDay();
  const [tip, setTip] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [hour, setHour] = useState(() => (typeof window === "undefined" ? 12 : new Date().getHours()));

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
    setHour(new Date().getHours());
  }, [selectedDate]);

  const loggedToday =
    Boolean(day?.data?.streak?.loggedToday) ||
    (day?.data?.meals.entries.length ?? 0) > 0;
  /** DayHero already motivates empty mornings — tip waits until after lunch + a meal. */
  const tipAllowed = selectedDate === today && loggedToday && hour >= 13;

  useEffect(() => {
    if (!tipAllowed) {
      setTip(null);
      return;
    }

    if (day?.data?.tip && day.today === today) {
      setTip(day.data.tip);
      try {
        localStorage.setItem(`${CACHE_PREFIX}${today}`, day.data.tip);
      } catch {
        // ignore
      }
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

    if (day && day.today === today && day.loading) {
      return;
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
  }, [today, tipAllowed, day]);

  if (!tip || !tipAllowed) return null;

  if (hidden) {
    if (quietHide) return null;
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
    <MascotCompanionCard
      pose="tip"
      tone="teal"
      title="Совет дня"
      onHide={() => {
        hidePanelToday(PANEL_ID, selectedDate);
        setHidden(true);
      }}
    >
      {tip}
    </MascotCompanionCard>
  );
}
