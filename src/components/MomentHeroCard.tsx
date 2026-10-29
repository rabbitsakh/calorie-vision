"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import {
  buildMomentHero,
  pickSoftStep,
  type MomentCta,
  type MomentHero,
  type MomentRoutine,
  type SoftStepAction,
} from "@/lib/moment-hero";
import {
  buildMorningTodayBrief,
  streakOwnsMorning,
  type MorningTodayRoutine,
} from "@/lib/morning-today";
import { requestOpenFoodAddPicker, requestOpenFoodCamera } from "@/lib/open-food-camera";
import { requestOpenWaterQuick } from "@/lib/open-water-quick";
import { requestOpenWeightQuick } from "@/lib/open-weight-quick";
import { mascotArtUrl } from "@/lib/mascot-art";
import { resolveMascotSkin } from "@/lib/mascot-skin";
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

type PlanPayload = { today?: Array<MorningTodayRoutine & { exerciseCount?: number }> };
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
  const [routine, setRoutine] = useState<MomentRoutine | null>(null);
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
          const first = plan.today?.[0];
          setRoutine(
            first
              ? {
                  name:
                    first.planLabel?.trim() ||
                    first.name.trim() ||
                    (first.muscleLabels ?? []).slice(0, 2).join(" + ") ||
                    "Тренировка",
                  exerciseCount: first.exerciseCount ?? 0,
                }
              : null,
          );
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
      routine,
      logged,
      mealCount: new Set((meals?.entries ?? []).map((e) => e.mealType ?? e.id)).size,
      calories: meals?.totalCalories ?? 0,
      calorieTarget: meals?.target?.calories ?? null,
      protein: meals?.totalProtein ?? 0,
      proteinTarget: meals?.target?.protein ?? null,
      fat: meals?.totalFat ?? 0,
      fatTarget: meals?.target?.fat ?? null,
      carbs: meals?.totalCarbs ?? 0,
      carbsTarget: meals?.target?.carbs ?? null,
      waterMl: water?.totalMl ?? 0,
      waterTarget: water?.target ?? 0,
      streak: streak?.streak ?? 0,
      softStep,
    });
  }, [selectedDate, today, day, hour, gymDone, gymLive, routines, routine]);

  if (!moment) return null;

  const runAction = (action: SoftStepAction) => {
    if (action === "weight") requestOpenWeightQuick();
    else if (action === "water") requestOpenWaterQuick();
    else if (action === "camera") requestOpenFoodCamera();
    else {
      if (action === "week") {
        dismissWeekNudge(today);
        bump((n) => n + 1);
      }
      requestOpenFoodAddPicker();
    }
  };

  return <MomentHeroView moment={moment} selectedDate={selectedDate} onAction={runAction} />;
}

const MACRO_COLOR = { protein: "var(--accent-protein)", fat: "var(--accent-fat)", carbs: "var(--accent-carbs)" };

function Ring({ pct }: { pct: number }) {
  const size = 88;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fill = Math.max(0, Math.min(100, pct));
  return (
    <span className="moment-ring" aria-label={`${pct}% цели`}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ece9e2" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={pct > 108 ? "var(--accent-streak)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * fill) / 100} ${c}`}
        />
      </svg>
      <span className="moment-ring-value">
        <b>{pct}%</b>
        <span>цель</span>
      </span>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function MomentHeroView({
  moment,
  selectedDate,
  onAction,
}: {
  moment: MomentHero;
  selectedDate: string;
  onAction: (action: SoftStepAction) => void;
}) {
  const dark = moment.tone === "dark";
  const startsGym = moment.cta?.label === "Начать тренировку";

  const renderCta = (cta: MomentCta) => {
    const cls = `moment-cta${dark ? " moment-cta--white" : ""}`;
    const body = (
      <>
        {startsGym ? (
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4v16l13-8z" />
          </svg>
        ) : null}
        {cta.label}
      </>
    );
    if (cta.action) {
      const action = cta.action;
      return (
        <button type="button" className={cls} onClick={() => onAction(action)}>
          {body}
        </button>
      );
    }
    const href = cta.href.startsWith("/assistant") ? cta.href : withDateQuery(cta.href, selectedDate);
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  };

  return (
    <>
      <section
        className={`moment-hero moment-hero--${moment.tone} moment-hero--${moment.phase}`}
        aria-label={moment.eyebrow}
        data-testid="moment-hero"
      >
        <div className="moment-hero-body">
          <div className="moment-hero-copy">
            <p className="moment-hero-eyebrow">{moment.eyebrow}</p>
            {moment.ringPct != null ? (
              <div className="moment-ring-row">
                <span className="moment-ring-wrap">
                  <Ring pct={moment.ringPct} />
                </span>
                <div className="min-w-0">
                  <p className="moment-hero-title moment-hero-title--sm">{moment.title}</p>
                  {moment.line ? <p className="moment-hero-line">{moment.line}</p> : null}
                </div>
              </div>
            ) : (
              <>
                <p className="moment-hero-title">{moment.title}</p>
                {moment.line ? <p className="moment-hero-line">{moment.line}</p> : null}
              </>
            )}
            {moment.macros ? (
              <div className="moment-macros">
                {moment.macros.map((m) => (
                  <div key={m.key} className="moment-macro">
                    <span className="moment-macro-label">{m.label}</span>
                    <span className="moment-macro-track">
                      <i
                        style={{
                          width: `${Math.min(100, Math.round((m.value / m.target) * 100))}%`,
                          background: MACRO_COLOR[m.key],
                        }}
                      />
                    </span>
                    <span className="moment-macro-value">
                      {m.value}/{m.target}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {moment.hint ? <p className="moment-hero-hint">{moment.hint}</p> : null}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- static mascot still from /public */}
          <img
            className="moment-mascot"
            src={withBasePath(mascotArtUrl(moment.mascot, resolveMascotSkin()))}
            alt=""
            aria-hidden
          />
        </div>
        {moment.cta ? <div className="moment-hero-actions">{renderCta(moment.cta)}</div> : null}
      </section>
      {moment.checklist ? (
        <section className="moment-checklist" aria-label="Чек-лист дня">
          {moment.checklist.map((c) => (
            <div key={c.label} className="moment-check">
              <span className={`moment-check-dot${c.done ? "" : " moment-check-dot--no"}`}>
                {c.done ? <CheckIcon /> : null}
              </span>
              {c.label}
              <span className="moment-check-value">{c.value}</span>
            </div>
          ))}
        </section>
      ) : null}
    </>
  );
}
