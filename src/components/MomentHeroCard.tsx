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
  formatMorningLiftGoalHint,
  pickMorningLiftExercise,
  plannedMaxKg,
} from "@/lib/moment-lift-goal";
import {
  buildMorningTodayBrief,
  streakOwnsMorning,
  type MorningTodayRoutine,
} from "@/lib/morning-today";
import { trackFirstMealSaveGoal, trackMealSavedGoal } from "@/lib/metrika-funnel";
import { requestOpenChestQuick } from "@/lib/open-chest-quick";
import { subscribeChestQueueRefresh } from "@/lib/chest-queue-refresh";
import type { EveningChestSnapshot } from "@/lib/moment-hero";
import {
  notifyFoodSaved,
  requestOpenFoodAddPicker,
  requestOpenFoodCamera,
} from "@/lib/open-food-camera";
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
import { inferMealTypeFromHour } from "@/lib/meal-type";
import { buildQuickMealLogExtras } from "@/lib/quick-meal-log";
import { fitsRemainingKcal } from "@/lib/suggestion-history";
import { hydrateQuietHoursFromAccount, quietHoursLocalHour } from "@/lib/quiet-hours-prefs";
import { withDateQuery } from "@/lib/use-selected-date";
import { dismissWeekNudge, isWeekNudgeDismissed } from "@/lib/week-nudge-dismiss";
import { useTimezone } from "@/lib/use-timezone";
import { MEAL_TYPE_LABELS } from "@/types";

type Props = {
  selectedDate: string;
  today: string;
};

type PlanExercise = {
  name: string;
  kind?: string | null;
  plannedSets?: Array<{ weightKg?: number | null }>;
};

type PlanPayload = {
  today?: Array<
    MorningTodayRoutine & {
      exerciseCount?: number;
      exercises?: PlanExercise[];
    }
  >;
};
type SessionsPayload = {
  sessions?: Array<{
    clockStatus?: string;
    endedAt?: string | null;
    muscleLabels?: string[];
    qualifiesForReward?: boolean;
    setCount?: number;
  }>;
};

type MealIdea = {
  name: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  portionGrams?: number;
};

/**
 * «Сейчас главное» — the one card under the day ring. Replaces the morning brief
 * and the next-step bar so there is a single «what now» per moment.
 */
