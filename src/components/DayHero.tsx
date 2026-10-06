"use client";

import { useEffect, useMemo, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { dayHeroAtmosphereClass } from "@/lib/day-atmosphere";
import { buildDayHeroCopy } from "@/lib/day-hero-copy";
import { applyHolidayBuffer, isHolidayBufferOn } from "@/lib/holiday-buffer";
import { hourInTimezone } from "@/lib/meal-type";
import { withBasePath } from "@/lib/paths";
import { useTimezone } from "@/lib/use-timezone";
import { WATER_DAILY_TARGET_ML } from "@/lib/water-target";
import {
  estimateDayWorkoutBurnKcal,
  formatWorkoutBurnHint,
  type WorkoutBurnSessionLike,
} from "@/lib/workout-day-burn";

type ProgressData = {
  calories: number;
  calorieTarget: number | null;
  protein: number;
  proteinTarget: number | null;
  waterMl: number;
  waterTarget: number;
  weightKg: number | null;
};

type DayHeroProps = {
  selectedDate: string;
  today: string;
  refreshKey: number;
};

function progressFromPayload(
  selectedDate: string,
  meals: {
    totalCalories: number;
    totalProtein: number;
    target: {
      calories: number;
      protein: number;
    } | null;
  },
  water: { totalMl: number; target: number },
  weightKg?: number | null,
): ProgressData {
  const holiday = isHolidayBufferOn(selectedDate);
  const baseCal = meals.target?.calories ?? null;
  return {
    calories: meals.totalCalories,
    calorieTarget: baseCal != null ? applyHolidayBuffer(baseCal, holiday) : null,
    protein: meals.totalProtein,
    proteinTarget: meals.target?.protein ?? null,
    waterMl: water.totalMl,
    waterTarget: water.target || WATER_DAILY_TARGET_ML,
    weightKg: weightKg != null && Number.isFinite(weightKg) ? weightKg : null,
  };
}

/** C1 — wide arc under the giant %, full composition width. */
function HeroArc({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const over = pct > 105;
  return (
    <div className="day-hero-arc" aria-hidden>
      <div className="day-hero-arc__track">
        <div
          className={`day-hero-arc__fill ${over ? "day-hero-arc__fill--over" : ""}`}
          style={{ width: `${Math.min(100, clamped)}%` }}
        />
      </div>
    </div>
  );
}

function DayHeroSkeleton() {
  return (
    <section className="day-hero day-hero--scene day-hero--theater" aria-busy="true" aria-label="Сводка дня">
      <div className="day-hero-glow" aria-hidden />
      <div className="day-hero-theater-inner relative flex flex-col gap-4 px-5 py-8 md:px-8 md:py-10">
        <div className="skeleton-line !h-2 w-16" />
        <div className="skeleton-line !h-12 w-40" />
        <div className="skeleton-line !h-3 w-56 max-w-full" />
        <div className="skeleton-line !h-2.5 w-full !rounded-full" />
      </div>
    </section>
  );
}

/**
 * C1 day theater: giant % as the first signal, phrase + arc as one composition.
 */
export function DayHero({ selectedDate, today, refreshKey }: DayHeroProps) {
  const day = useOptionalRationDay();
  const timezone = useTimezone();
  const [data, setData] = useState<ProgressData | null>(null);
  const [workoutBurnKcal, setWorkoutBurnKcal] = useState(0);
  const [workoutSessionCount, setWorkoutSessionCount] = useState(0);
  const atmosphere = dayHeroAtmosphereClass(hourInTimezone(new Date(), timezone));

  useEffect(() => {
    setData(null);
    setWorkoutBurnKcal(0);
    setWorkoutSessionCount(0);
  }, [selectedDate]);

  useEffect(() => {
    if (day?.data?.date === selectedDate && day.data.meals) {
      setData(
        progressFromPayload(
          selectedDate,
          day.data.meals,
          day.data.water ?? {
            totalMl: 0,
            target: WATER_DAILY_TARGET_ML,
          },
          day.data.weightKg,
        ),
      );
      return;
    }

    if (day && day.date === selectedDate) {
      return;
    }

    void (async () => {
      try {
        const [mealsResp, waterResp, profileResp] = await Promise.all([
          fetch(withBasePath(`/api/meals?date=${selectedDate}`)),
          fetch(withBasePath(`/api/water?date=${selectedDate}`)),
          fetch(withBasePath(`/api/profile?date=${selectedDate}`)),
        ]);
        if (!mealsResp.ok) return;
        const meals = (await mealsResp.json()) as {
          totalCalories: number;
          totalProtein: number;
          target: {
            calories: number;
            protein: number;
          } | null;
        };
        const water = waterResp.ok
          ? ((await waterResp.json()) as { totalMl: number; target: number })
          : { totalMl: 0, target: WATER_DAILY_TARGET_ML };
        const profile = profileResp.ok
          ? ((await profileResp.json()) as { selectedWeightKg?: number | null })
          : null;
        setData(
          progressFromPayload(
            selectedDate,
            meals,
            water,
            profile?.selectedWeightKg ?? null,
          ),
        );
      } catch {
        // non-critical
      }
    })();
  }, [selectedDate, refreshKey, day]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/workouts?date=${selectedDate}&limit=20`));
        if (!resp.ok || cancelled) return;
        const payload = (await resp.json()) as {
          sessions?: WorkoutBurnSessionLike[];
        };
        const sessions = (payload.sessions ?? []).filter(
          (s) => Boolean(s.endedAt) || (Number(s.elapsedSec) || 0) > 0 || (Number(s.setCount) || 0) > 0,
        );
        if (cancelled) return;
        setWorkoutSessionCount(sessions.length);
        setWorkoutBurnKcal(estimateDayWorkoutBurnKcal(sessions));
      } catch {
        if (!cancelled) {
          setWorkoutSessionCount(0);
          setWorkoutBurnKcal(0);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, refreshKey]);

  const waitingForData =
    !data &&
    (Boolean(day?.loading && day.date === selectedDate) ||
      Boolean(day && day.date === selectedDate && !day.data && !day.error) ||
      !day);

  const effectiveTarget =
    data?.calorieTarget != null && data.calorieTarget > 0
      ? data.calorieTarget + Math.max(0, workoutBurnKcal)
      : data?.calorieTarget ?? null;

  const caloriePct =
    effectiveTarget && effectiveTarget > 0 ? (data!.calories / effectiveTarget) * 100 : 0;

  const streak = day?.data?.streak?.streak ?? 0;
  const loggedToday = day?.data?.streak?.loggedToday ?? (data?.calories ?? 0) > 0;
  const holiday = isHolidayBufferOn(selectedDate);
  const isToday = selectedDate === today;

  const copy = useMemo(
    () =>
      buildDayHeroCopy({
        calories: data?.calories ?? 0,
        calorieTarget: effectiveTarget,
        caloriePct,
        streak,
        loggedToday,
        isToday,
        holiday,
      }),
    [data?.calories, effectiveTarget, caloriePct, streak, loggedToday, isToday, holiday],
  );

  if (waitingForData) {
    return <DayHeroSkeleton />;
  }

  const burnHint = formatWorkoutBurnHint(workoutBurnKcal, workoutSessionCount);
  const hasTarget = effectiveTarget != null && effectiveTarget > 0;
  const pctShow = hasTarget ? Math.round(Math.min(999, Math.max(0, caloriePct))) : null;
  const remaining =
    hasTarget && data ? Math.max(0, Math.round(effectiveTarget! - data.calories)) : null;
  // Phrase without leading "N% …" — the giant number owns that signal.
  const phrase = copy.headline.replace(/^\d+%\s*[·—–-]?\s*/u, "").replace(/\.$/, "") || copy.headline;
  const over = hasTarget && caloriePct > 105;

  const metaParts = [
    data?.calorieTarget != null
      ? `${data.calories} / ${Math.round(effectiveTarget ?? data.calorieTarget)} ккал`
      : data
        ? `${data.calories} ккал`
        : null,
    data?.proteinTarget != null && data.proteinTarget > 0
      ? `белок ${Math.round(data.protein)} / ${Math.round(data.proteinTarget)} г`
      : data && data.protein > 0
        ? `белок ${Math.round(data.protein)} г`
        : null,
    burnHint,
    holiday ? "праздн. запас" : null,
  ].filter(Boolean);

  return (
    <section
      className={`day-hero day-hero--scene day-hero--theater ${atmosphere}`}
      aria-label="Сводка дня"
    >
      <div className="day-hero-glow" aria-hidden />
      <div className="day-hero-wash" aria-hidden />
      <div className="day-hero-theater-inner relative flex flex-col px-5 py-8 md:px-8 md:py-10">
        <p className="day-hero-eyebrow">{copy.eyebrow}</p>

        <div className="mt-3 flex items-end gap-3">
          {pctShow != null ? (
            <p
              className={`day-hero-giant tabular-nums ${over ? "day-hero-giant--over" : ""}`}
              aria-label={`${pctShow} процентов от цели по калориям`}
            >
              {pctShow}
              <span className="day-hero-giant__unit">%</span>
            </p>
          ) : (
            <p className="day-hero-giant day-hero-giant--muted tabular-nums" aria-label="Нет цели по калориям">
              —
            </p>
          )}
          {remaining != null && !over ? (
            <p className="day-hero-remain pb-1.5">
              ещё <span className="tabular-nums font-semibold text-[var(--foreground)]">{remaining}</span> ккал
            </p>
          ) : null}
        </div>

        <p className="day-hero-phrase mt-2">{phrase}.</p>

        {hasTarget ? <HeroArc pct={caloriePct} /> : <div className="day-hero-arc day-hero-arc--idle" aria-hidden />}

        {metaParts.length > 0 ? (
          <p className="day-hero-meta mt-3">{metaParts.join(" · ")}</p>
        ) : null}
      </div>
    </section>
  );
}
