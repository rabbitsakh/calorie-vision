"use client";

import { useState } from "react";
import { BottomComposer } from "@/components/BottomComposer";
import { ConfirmDishRow } from "@/components/ConfirmDishRow";
import { DayEventRow } from "@/components/DayEventRow";
import { MomentHeroView } from "@/components/MomentHeroCard";
import { NavIcon } from "@/components/NavIcons";
import { WorkoutLiveStage, type LiveExercise } from "@/components/workouts/WorkoutLiveStage";
import { draftFromRecognition } from "@/lib/confirm-dish-merge";
import { gymSessionEvent, weightEvent } from "@/lib/day-feed-events";
import { buildMomentHero, type MomentHeroInput } from "@/lib/moment-hero";
import { APP_NAV } from "@/lib/navigation";

const DATE = "2026-10-29";

const BASE: MomentHeroInput = {
  selectedIsToday: true,
  hour: 14,
  gymLive: false,
  gymLiveLabel: null,
  gymDoneToday: true,
  morning: null,
  logged: true,
  calories: 860,
  calorieTarget: 2100,
  protein: 72,
  proteinTarget: 120,
  waterMl: 900,
  waterTarget: 2000,
  streak: 5,
  softStep: null,
};

const MOMENTS = [
  buildMomentHero({ ...BASE, hour: 7, gymLive: true, gymLiveLabel: "Грудь · Трицепс" }),
  buildMomentHero({
    ...BASE,
    hour: 7,
    gymDoneToday: false,
    logged: false,
    morning: { eyebrow: "Что сегодня", line: "Первый приём — и день начат · Грудь", cta: { label: "В зал", href: "/workouts" } },
  }),
  buildMomentHero({ ...BASE, softStep: { label: "Воды пока мало — один стакан уже поможет", actionLabel: "Вода", action: "water" } }),
  buildMomentHero({ ...BASE, hour: 20, calories: 1850, protein: 110 }),
];

const EXERCISES: LiveExercise[] = [
  {
    id: "e1",
    name: "Жим лёжа",
    kind: "strength",
    sets: [
      { id: "s1", weightKg: 60, reps: 8, setType: "working", completed: true, rpe: null },
      { id: "s2", weightKg: 60, reps: 8, setType: "working", completed: true, rpe: null },
      { id: "s3", weightKg: 62.5, reps: 8, setType: "working", completed: false, rpe: null },
      { id: "s4", weightKg: 62.5, reps: 8, setType: "working", completed: false, rpe: null },
    ],
  },
  {
    id: "e2",
    name: "Брусья",
    kind: "strength",
    sets: [1, 2, 3].map((n) => ({
      id: `b${n}`,
      weightKg: null,
      reps: 10,
      setType: "working" as const,
      completed: false,
      rpe: null,
    })),
  },
  { id: "e3", name: "Разводка гантелей", kind: "strength", sets: [] },
];

export function HybridPreviewClient() {
  const [stage, setStage] = useState(false);
  const [kg, setKg] = useState("62.5");
  const [reps, setReps] = useState("8");
  const [dishes, setDishes] = useState(() => [
    draftFromRecognition({ dishName: "Омлет из 2 яиц", calories: 196, portionGrams: 140, confidence: 0.9, photoKind: "meal" }, "d1"),
    draftFromRecognition({ dishName: "Подушечки сухой завтрак", calories: 215, portionGrams: 50, confidence: 0.6, photoKind: "meal" }, "d2"),
    draftFromRecognition({ dishName: "Кофе с молоком", calories: 45, portionGrams: 250, confidence: 0.85, photoKind: "meal" }, "d3"),
  ]);
  const [active, setActive] = useState(-1);
  const t = (h: number, m: number) => new Date(2026, 9, 29, h, m).toISOString();

  const events = [
    weightEvent(82.4),
    gymSessionEvent({
      id: "g1",
      startedAt: t(7, 5),
      endedAt: t(7, 57),
      elapsedSec: 3120,
      muscleLabels: ["Грудь", "Трицепс"],
      setCount: 14,
      clockStatus: "finished",
    }),
  ].filter((e) => e != null);

  if (stage) {
    return (
      <WorkoutLiveStage
        elapsedLabel="23:41"
        clockStatus="running"
        exercises={EXERCISES}
        focusExerciseId="e1"
        restEndsAt={null}
        restLeft={0}
        advice={null}
        suggestedKg={62.5}
        draftKg={kg}
        draftReps={reps}
        draftKm=""
        draftTime=""
        draftSetType="working"
        draftRpe=""
        circuitRound={1}
        prToast={null}
        onDraftKg={setKg}
        onDraftReps={setReps}
        onDraftKm={() => {}}
        onDraftTime={() => {}}
        onDraftRpe={() => {}}
        onCycleSetType={() => {}}
        onBumpKg={(d) => setKg(String(Number(kg) + d))}
        onApplySuggested={() => {}}
        onCompleteCurrent={() => {}}
        onAddAndComplete={() => {}}
        onSkipRest={() => {}}
        onPrev={() => {}}
        onNext={() => {}}
        onPause={() => {}}
        onResume={() => {}}
        onFinish={() => {}}
        onExitStage={() => setStage(false)}
        onRestPause={() => {}}
        onRememberRest={() => {}}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-[var(--background)] px-3 py-4">
      <h1 className="font-display text-xl font-semibold">Гибрид · превью</h1>

      <section className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase text-[var(--muted)]">Шаг 2 · Сейчас главное</p>
        {MOMENTS.map((m, i) => (m ? <MomentHeroView key={i} moment={m} selectedDate={DATE} onAction={() => {}} /> : null))}
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase text-[var(--muted)]">Шаг 5 · Лента дня</p>
        {events.map((e) => (
          <DayEventRow key={e.key} event={e} />
        ))}
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-xs font-bold uppercase text-[var(--muted)]">Шаг 3 · Проверь и запиши</p>
        <div className="confirm-dish-list">
          {dishes.map((dish, index) => (
            <ConfirmDishRow
              key={dish.id}
              dish={dish}
              index={index}
              active={index === active}
              allergen={false}
              flag={index === 1 ? "?" : null}
              disabled={false}
              onSelect={() => setActive((v) => (v === index ? -1 : index))}
              onPortion={(value) =>
                setDishes((list) =>
                  list.map((d) => {
                    if (d.id !== dish.id) return d;
                    const base = Number(d.original.portionGrams) || 100;
                    const kcal = Math.round((d.original.calories * Number(value)) / base);
                    return { ...d, portionGrams: value, calories: String(kcal) };
                  }),
                )
              }
            />
          ))}
        </div>
      </section>

      <button type="button" className="btn btn-secondary" onClick={() => setStage(true)}>
        Шаг 1 · Открыть экран подхода
      </button>

      <div className="mobile-tab-bar mt-auto" aria-label="Шаги 4 и 6">
        <BottomComposer date={DATE} />
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1.5">
          {APP_NAV.map((item, i) => (
            <span key={item.href} className={`mobile-tab-bar__link${i === 0 ? " mobile-tab-bar__link--active" : ""}`}>
              <span className="mobile-tab-bar__icon">
                <NavIcon name={item.icon} className="h-5 w-5" />
              </span>
              <span className="truncate">{item.shortLabel}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
