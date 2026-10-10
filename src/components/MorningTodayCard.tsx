"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import {
  buildMorningTodayBrief,
  streakOwnsMorning,
  type MorningTodayRoutine,
} from "@/lib/morning-today";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";
import { withBasePath } from "@/lib/paths";
import { withDateQuery } from "@/lib/use-selected-date";

const PANEL_ID = "morning-today";

type MorningTodayCardProps = {
  selectedDate: string;
  today: string;
};

type PlanPayload = {
  today?: MorningTodayRoutine[];
};

/**
 * Soft morning brief under DayHero — one line, optional «В зал».
 * Yields to StreakNudge and steps aside after noon / dismiss.
 */
export function MorningTodayCard({ selectedDate, today }: MorningTodayCardProps) {
  const day = useOptionalRationDay();
  const [routines, setRoutines] = useState<MorningTodayRoutine[]>([]);
  const [gymDone, setGymDone] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [hour, setHour] = useState(() => new Date().getHours());

  useEffect(() => {
    setHour(new Date().getHours());
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate !== today) return;
    let cancelled = false;
    void (async () => {
      try {
        const [planResp, sessResp] = await Promise.all([
          fetch(withBasePath(`/api/workouts/plan?date=${today}`)),
          fetch(withBasePath(`/api/workouts?date=${today}&limit=5`)),
        ]);
        if (cancelled) return;
        if (planResp.ok) {
          const plan = (await planResp.json()) as PlanPayload;
          setRoutines(
            (plan.today ?? []).map((r) => ({
              name: r.name,
              planLabel: r.planLabel,
              muscleLabels: r.muscleLabels ?? [],
            })),
          );
        }
        if (sessResp.ok) {
          const data = (await sessResp.json()) as {
            sessions?: Array<{ clockStatus?: string; endedAt?: string | null }>;
          };
          const sessions = data.sessions ?? [];
          setGymDone(
            sessions.some(
              (s) => s.clockStatus === "finished" || Boolean(s.endedAt),
            ),
          );
        }
      } catch {
        // non-critical — food-only brief still works
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, today]);

  const brief = useMemo(() => {
    const meals = day?.data?.meals;
    const streak = day?.data?.streak;
    const loggedToday =
      Boolean(streak?.loggedToday) || (meals?.entries.length ?? 0) > 0;
    const last14 = streak?.last14;
    const yesterdayEntry =
      last14 && last14.length >= 2 ? last14[last14.length - 2] : undefined;
    const yesterdayEmpty = Boolean(
      yesterdayEntry && !yesterdayEntry.logged && !yesterdayEntry.frozen,
    );

    return buildMorningTodayBrief({
      selectedIsToday: selectedDate === today,
      hour,
      loggedToday,
      calories: meals?.totalCalories ?? 0,
      calorieTarget: meals?.target?.calories ?? null,
      streakOwnsMorning: streakOwnsMorning({
        yesterdayEmpty,
        canFreezeYesterday: Boolean(streak?.canFreezeYesterday),
        streakAtRisk: Boolean(streak?.streakAtRisk),
      }),
      gymDoneToday: gymDone,
      routinesToday: routines,
    });
  }, [selectedDate, today, day, hour, gymDone, routines]);

  if (!brief) return null;

  if (hidden) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--border-hairline)] px-3.5 py-2 text-sm text-[var(--muted)] hover:border-[var(--accent)]/40"
        onClick={() => {
          showPanelToday(PANEL_ID, selectedDate);
          setHidden(false);
        }}
      >
        <span>{brief.eyebrow}</span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  return (
    <div
      className="morning-today-card ration-soft-nudge flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-hairline)] bg-white/80 px-3.5 py-2.5 shadow-[var(--shadow-card)]"
      aria-label={brief.eyebrow}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          {brief.eyebrow}
        </p>
        <p className="mt-0.5 text-sm font-medium text-[var(--foreground)]">{brief.line}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {brief.cta ? (
          <Link
            href={withBasePath(withDateQuery(brief.cta.href, selectedDate))}
            className="rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            {brief.cta.label}
          </Link>
        ) : null}
        <button
          type="button"
          className="text-xs text-[var(--muted)] underline-offset-2 hover:underline"
          onClick={() => {
            hidePanelToday(PANEL_ID, selectedDate);
            setHidden(true);
          }}
        >
          Скрыть
        </button>
      </div>
    </div>
  );
}