export function MomentHeroCard({ selectedDate, today }: Props) {
  const day = useOptionalRationDay();
  const timezone = useTimezone();
  const [routines, setRoutines] = useState<MorningTodayRoutine[]>([]);
  const [routine, setRoutine] = useState<MomentRoutine | null>(null);
  const [tomorrowPlanLabel, setTomorrowPlanLabel] = useState<string | null>(null);
  const [gymDone, setGymDone] = useState(false);
  const [gymLive, setGymLive] = useState<{ label: string | null } | null>(null);
  const [mealIdeas, setMealIdeas] = useState<MealIdea[]>([]);
  const [ideasEmpty, setIdeasEmpty] = useState(false);
  const [addingIdea, setAddingIdea] = useState<number | null>(null);
  const [ideaError, setIdeaError] = useState<string | null>(null);
  const [hour, setHour] = useState(() => quietHoursLocalHour());
  const [, bump] = useState(0);

  const mealIdeasLabel = (() => {
    const slot = inferMealTypeFromHour(hour);
    const name = MEAL_TYPE_LABELS[slot].toLowerCase();
    if (slot === "SNACK") return "Идеи перекуса";
    return `Идеи на ${name}`;
  })();

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
        const tomorrow = (() => {
          const d = new Date(`${today}T12:00:00`);
          d.setDate(d.getDate() + 1);
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const day = String(d.getDate()).padStart(2, "0");
          return `${y}-${m}-${day}`;
        })();
        const [planResp, sessResp, tomorrowResp] = await Promise.all([
          fetch(withBasePath(`/api/workouts/plan?date=${today}`)),
          fetch(withBasePath(`/api/workouts?date=${today}&limit=5`)),
          fetch(withBasePath(`/api/workouts/plan?date=${tomorrow}`)),
        ]);
        if (cancelled) return;
        if (planResp.ok) {
          const plan = (await planResp.json()) as PlanPayload;
          const first = plan.today?.[0];
          const muscleHint = (first?.muscleLabels ?? []).slice(0, 2).join(" · ");
          let goalHint: string | null = muscleHint || null;
          const lift = pickMorningLiftExercise(first?.exercises);
          if (lift) {
            let lastKg: number | null = null;
            try {
              const histResp = await fetch(
                withBasePath(
                  `/api/workouts/exercise-history?name=${encodeURIComponent(lift.name)}&limit=4`,
                ),
              );
              if (histResp.ok) {
                const hist = (await histResp.json()) as {
                  points?: Array<{ topWeightKg?: number | null }>;
                };
                const weights = (hist.points ?? [])
                  .map((p) => Number(p.topWeightKg))
                  .filter((w) => Number.isFinite(w) && w > 0);
                lastKg = weights.length ? weights[weights.length - 1]! : null;
              }
            } catch {
              // planned weight still works
            }
            if (!cancelled) {
              goalHint =
                formatMorningLiftGoalHint({
                  exerciseName: lift.name,
                  lastKg,
                  plannedKg: plannedMaxKg(lift),
                }) ?? goalHint;
            }
          }
          if (cancelled) return;
          setRoutine(
            first
              ? {
                  name:
                    first.planLabel?.trim() ||
                    first.name.trim() ||
                    muscleHint ||
                    "Тренировка",
                  exerciseCount: first.exerciseCount ?? first.exercises?.length ?? 0,
                  goalHint,
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
        if (tomorrowResp.ok) {
          const plan = (await tomorrowResp.json()) as PlanPayload;
          const first = plan.today?.[0];
          setTomorrowPlanLabel(
            first
              ? first.planLabel?.trim() ||
                  first.name.trim() ||
                  (first.muscleLabels ?? []).slice(0, 2).join(" + ") ||
                  null
              : null,
          );
        } else {
          setTomorrowPlanLabel(null);
        }
        if (sessResp.ok) {
          const sessions = ((await sessResp.json()) as SessionsPayload).sessions ?? [];
          setGymDone(
            sessions.some((s) => {
              if (typeof s.qualifiesForReward === "boolean") return s.qualifiesForReward;
              return Boolean(s.endedAt) && (Number(s.setCount) || 0) > 0;
            }),
          );
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

  // Day moment: lunch ideas under remaining kcal (hybrid mockup).
  useEffect(() => {
    if (selectedDate !== today) {
      setMealIdeas([]);
      setIdeasEmpty(false);
      return;
    }
    const target = day?.data?.meals?.target?.calories ?? 0;
    const eaten = day?.data?.meals?.totalCalories ?? 0;
    const remaining = target - eaten;
    if (!(target > 0) || remaining <= 50) {
      setMealIdeas([]);
      setIdeasEmpty(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({ date: today, meal: inferMealTypeFromHour(hour) });
        if (hasFreshPostWorkoutNudge()) params.set("postWorkout", "1");
        const resp = await fetch(withBasePath(`/api/suggestions?${params}`));
        if (!resp.ok || cancelled) return;
        const json = (await resp.json()) as { suggestions?: MealIdea[] };
        const fitting = (json.suggestions ?? [])
          .filter((idea) => fitsRemainingKcal(idea.calories, remaining))
          .slice(0, 3);
        if (!cancelled) {
          setMealIdeas(fitting);
          setIdeasEmpty(fitting.length === 0);
        }
      } catch {
        if (!cancelled) {
          setMealIdeas([]);
          setIdeasEmpty(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, today, hour, day?.data?.meals?.totalCalories, day?.data?.meals?.target?.calories]);

  async function addMealIdea(idea: MealIdea, index: number) {
    setAddingIdea(index);
    setIdeaError(null);
    try {
      const extras = buildQuickMealLogExtras(selectedDate, timezone);
      const resp = await fetch(withBasePath("/api/meals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          dishName: idea.name,
          calories: idea.calories,
          protein: idea.protein || undefined,
          fat: idea.fat || undefined,
          carbs: idea.carbs || undefined,
          portionGrams: idea.portionGrams || undefined,
          ...extras,
        }),
      });
      if (!resp.ok) {
        setIdeaError("Не удалось добавить — попробуйте ещё раз");
        return;
      }
      trackFirstMealSaveGoal();
      trackMealSavedGoal();
      notifyFoodSaved();
      setMealIdeas((list) => list.filter((_, i) => i !== index));
      day?.refresh?.();
      bump((n) => n + 1);
    } catch {
      setIdeaError("Нет связи — идея не записалась");
    } finally {
      setAddingIdea(null);
    }
  }

  const [chest, setChest] = useState<EveningChestSnapshot | null>(null);

  useEffect(() => {
    if (selectedDate !== today) {
      setChest(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const resp = await fetch(withBasePath("/api/rewards"), { cache: "no-store" });
        if (!resp.ok || cancelled) return;
        const data = (await resp.json()) as {
          questDayCount?: number;
          openedQuestChests?: number;
          todayMarked?: boolean;
          chest?: {
            state: EveningChestSnapshot["state"];
            per?: number;
            queue?: EveningChestSnapshot["head"][];
          };
        };
        if (cancelled || !data.chest) return;
        const head = data.chest.queue?.[0] ?? null;
        setChest({
          state: data.chest.state,
          questDayCount: data.questDayCount ?? 0,
          openedQuestChests: data.openedQuestChests ?? 0,
          todayMarked: Boolean(data.todayMarked),
          per: data.chest.per,
          head: head
            ? {
                source: head.source,
                detail: head.detail,
                label: head.label,
                milestone: head.milestone,
              }
            : null,
        });
      } catch {
        if (!cancelled) setChest(null);
      }
    };
    void load();
    const unsub = subscribeChestQueueRefresh(() => void load());
    return () => {
      cancelled = true;
      unsub();
    };
  }, [selectedDate, today]);

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
      tomorrowPlanLabel,
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
      chest,
    });
  }, [selectedDate, today, day, hour, gymDone, gymLive, routines, routine, tomorrowPlanLabel, chest]);

  if (!moment) return null;

  const runAction = (action: SoftStepAction) => {
    if (action === "weight") requestOpenWeightQuick();
    else if (action === "water") requestOpenWaterQuick();
    else if (action === "camera") requestOpenFoodCamera();
    else if (action === "chest") {
      requestOpenChestQuick();
      document.getElementById("chest-dock")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      if (action === "week") {
        dismissWeekNudge(today);
        bump((n) => n + 1);
      }
      requestOpenFoodAddPicker();
    }
  };

  return (
    <MomentHeroView
      moment={moment}
      selectedDate={selectedDate}
      onAction={runAction}
      mealIdeas={moment.phase === "day" ? mealIdeas : []}
      mealIdeasLabel={mealIdeasLabel}
      ideasEmpty={moment.phase === "day" && ideasEmpty}
      addingIdea={addingIdea}
      ideaError={ideaError}
      onAddIdea={(idea, index) => void addMealIdea(idea, index)}
    />
  );
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
  mealIdeas = [],
  mealIdeasLabel = "Идеи под остаток",
  ideasEmpty = false,
  addingIdea = null,
  ideaError = null,
  onAddIdea,
}: {
  moment: MomentHero;
  selectedDate: string;
  onAction: (action: SoftStepAction) => void;
  mealIdeas?: MealIdea[];
  mealIdeasLabel?: string;
  ideasEmpty?: boolean;
  addingIdea?: number | null;
  ideaError?: string | null;
  onAddIdea?: (idea: MealIdea, index: number) => void;
}) {
  const dark = moment.tone === "dark";
  const chipCoversCta =
    moment.phase === "day" &&
    moment.chips != null &&
    (moment.cta?.action === "food" || moment.cta?.action === "water");
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
    if ("disabled" in cta && cta.disabled) {
      return (
        <button type="button" className={`${cls} moment-cta--disabled`} disabled>
          {cta.label}
        </button>
      );
    }
    if (cta.action) {
      const action = cta.action;
      return (
        <button type="button" className={cls} onClick={() => onAction(action)}>
          {body}
        </button>
      );
    }
    const href =
      cta.href.includes("#") || cta.href.startsWith("/assistant")
        ? cta.href
        : withDateQuery(cta.href, selectedDate);
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
                <p className="moment-hero-title">
                  {moment.title.includes(" из ") ? (
                    <>
                      <span>{moment.title.slice(0, moment.title.indexOf(" из "))}</span>
                      <span className="moment-hero-title-rest">из {moment.title.slice(moment.title.indexOf(" из ") + 4)}</span>
                    </>
                  ) : (
                    moment.title
                  )}
                </p>
                {moment.kcal ? (
                  <div
                    className="moment-kcal-scale"
                    role="meter"
                    aria-valuemin={0}
                    aria-valuemax={moment.kcal.target}
                    aria-valuenow={Math.max(0, moment.kcal.eaten)}
                    aria-label={moment.title}
                  >
                    <i
                      style={{
                        width: `${Math.max(0, Math.min(100, Math.round((moment.kcal.eaten / moment.kcal.target) * 100)))}%`,
                      }}
                    />
                  </div>
                ) : null}
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
                      {m.value.toLocaleString("ru-RU")} из {m.target.toLocaleString("ru-RU")} г
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
            {moment.proteinNote ? <p className="moment-protein-note">{moment.proteinNote}</p> : null}
            {mealIdeas.length > 0 || ideasEmpty ? (
              <div className="moment-meal-ideas" aria-label={mealIdeasLabel}>
                <p className="moment-meal-ideas-label">{mealIdeasLabel}</p>
                {mealIdeas.length > 0 ? (
                  <div className="moment-meal-ideas-row">
                    {mealIdeas.map((idea, i) => (
                      <button
                        key={`${idea.name}-${i}`}
                        type="button"
                        className="moment-meal-idea"
                        disabled={addingIdea != null}
                        onClick={() => onAddIdea?.(idea, i)}
                      >
                        <b>{addingIdea === i ? "…" : idea.name}</b>
                        <span>{Math.round(idea.calories)} ккал</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="moment-meal-ideas-empty">На этот приём в остаток ничего не подошло</p>
                )}
                {ideaError ? <p className="moment-meal-ideas-error">{ideaError}</p> : null}
              </div>
            ) : null}
            {moment.chips ? (
              <div className="moment-chips">
                {moment.chips.map((chip) =>
                  chip.kind === "gym" ? (
                    <Link key={chip.kind} href={withDateQuery("/workouts", selectedDate)} className="moment-chip">
                      <span className="moment-chip-copy">
                        <b>{chip.title}</b>
                        <span>{chip.detail}</span>
                      </span>
                      <span className="moment-chip-action moment-chip-action--quiet">{chip.actionLabel}</span>
                    </Link>
                  ) : (
                    <button key={chip.kind} type="button" className="moment-chip" onClick={() => onAction("water")}>
                      <span className="moment-chip-copy">
                        <b>{chip.title}</b>
                        <span>{chip.detail}</span>
                      </span>
                      <span className="moment-chip-action">{chip.actionLabel}</span>
                    </button>
                  ),
                )}
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
        {moment.cta && !chipCoversCta ? <div className="moment-hero-actions">{renderCta(moment.cta)}</div> : null}
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
          {moment.checklistNote ? <p className="moment-check-note">{moment.checklistNote}</p> : null}
        </section>
      ) : null}
    </>
  );
}
