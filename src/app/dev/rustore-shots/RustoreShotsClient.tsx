"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomComposer } from "@/components/BottomComposer";
import { BrandMark } from "@/components/BrandMark";
import { ConfirmDishRow } from "@/components/ConfirmDishRow";
import { DayEventRow } from "@/components/DayEventRow";
import { FoodAddModePicker } from "@/components/FoodAddModePicker";
import { MomentHeroView } from "@/components/MomentHeroCard";
import { NavIcon } from "@/components/NavIcons";
import { WorkoutLiveStage, type LiveExercise } from "@/components/workouts/WorkoutLiveStage";
import { draftFromRecognition } from "@/lib/confirm-dish-merge";
import { gymSessionEvent, weightEvent } from "@/lib/day-feed-events";
import { setMetrikaConsent } from "@/lib/metrika-consent";
import { buildMomentHero } from "@/lib/moment-hero";
import { APP_NAV } from "@/lib/navigation";

const DATE = "2026-10-31";

const SHOT_IDS = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
] as const;

type ShotId = (typeof SHOT_IDS)[number];

function isShotId(value: string): value is ShotId {
  return (SHOT_IDS as readonly string[]).includes(value);
}

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
];

function PhoneChrome({
  title,
  activeHref,
  showComposer,
  children,
  overlay,
  banner,
}: {
  title: string;
  activeHref: string;
  showComposer?: boolean;
  children: React.ReactNode;
  overlay?: React.ReactNode;
  banner?: React.ReactNode;
}) {
  return (
    <div
      data-rustore-shot
      className="relative mx-auto flex h-[1920px] w-[1080px] flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]"
      style={{ fontSize: "1.35rem" }}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <BrandMark size={52} />
          <div className="min-w-0">
            <p className="font-display text-[1.35rem] font-semibold leading-tight tracking-tight">
              Calorie Vision
            </p>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
              {title}
            </p>
          </div>
        </div>
        <span
          className="h-12 w-12 shrink-0 rounded-full bg-[var(--accent-soft)] ring-2 ring-[var(--border-quiet)]"
          aria-hidden
        />
      </header>

      {banner}

      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-2">{children}</div>

      <nav className="mobile-tab-bar shrink-0 !relative" aria-label="Основные разделы">
        {showComposer ? <BottomComposer date={DATE} /> : null}
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1.5">
          {APP_NAV.map((item) => {
            const active = item.href === activeHref;
            return (
              <span
                key={item.href}
                className={`mobile-tab-bar__link${active ? " mobile-tab-bar__link--active" : ""}`}
              >
                <span className="mobile-tab-bar__icon">
                  <NavIcon name={item.icon} className="h-5 w-5" />
                </span>
                <span className="truncate">{item.shortLabel}</span>
              </span>
            );
          })}
        </div>
      </nav>

      {overlay}
    </div>
  );
}

