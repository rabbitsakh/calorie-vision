"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DateNavBar } from "@/components/DateNavBar";

const TODAY = "2026-10-06";

/**
 * Visual QA for radical C1–C10 composition (no auth).
 */
export function ChromePreviewClient() {
  const [date, setDate] = useState(TODAY);

  return (
    <AppShell title="Рацион" compact date={date}>
      <div className="ration-day-scene flex flex-col gap-0">
        <div className="ration-day-band">
          <DateNavBar date={date} today={TODAY} onDateChange={setDate} />
        </div>

        <section
          className="day-hero day-hero--scene day-hero--theater day-hero--day"
          aria-label="Сводка дня (превью)"
        >
          <div className="day-hero-glow" aria-hidden />
          <div className="day-hero-theater-inner relative flex flex-col">
            <p className="day-hero-eyebrow">Сегодня</p>
            <div className="mt-3 flex items-end gap-3">
              <p className="day-hero-giant tabular-nums">
                62<span className="day-hero-giant__unit">%</span>
              </p>
              <p className="day-hero-remain pb-1.5">
                ещё <span className="tabular-nums font-semibold text-[var(--foreground)]">760</span> ккал
              </p>
            </div>
            <p className="day-hero-phrase mt-2">к цели</p>
            <div className="day-hero-arc" aria-hidden>
              <div className="day-hero-arc__track">
                <div className="day-hero-arc__fill" style={{ width: "62%" }} />
              </div>
            </div>
            <p className="day-hero-meta mt-3">1240 / 2000 ккал · белок 68 / 120 г</p>
          </div>
        </section>

        <div className="ration-diary-toolbar mt-3 flex items-end justify-between gap-2">
          <h2 className="font-display text-[0.95rem] font-semibold tracking-tight text-[var(--foreground)]">
            Дневник
          </h2>
          <p className="text-xs font-medium text-[var(--muted-strong)]">Клетч. 2.3 г · Сахар 18.5 г</p>
        </div>

        <div className="ration-meal-feed">
          <div className="meal-section-header flex items-center gap-2 pt-1">
            <span className="h-3.5 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
            <h3 className="font-display text-[1.05rem] font-semibold tracking-tight text-[var(--foreground)]">
              Завтрак <span className="ml-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">· 1</span>
            </h3>
          </div>
          <article className="meal-card">
            <div className="meal-card-body flex items-center gap-3">
              <div className="meal-card-thumb shrink-0 rounded-[0.85rem] bg-[var(--accent-soft)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="meal-card-title">Овсянка с ягодами</p>
                <p className="meal-card-meta">320 ккал</p>
              </div>
              <span className="meal-card-kcal text-[var(--accent-ink)]">320</span>
            </div>
          </article>
          <div className="meal-section-header flex items-center gap-2 pt-1">
            <span className="h-3.5 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden />
            <h3 className="font-display text-[1.05rem] font-semibold tracking-tight text-[var(--foreground)]">
              Обед <span className="ml-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">· 1</span>
            </h3>
          </div>
          <article className="meal-card">
            <div className="meal-card-body flex items-center gap-3">
              <div className="meal-card-thumb shrink-0 rounded-[0.85rem] bg-[var(--accent-soft)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="meal-card-title">Куриный салат</p>
                <p className="meal-card-meta">480 ккал</p>
              </div>
              <span className="meal-card-kcal text-[var(--accent-ink)]">480</span>
            </div>
          </article>
        </div>
      </div>

      <div className="gym-day mt-6">
        <section className="day-hero day-hero--scene day-hero--day day-hero--live" aria-label="Зал сегодня (превью)">
          <div className="day-hero-glow" aria-hidden />
          <div className="gym-console-active relative flex items-center gap-4 px-5 py-7 md:px-7 md:py-8">
            <div className="min-w-0 flex-1">
              <p className="gym-live-pulse text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-teal-100/90">
                Сейчас · вт
              </p>
              <p className="font-display mt-2.5 text-[1.45rem] font-semibold leading-snug tracking-tight text-white sm:text-[1.7rem]">
                Верх тела · в зале
              </p>
              <p className="mt-2.5 text-[0.95rem] font-medium text-teal-50/85">
                24:10 · 3 упр. · 4 820 кг·повт
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-[1rem] bg-white px-5 py-3 text-sm font-bold text-[var(--accent-ink)] shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
            >
              В зал
            </button>
          </div>
        </section>
        <div className="gym-today-feed px-1">
          <div className="gym-today-row">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--foreground)]">Жим лёжа</p>
              <p className="text-xs text-[var(--muted)]">4×8 · 60 кг</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-[var(--accent-ink)]">2/4</span>
          </div>
        </div>
      </div>

      <div className="stats-page-scene mt-6">
        <section className="day-hero day-hero--scene stats-insight-scene" aria-label="Статистика (превью)">
          <div className="day-hero-glow" aria-hidden />
          <div className="relative px-5 py-7 md:px-7 md:py-8">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent-ink)]/70">
              Главный вывод
            </p>
            <p className="stats-insight-body mt-3 text-[1.45rem] sm:text-[1.7rem]">
              Среднее 1 840 ккал — близко к цели.
            </p>
            <p className="mt-2.5 text-[0.95rem] font-medium text-[var(--muted-strong)]">7 дней · цель 2 000</p>
          </div>
        </section>
      </div>

      <div className="plan-week mt-6">
        <div className="plan-week__hero px-5 py-6 md:px-7">
          <p className="font-display text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Неделя
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">Цель vs факт · норма 2000 ккал</p>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d, i) => (
              <div
                key={d}
                className={`rounded-xl px-0.5 py-2.5 text-center text-[0.65rem] font-bold ${
                  i === 1 ? "bg-[var(--accent)] text-white shadow-[0_6px_16px_rgba(13,115,119,0.28)]" : "bg-white/75 text-[var(--muted-strong)]"
                }`}
              >
                {d}
                <div className="mt-1 font-display text-sm tabular-nums">{[92, 62, 0, 0, 0, 0, 0][i]}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ration-empty-day mt-6 flex flex-col items-center gap-4 px-6 py-14 text-center">
        <p className="font-display text-[1.55rem] font-semibold tracking-tight text-[var(--foreground)]">
          День ещё пустой
        </p>
        <p className="max-w-sm text-base text-[var(--muted-strong)]">
          Добавьте первый приём — кольцо оживёт.
        </p>
        <button type="button" className="btn btn-primary mt-2 min-h-12 px-8 text-base">
          Добавить через «+»
        </button>
      </div>
    </AppShell>
  );
}
