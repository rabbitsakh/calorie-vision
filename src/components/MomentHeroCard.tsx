"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { buildMomentHero, pickSoftStep, type MomentCta, type SoftStepAction } from "@/lib/moment-hero";
import {
  buildMorningTodayBrief,
  streakOwnsMorning,
  type MorningTodayRoutine,
} from "@/lib/morning-today";
import { requestOpenFoodAddPicker } from "@/lib/open-food-camera";
import { requestOpenWaterQuick } from "@/lib/open-water-quick";
import { requestOpenWeightQuick } from "@/lib/open-weight-quick";
import { withBasePath } from "@/lib/paths";
import {
  clearPostWorkoutNudge,
  hasFreshPostWorkoutNudge,
  shouldClearPostWorkoutNudge,
} from "@/lib/post-workout-nudge";
import { hydrateQuietHoursFromAccount, quietHoursLocalHour } from "@/lib/quiet-hours-prefs";
import { withDateQuery } from "@/lib/use-selected-date";
import { dismissWeekNudge, isWeekNudgeDismissed } from "@/lib/week-nudge-dismiss";

type Props = {
  selectedDate: string;
  today: string;
};

type PlanPayload = { today?: MorningTodayRoutine[] };
type SessionsPayload = {
  sessions?: Array<{ clockStatus?: string; endedAt?: string | null; muscleLabels?: string[] }>;
};

/**
 * «Сейчас главное» — the one card under the day ring. Replaces the morning brief
 * and the next-step bar so there is a single «what now» per moment.
 */
export function MomentHeroCard({ selectedDate, today }: Props) {
  const day = useOptionalRationDay();
  const [routines, setRoutines] = useState<MorningTodayRoutine[]>([]);
  const [gymDone, setGymDone] = useState(false);
  const [gymLive, setGymLive] = useState<{ label: string | null } | null>(null);
  const [hour, setHour] = useState(() => quietHoursLocalHour());
  const [, bump] = useState(0);

  useEffect(() => {
    hydrateQuietHoursFromAccount();
    setHour(quietHoursLocalHour());
    const t = window.setInterval(() => setHour(quietHoursLocalHour()), 5 * 60_000);
    return () => window.clearInterval(t);
  }, []);

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
          const sessions = ((await sessResp.json()) as SessionsPayload).sessions ?? [];
          setGymDone(sessions.some((s) => s.clockStatus === "finished" || Boolean(s.endedAt)));
          const live = sessions.find(
            (s) => s.clockStatus === "running" || s.clockStatus === "paused",
          );
          setGymLive(
            live
              ? {
                  label: live.muscleLabels?.length
                    ? live.muscleLabels.slice(0, 3).join(" · ")
                    : null,
                }
              : null,
          );
        }
      } catch {
        // non-critical — food-only moment still works
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, today]);

  // Protein already ok after gym — clear durable nudge without a CTA click.
  useEffect(() => {
    if (selectedDate !== today) return;
    if (!hasFreshPostWorkoutNudge()) return;
    const proteinTarget = day?.data?.meals?.target?.protein ?? 0;
    const protein = day?.data?.meals?.totalProtein ?? 0;
    if (shouldClearPostWorkoutNudge({ protein, proteinTarget })) {
      clearPostWorkoutNudge();
      bump((n) => n + 1);
    }
  }, [selectedDate, today, day?.data?.meals?.totalProtein, day?.data?.meals?.target?.protein]);

  const moment = useMemo(() => {
    const meals = day?.data?.meals;
    const water = day?.data?.water;
    const streak = day?.data?.streak;
    const logged = (meals?.entries.length ?? 0) > 0 || Boolean(streak?.loggedToday);
    const last14 = streak?.last14;
    const yesterdayEntry = last14 && last14.length >= 2 ? last14[last14.length - 2] : undefined;
    const yesterdayEmpty = Boolean(yesterdayEntry && !yesterdayEntry.logged && !yesterdayEntry.frozen);

    const morning = buildMorningTodayBrief({
      selectedIsToday: selectedDate === today,
      hour,
      loggedToday: logged,
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

    const softStep = pickSoftStep({
      hour,
      logged,
      hasTarget: meals?.target != null,
      protein: meals?.totalProtein ?? 0,
      proteinTarget: meals?.target?.protein ?? 0,
      waterMl: water?.totalMl ?? 0,
      waterTarget: water?.target ?? 0,
      postWorkout: hasFreshPostWorkoutNudge(),
      weekNudge: streak?.weekNudge ?? null,
      daysLoggedThisWeek: streak?.daysLoggedThisWeek ?? 0,
      weekNudgeDismissed: isWeekNudgeDismissed(today),
    });

    return buildMomentHero({
      selectedIsToday: selectedDate === today,
      hour,
      gymLive: gymLive != null,
      gymLiveLabel: gymLive?.label ?? null,
      gymDoneToday: gymDone,
      morning,
      logged,
      calories: meals?.totalCalories ?? 0,
      calorieTarget: meals?.target?.calories ?? null,
      protein: meals?.totalProtein ?? 0,
      proteinTarget: meals?.target?.protein ?? null,
      waterMl: water?.totalMl ?? 0,
      waterTarget: water?.target ?? 0,
      streak: streak?.streak ?? 0,
      softStep,
    });
  }, [selectedDate, today, day, hour, gymDone, gymLive, routines]);

  if (!moment) return null;

  const runAction = (action: SoftStepAction) => {
    if (action === "weight") requestOpenWeightQuick();
    else if (action === "water") requestOpenWaterQuick();
    else {
      if (action === "week") {
        dismissWeekNudge(today);
        bump((n) => n + 1);
      }
      requestOpenFoodAddPicker();
    }
  };

  const ctaClass =
    moment.phase === "gym"
      ? "shrink-0 rounded-[var(--radius-md)] bg-white px-3.5 py-2 text-xs font-bold text-[var(--accent-ink)]"
      : "shrink-0 rounded-[var(--radius-md)] bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]";

  const renderCta = (cta: MomentCta) => {
    if (cta.action) {
      const action = cta.action;
      return (
        <button type="button" className={ctaClass} onClick={() => runAction(action)}>
          {cta.label}
        </button>
      );
    }
    const href = cta.href.startsWith("/assistant") ? cta.href : withDateQuery(cta.href, selectedDate);
    return (
      <Link href={withBasePath(href)} className={ctaClass}>
        {cta.label}
      </Link>
    );
  };

  return (
    <section
      className={`moment-hero moment-hero--${moment.phase} ration-soft-nudge`}
      aria-label={moment.eyebrow}
      data-testid="moment-hero"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="moment-hero-eyebrow">{moment.eyebrow}</p>
          <p className="moment-hero-title">{moment.title}</p>
          {moment.line ? <p className="moment-hero-line">{moment.line}</p> : null}
          {moment.hint ? <p className="moment-hero-hint">{moment.hint}</p> : null}
        </div>
        {moment.cta ? renderCta(moment.cta) : null}
      </div>
    </section>
  );
}