function MealFeed() {
  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {[
        { name: "Омлет из 2 яиц", kcal: 196, g: 140, time: "07:42", slot: "Завтр." },
        { name: "Греческий с курицей", kcal: 420, g: 320, time: "13:10", slot: "Обед" },
        { name: "Творог 5% + ягоды", kcal: 210, g: 180, time: "16:05", slot: "Перек." },
      ].map((row) => (
        <article
          key={row.name}
          className="flex items-center gap-3 rounded-[1rem] border border-[var(--border-quiet)] bg-[var(--surface)] px-3 py-2.5"
        >
          <div
            className="h-14 w-14 shrink-0 rounded-[0.85rem] bg-[var(--accent-soft)]"
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">{row.name}</p>
            <p className="text-[0.85rem] text-[var(--muted-strong)]">
              {row.kcal} ккал · {row.g} г
            </p>
            <p className="text-[0.75rem] font-semibold text-[var(--muted)]">
              {row.time} {row.slot}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ShotRation() {
  const moment = buildMomentHero({
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
    fat: 48,
    fatTarget: 70,
    carbs: 90,
    carbsTarget: 220,
    waterMl: 900,
    waterTarget: 2000,
    streak: 12,
    softStep: { label: "Воды пока мало — один стакан уже поможет", actionLabel: "Вода", action: "water" },
  });
  const events = [
    weightEvent(82.4),
    gymSessionEvent({
      id: "g1",
      startedAt: new Date(2026, 9, 31, 7, 5).toISOString(),
      endedAt: new Date(2026, 9, 31, 7, 57).toISOString(),
      elapsedSec: 3120,
      muscleLabels: ["Грудь", "Трицепс"],
      setCount: 14,
      clockStatus: "finished",
    }),
  ].filter((e) => e != null);

  return (
    <PhoneChrome title="Сегодня" activeHref="/ration" showComposer>
      <p className="mb-2 text-[0.95rem] font-semibold text-[var(--muted-strong)]">
        Сегодня · 31 октября
      </p>
      {moment ? (
        <MomentHeroView
          moment={moment}
          selectedDate={DATE}
          onAction={() => {}}
          mealIdeas={[
            { name: "Индейка с киноа", calories: 380 },
            { name: "Салат с тунцом", calories: 290 },
            { name: "Творог + банан", calories: 240 },
          ]}
          mealIdeasLabel="Идеи на обед"
        />
      ) : null}
      <div className="mt-3 flex flex-col gap-2">
        {events.map((e) => (
          <DayEventRow key={e.key} event={e} />
        ))}
      </div>
      <MealFeed />
    </PhoneChrome>
  );
}

function ShotAddModes() {
  return (
    <PhoneChrome
      title="Сегодня"
      activeHref="/ration"
      showComposer
      overlay={
        <FoodAddModePicker
          selectedDate={DATE}
          mealType="SNACK"
          onSelect={() => {}}
          onClose={() => {}}
          onQuickLogged={() => {}}
        />
      }
    >
      <div className="opacity-40">
        <p className="mb-2 font-semibold text-[var(--muted-strong)]">Сегодня · 31 октября</p>
        <MealFeed />
      </div>
    </PhoneChrome>
  );
}

function ShotStats() {
  const days = [
    { d: "Пн", v: 72 },
    { d: "Вт", v: 88 },
    { d: "Ср", v: 65 },
    { d: "Чт", v: 91 },
    { d: "Пт", v: 78 },
    { d: "Сб", v: 84 },
    { d: "Вс", v: 70 },
  ];
  return (
    <PhoneChrome title="Прогресс" activeHref="/stats">
      <p className="mb-3 font-display text-[1.6rem] font-semibold tracking-tight">Неделя</p>
      <section className="rounded-[1.25rem] border border-[var(--border-quiet)] bg-[var(--surface)] p-4">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
          Калории к цели
        </p>
        <p className="mt-1 font-display text-[2.4rem] font-semibold tabular-nums">78%</p>
        <p className="text-[0.95rem] text-[var(--muted-strong)]">в среднем за 7 дней</p>
        <div className="mt-4 flex h-40 items-end justify-between gap-2">
          {days.map((day) => (
            <div key={day.d} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-lg bg-[var(--accent)]"
                style={{ height: `${day.v}%` }}
              />
              <span className="text-[0.75rem] font-semibold text-[var(--muted)]">{day.d}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[
          { label: "Белок", value: "112 / 120 г" },
          { label: "Серия", value: "12 дней" },
          { label: "Зал", value: "3 / 4 трен." },
          { label: "Вес", value: "82.4 → 81.9" },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-[1.1rem] border border-[var(--border-quiet)] bg-[var(--surface-mist)] px-3.5 py-3"
          >
            <p className="text-[0.75rem] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
              {card.label}
            </p>
            <p className="mt-1 text-[1.15rem] font-semibold">{card.value}</p>
          </div>
        ))}
      </div>
    </PhoneChrome>
  );
}

function ShotGym() {
  return (
    <PhoneChrome title="Зал" activeHref="/workouts">
      <p className="mb-3 text-[0.95rem] font-semibold text-[var(--muted-strong)]">
        Сегодня · 31 октября
      </p>
      <section className="rounded-[1.4rem] bg-gradient-to-br from-[var(--accent-soft)] to-[var(--surface)] p-5">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
          План · пт
        </p>
        <p className="mt-2 font-display text-[2rem] font-semibold leading-tight">Грудь · Трицепс</p>
        <p className="mt-2 text-[1rem] text-[var(--muted-strong)]">
          6 упражнений · цель жима 62.5 кг (+2.5 к прошлой)
        </p>
        <button
          type="button"
          className="mt-5 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-[1rem] bg-[var(--accent)] px-4 text-[1.1rem] font-semibold text-white"
        >
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 4v16l13-8z" />
          </svg>
          Начать тренировку
        </button>
      </section>
      <div className="mt-4 rounded-[1.2rem] border border-[var(--border-quiet)] p-4">
        <p className="font-semibold">Последняя · пн</p>
        <p className="mt-1 text-[0.95rem] text-[var(--muted-strong)]">
          52 мин · 14 подходов · нагрузка +8%
        </p>
      </div>
    </PhoneChrome>
  );
}

function ShotGymLive() {
  const [kg, setKg] = useState("62.5");
  const [reps, setReps] = useState("8");
  return (
    <div data-rustore-shot className="h-[1920px] w-[1080px] overflow-hidden bg-[var(--background)]">
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
        onExitStage={() => {}}
        onRestPause={() => {}}
        onRememberRest={() => {}}
      />
    </div>
  );
}

function ShotGymDone() {
  return (
    <PhoneChrome title="Зал" activeHref="/workouts">
      <section className="rounded-[1.4rem] bg-[var(--accent-ink)] px-5 py-6 text-white">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.16em] text-white/70">
          Тренировка готова
        </p>
        <p className="mt-2 font-display text-[2.1rem] font-semibold leading-tight">Грудь · Трицепс</p>
        <p className="mt-3 text-[1.15rem] text-white/85">52 мин · 14 подходов · ~285 ккал</p>
        <p className="mt-2 text-[1.05rem] font-semibold text-emerald-200">+8% к прошлой нагрузке</p>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {[
          { label: "Жим лёжа", value: "62.5 × 8" },
          { label: "Брусья", value: "3×10" },
          { label: "Разводка", value: "14 × 12" },
          { label: "Франц. жим", value: "25 × 10" },
        ].map((row) => (
          <div
            key={row.label}
            className="rounded-[1.1rem] border border-[var(--border-quiet)] bg-[var(--surface)] px-3.5 py-3"
          >
            <p className="text-[0.8rem] text-[var(--muted)]">{row.label}</p>
            <p className="mt-1 font-semibold">{row.value}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-5 min-h-14 w-full rounded-[1rem] bg-[var(--accent)] text-[1.1rem] font-semibold text-white"
      >
        Закрыть день · открыть сундук
      </button>
    </PhoneChrome>
  );
}

function ShotGymPlan() {
  const week = [
    { day: "Пн", label: "Грудь · Триц.", done: true },
    { day: "Вт", label: "Отдых", done: false },
    { day: "Ср", label: "Спина · Биц.", done: false },
    { day: "Чт", label: "Отдых", done: false },
    { day: "Пт", label: "Ноги", done: false },
    { day: "Сб", label: "Плечи", done: false },
    { day: "Вс", label: "Отдых", done: false },
  ];
  return (
    <PhoneChrome title="Зал" activeHref="/workouts">
      <p className="mb-3 font-display text-[1.6rem] font-semibold">План на неделю</p>
      <div className="flex flex-col gap-2.5">
        {week.map((row) => (
          <div
            key={row.day}
            className={`flex items-center justify-between rounded-[1.1rem] border px-4 py-3.5 ${
              row.done
                ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                : "border-[var(--border-quiet)] bg-[var(--surface)]"
            }`}
          >
            <div>
              <p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                {row.day}
              </p>
              <p className="font-semibold">{row.label}</p>
            </div>
            <span className="text-[0.9rem] font-semibold text-[var(--muted-strong)]">
              {row.done ? "✓" : "→"}
            </span>
          </div>
        ))}
      </div>
    </PhoneChrome>
  );
}

function ShotProfile() {
  return (
    <PhoneChrome title="Я" activeHref="/profile">
      <div className="flex items-center gap-4">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-soft)] text-2xl font-bold text-[var(--accent-ink)]">
          А
        </span>
        <div>
          <p className="font-display text-[1.5rem] font-semibold">Алексей</p>
          <p className="text-[0.95rem] text-[var(--muted-strong)]">Цель: −0.4 кг / нед.</p>
        </div>
      </div>
      <section className="mt-5 rounded-[1.25rem] border border-[var(--border-quiet)] bg-[var(--surface)] p-4">
        <p className="text-[0.75rem] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
          Норма дня
        </p>
        <p className="mt-2 font-display text-[2.2rem] font-semibold tabular-nums">2100 ккал</p>
        <p className="mt-1 text-[0.95rem] text-[var(--muted-strong)]">Б 120 · Ж 70 · У 220</p>
      </section>
      <div className="mt-3 flex flex-col gap-2">
        {["Цели и темп", "Уведомления", "Экспорт дневника", "Аккаунт"].map((label) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-[1.1rem] border border-[var(--border-quiet)] bg-[var(--surface)] px-4 py-3.5"
          >
            <span className="font-semibold">{label}</span>
            <span className="text-[var(--muted)]">›</span>
          </div>
        ))}
      </div>
    </PhoneChrome>
  );
}

function ShotProfileMore() {
  return (
    <PhoneChrome title="Я" activeHref="/profile">
      <p className="mb-3 font-display text-[1.5rem] font-semibold">Ещё настройки</p>
      {[
        { t: "Нутриенты", d: "Клетчатка, сахар, микро" },
        { t: "Вес", d: "График и цель" },
        { t: "Зал", d: "Шаблоны, единицы, отдых" },
        { t: "Экспорт", d: "CSV / PDF за период" },
        { t: "Тихие часы", d: "Без пушей ночью" },
      ].map((row) => (
        <div
          key={row.t}
          className="mb-2.5 rounded-[1.1rem] border border-[var(--border-quiet)] bg-[var(--surface)] px-4 py-3.5"
        >
          <p className="font-semibold">{row.t}</p>
          <p className="mt-0.5 text-[0.9rem] text-[var(--muted-strong)]">{row.d}</p>
        </div>
      ))}
    </PhoneChrome>
  );
}

function ShotAssistant() {
  const dishes = useMemo(
    () => [
      draftFromRecognition(
        { dishName: "Куриная грудка", calories: 165, portionGrams: 120, confidence: 0.92, photoKind: "meal" },
        "d1",
      ),
      draftFromRecognition(
        { dishName: "Рис отварной", calories: 180, portionGrams: 150, confidence: 0.8, photoKind: "meal" },
        "d2",
      ),
    ],
    [],
  );
  const [active, setActive] = useState(0);
  return (
    <PhoneChrome title="AI" activeHref="/ration">
      <div className="flex flex-col gap-3">
        <div className="self-start rounded-[1.1rem] bg-[var(--surface-mist)] px-4 py-3">
          <p className="text-[0.95rem]">Запиши обед: грудка и рис</p>
        </div>
        <div className="self-end max-w-[90%] rounded-[1.1rem] bg-[var(--accent)] px-4 py-3 text-white">
          <p className="text-[0.95rem] font-semibold">Нашёл 2 блюда · 345 ккал</p>
          <p className="mt-1 text-[0.85rem] text-white/85">Проверь граммы и запиши</p>
        </div>
        <div className="confirm-dish-list mt-1">
          {dishes.map((dish, index) => (
            <ConfirmDishRow
              key={dish.id}
              dish={dish}
              index={index}
              active={index === active}
              allergen={false}
              flag={null}
              disabled={false}
              onSelect={() => setActive((v) => (v === index ? -1 : index))}
              onPortion={() => {}}
            />
          ))}
        </div>
        <button
          type="button"
          className="min-h-14 rounded-[1rem] bg-[var(--accent)] text-[1.05rem] font-semibold text-white"
        >
          Записать в обед · 345 ккал
        </button>
      </div>
    </PhoneChrome>
  );
}

function ShotOffline() {
  const rows = [
    {
      cat: "Еда",
      catClass: "bg-emerald-100 text-emerald-900",
      label: "Овсянка с бананом",
      detail: "320 ккал · на устройстве",
      status: "Ждёт сеть",
      statusClass: "bg-amber-100 text-amber-900",
    },
    {
      cat: "Еда",
      catClass: "bg-emerald-100 text-emerald-900",
      label: "Кофе латте",
      detail: "120 ккал · на устройстве",
      status: "На устройстве",
      statusClass: "bg-sky-100 text-sky-900",
    },
    {
      cat: "Вода",
      catClass: "bg-cyan-100 text-cyan-900",
      label: "+250 мл",
      detail: "Сегодня",
      status: "Ждёт сеть",
      statusClass: "bg-amber-100 text-amber-900",
    },
    {
      cat: "Вес",
      catClass: "bg-violet-100 text-violet-900",
      label: "82.1 кг",
      detail: "Расходится с сервером",
      status: "Конфликт",
      statusClass: "bg-rose-100 text-rose-900",
    },
  ];

  return (
    <PhoneChrome
      title="Сегодня"
      activeHref="/ration"
      showComposer
      banner={
        <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-[1rem] bg-[var(--accent-ink)] px-4 py-3 text-white">
          <p className="text-[0.95rem] font-semibold">Ждёт сеть · 4</p>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[0.8rem] font-semibold">
            Очередь
          </span>
        </div>
      }
      overlay={
        <div className="absolute inset-0 z-50 flex flex-col justify-end bg-black/40">
          <div className="offline-queue-sheet max-h-[72%] overflow-hidden rounded-t-2xl bg-[var(--surface)] px-4 pb-6 pt-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="confirm-family-skim !mb-0.5">Очередь офлайн</p>
                <p className="text-xs text-[var(--muted)]">4 на устройстве — можно отменить до отправки</p>
              </div>
              <span className="confirm-family-secondary !min-h-8 !px-2.5 !text-[11px]">Закрыть</span>
            </div>
            <ul className="space-y-2">
              {rows.map((row) => (
                <li key={row.label} className="offline-queue-row rounded-[1rem] border border-[var(--border-quiet)] bg-[var(--surface-mist)] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${row.catClass}`}>
                      {row.cat}
                    </span>
                    <p className="truncate text-sm font-semibold">{row.label}</p>
                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${row.statusClass}`}>
                      {row.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--muted-strong)]">{row.detail}</p>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 min-h-12 w-full rounded-[1rem] bg-[var(--accent)] text-sm font-semibold text-white"
            >
              Отправить всё
            </button>
          </div>
        </div>
      }
    >
      <div className="opacity-35">
        <MealFeed />
      </div>
    </PhoneChrome>
  );
}

function ShotNewWorkout() {
  return (
    <PhoneChrome title="Зал" activeHref="/workouts">
      <p className="mb-3 font-display text-[1.6rem] font-semibold">Новая тренировка</p>
      <p className="mb-3 text-[0.95rem] text-[var(--muted-strong)]">Группы мышц и прогрессия</p>
      <div className="flex flex-wrap gap-2">
        {["Грудь", "Спина", "Ноги", "Плечи", "Руки", "Кор"].map((m, i) => (
          <span
            key={m}
            className={`rounded-full px-4 py-2 text-[0.95rem] font-semibold ${
              i < 2
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--surface-mist)] text-[var(--muted-strong)] ring-1 ring-[var(--border-quiet)]"
            }`}
          >
            {m}
          </span>
        ))}
      </div>
      <div className="mt-5 rounded-[1.2rem] border border-[var(--border-quiet)] bg-[var(--surface)] p-4">
        <p className="font-semibold">Прогрессия</p>
        <p className="mt-1 text-[0.95rem] text-[var(--muted-strong)]">
          +2.5 кг к рабочему весу, если прошлый подход закрыт чисто
        </p>
      </div>
      <button
        type="button"
        className="mt-5 min-h-14 w-full rounded-[1rem] bg-[var(--accent)] text-[1.1rem] font-semibold text-white"
      >
        Собрать и начать
      </button>
    </PhoneChrome>
  );
}

export function RustoreShotsClient({ shot }: { shot: string }) {
  const id = isShotId(shot) ? shot : "01";

  useEffect(() => {
    document.documentElement.classList.add("rustore-shot-root");
    setMetrikaConsent("declined");
    return () => document.documentElement.classList.remove("rustore-shot-root");
  }, []);

  return (
    <div className="flex min-h-screen items-start justify-center bg-[#111]">
      {id === "01" ? <ShotRation /> : null}
      {id === "02" ? <ShotAddModes /> : null}
      {id === "03" ? <ShotStats /> : null}
      {id === "04" ? <ShotGym /> : null}
      {id === "05" ? <ShotNewWorkout /> : null}
      {id === "06" ? <ShotGymDone /> : null}
      {id === "07" ? <ShotGymPlan /> : null}
      {id === "08" ? <ShotProfile /> : null}
      {id === "09" ? <ShotProfileMore /> : null}
      {id === "10" ? <ShotAssistant /> : null}
      {id === "11" ? <ShotOffline /> : null}
    </div>
  );
}
