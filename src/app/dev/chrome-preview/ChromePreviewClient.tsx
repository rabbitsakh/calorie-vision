"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DateNavBar } from "@/components/DateNavBar";

const TODAY = "2026-10-06";

/**
 * Visual QA for bold B1–B10 composition (no auth).
 */
export function ChromePreviewClient() {
  const [date, setDate] = useState(TODAY);
  const r = 38;
  const c = 2 * Math.PI * r;
  const pct = 62;
  const offset = c - (pct / 100) * c;

  return (
    <AppShell title="Рацион" compact date={date}>
      {/* B1 — DateNav inside day band + editorial hero */}
      <div className="ration-day-scene flex flex-col gap-0">
        <div className="ration-day-band px-1 pb-1 pt-0.5">
          <DateNavBar date={date} today={TODAY} onDateChange={setDate} />
        </div>

        <section
          className="day-hero day-hero--scene day-hero--editorial day-hero--day"
          aria-label="Сводка дня (превью)"
        >
          <div className="day-hero-glow" aria-hidden />
          <div className="day-hero-wash" aria-hidden />
          <div className="day-hero-scene-inner relative flex items-center gap-5 px-5 py-7 md:gap-6 md:px-7 md:py-8">
            <div className="min-w-0 flex-1">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent-ink)]/70">
                Сегодня
              </p>
              <p className="font-display mt-2.5 text-[1.65rem] font-semibold leading-[1.15] tracking-tight text-[var(--foreground)] sm:text-[1.9rem]">
                62% к цели.
              </p>
              <p className="mt-3 text-[0.95rem] font-medium leading-relaxed text-[var(--muted-strong)]">
                1240 / 2000 ккал · белок 68 / 120 г
              </p>
            </div>
            <div className="day-hero-ring relative h-[7.5rem] w-[7.5rem] shrink-0 sm:h-[8.25rem] sm:w-[8.25rem]">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
                <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent-soft)" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="day-hero-ring-label absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1.5">
                <span className="font-display text-[1.55rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--accent-ink)] sm:text-[1.7rem]">
                  62%
                </span>
                <span className="text-[0.62rem] font-semibold uppercase leading-none tracking-[0.14em] text-[var(--accent-ink)]/55">
                  ккал
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* B3 — editorial meal feed */}
        <div className="ration-meal-feed px-0.5 pt-3">
          <div className="meal-section-header flex items-center gap-2 pt-1">
            <span className="h-3.5 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden />
            <h3 className="font-display text-[0.85rem] font-semibold tracking-tight text-[var(--foreground)]">
              Завтрак <span className="ml-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">· 1</span>
            </h3>
          </div>
          <article className="meal-card">
            <div className="meal-card-body flex items-center">
              <div className="min-w-0 flex-1">
                <p className="meal-card-title">Овсянка с ягодами</p>
                <p className="meal-card-meta">320 ккал</p>
              </div>
              <span className="meal-card-kcal text-[var(--accent-ink)]">320</span>
            </div>
          </article>
          <div className="meal-section-header flex items-center gap-2 pt-1">
            <span className="h-3.5 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden />
            <h3 className="font-display text-[0.85rem] font-semibold tracking-tight text-[var(--foreground)]">
              Обед <span className="ml-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">· 1</span>
            </h3>
          </div>
          <article className="meal-card">
            <div className="meal-card-body flex items-center">
              <div className="min-w-0 flex-1">
                <p className="meal-card-title">Куриный салат</p>
                <p className="meal-card-meta">480 ккал</p>
              </div>
              <span className="meal-card-kcal text-[var(--accent-ink)]">480</span>
            </div>
          </article>
        </div>
      </div>

      {/* B6 — gym live */}
      <div className="gym-day mt-6">
        <section className="day-hero day-hero--scene day-hero--day" aria-label="Зал сегодня (превью)">
          <div className="day-hero-glow" aria-hidden />
          <div className="relative flex items-center gap-4 px-4 py-5 md:px-6 md:py-6">
            <div className="min-w-0 flex-1">
              <p className="gym-live-pulse text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--accent-ink)]/70">
                Сейчас · вт
              </p>
              <p className="font-display mt-2 text-[1.25rem] font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-[1.45rem]">
                Верх тела · в зале
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--muted-strong)]">
                24:10 · 3 упр. · 4 820 кг·повт
              </p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-[var(--radius-control)] bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-white shadow-[0_6px_18px_rgba(13,115,119,0.3)]"
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
          <div className="gym-today-row">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--foreground)]">Тяга блока</p>
              <p className="text-xs text-[var(--muted)]">3×10 · 45 кг</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-[var(--muted)]">0/3</span>
          </div>
        </div>
      </div>

      {/* B4 — stats editorial */}
      <div className="stats-page-scene mt-6">
        <section className="day-hero day-hero--scene stats-insight-scene" aria-label="Статистика (превью)">
          <div className="day-hero-glow" aria-hidden />
          <div className="relative px-4 py-5 md:px-6 md:py-6">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-[var(--accent-ink)]/70">
              Главный вывод
            </p>
            <p className="stats-insight-body mt-2 sm:text-[1.3rem]">
              Среднее 1 840 ккал — близко к цели.
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--muted-strong)]">7 дней · цель 2 000</p>
          </div>
        </section>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="stats-stat-tile">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">ккал</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">1840</p>
          </div>
          <div className="stats-stat-tile stats-stat-tile--accent">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">дни</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">6/7</p>
          </div>
          <div className="stats-stat-tile">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">вес</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--foreground)]">−0.3</p>
          </div>
        </div>
      </div>

      {/* B5 — plan mural */}
      <div className="plan-week mt-6">
        <div className="plan-week__hero px-4 py-5 md:px-6">
          <p className="font-display text-xl font-semibold tracking-tight text-[var(--foreground)] md:text-2xl">
            Неделя
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">Цель vs факт · норма 2000 ккал</p>
          <div className="mt-3 grid grid-cols-7 gap-1">
            {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d, i) => (
              <div
                key={d}
                className={`rounded-lg px-0.5 py-2 text-center text-[0.65rem] font-semibold ${
                  i === 1 ? "bg-[var(--accent)] text-white" : "bg-white/70 text-[var(--muted-strong)]"
                }`}
              >
                {d}
                <div className="mt-1 text-sm tabular-nums">{[92, 62, 0, 0, 0, 0, 0][i]}%</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* B10 — empty stage */}
      <div className="ration-empty-day mt-6 flex flex-col items-center gap-3 px-5 py-12 text-center">
        <p className="font-display text-[1.35rem] font-semibold tracking-tight text-[var(--foreground)]">
          День ещё пустой
        </p>
        <p className="max-w-xs text-[0.95rem] text-[var(--muted-strong)]">
          Добавьте первый приём — кольцо оживёт.
        </p>
        <button type="button" className="btn btn-primary mt-1 min-h-12 px-7 text-base">
          Добавить через «+»
        </button>
      </div>
    </AppShell>
  );
}
