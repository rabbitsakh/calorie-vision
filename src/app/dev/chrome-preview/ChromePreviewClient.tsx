"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DateNavBar } from "@/components/DateNavBar";

const TODAY = "2026-10-06";

/**
 * Visual QA for warm chrome + DayHero atmosphere (no auth).
 */
export function ChromePreviewClient() {
  const [date, setDate] = useState(TODAY);
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = 62;
  const offset = c - (pct / 100) * c;

  return (
    <AppShell title="Рацион" description="Превью warm chrome" compact date={date}>
      <DateNavBar date={date} today={TODAY} onDateChange={setDate} />
      <div className="ration-day-scene">
        <section className="day-hero day-hero--scene day-hero--day" aria-label="Сводка дня (превью)">
          <div className="day-hero-glow" aria-hidden />
          <div className="day-hero-scene-inner relative flex items-center gap-4 px-4 py-5 md:gap-5 md:px-6 md:py-6">
            <div className="min-w-0 flex-1">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--accent-ink)]/75">
                Сегодня
              </p>
              <p className="font-display mt-2 text-[1.4rem] font-semibold leading-snug tracking-tight text-[var(--foreground)] sm:text-[1.6rem]">
                62% к цели.
              </p>
              <p className="mt-2.5 text-sm font-medium leading-relaxed text-[var(--muted-strong)]">
                1240 / 2000 ккал · белок 68 / 120 г
              </p>
            </div>
            <div className="day-hero-ring relative h-[6.25rem] w-[6.25rem] shrink-0 sm:h-[6.75rem] sm:w-[6.75rem]">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden>
                <circle cx="50" cy="50" r={r} fill="none" stroke="var(--accent-soft)" strokeWidth="9" />
                <circle
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="9"
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={offset}
                />
              </svg>
              <div className="day-hero-ring-label absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-1.5">
                <span className="text-[1.25rem] font-bold leading-none tracking-tight tabular-nums text-[var(--accent-ink)] sm:text-[1.35rem]">
                  62%
                </span>
                <span className="text-[0.6rem] font-semibold uppercase leading-none tracking-wide text-[var(--accent-ink)]/55">
                  ккал
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="ration-meal-feed mt-3">
          <article className="meal-card">
            <div className="meal-card-body items-center">
              <div className="min-w-0 flex-1">
                <p className="meal-card-title">Овсянка с ягодами</p>
                <p className="meal-card-meta">Завтрак · 320 ккал</p>
              </div>
              <span className="meal-card-kcal text-[var(--accent-ink)]">320</span>
            </div>
          </article>
          <article className="meal-card">
            <div className="meal-card-body items-center">
              <div className="min-w-0 flex-1">
                <p className="meal-card-title">Куриный салат</p>
                <p className="meal-card-meta">Обед · 480 ккал</p>
              </div>
              <span className="meal-card-kcal text-[var(--accent-ink)]">480</span>
            </div>
          </article>
        </div>

        <section
          className="mt-3 overflow-hidden rounded-[var(--radius-lg)] border border-[rgba(2,132,199,0.14)] bg-gradient-to-br from-white to-[var(--accent-water-soft)]/55 px-3.5 py-3 shadow-[var(--shadow-card)]"
          aria-label="Вода (превью)"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              Вода <span className="font-medium text-[var(--muted-strong)]">900 / 2000 мл</span>
            </p>
            <span className="rounded-[var(--radius-sm)] bg-[var(--accent-water-soft)] px-2 py-1 text-xs font-bold tabular-nums text-sky-900">
              45%
            </span>
          </div>
        </section>
      </div>

      <div className="gym-day mt-6">
        <section className="day-hero day-hero--scene day-hero--day" aria-label="Зал сегодня (превью)">
          <div className="day-hero-glow" aria-hidden />
          <div className="day-hero-scene-inner relative px-4 py-4 md:px-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--accent-ink)]/75">
              Зал
            </p>
            <p className="font-display mt-1.5 text-[1.2rem] font-semibold tracking-tight text-[var(--foreground)]">
              Сегодня · верх тела
            </p>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">3 упражнения · шаблон A</p>
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
        <section className="mt-2 rounded-2xl border border-[rgba(13,115,119,0.14)] bg-white p-3 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            Нагрузка, кг·повт
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--foreground)]">4 820</p>
        </section>
      </div>

      <div className="stats-page-scene mt-6">
        <section className="day-hero day-hero--scene stats-insight-scene" aria-label="Статистика (превью)">
          <div className="day-hero-glow" aria-hidden />
          <div className="day-hero-scene-inner relative px-4 py-4 md:px-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-[var(--accent-ink)]/75">
              Статистика
            </p>
            <p className="font-display mt-1.5 text-[1.2rem] font-semibold tracking-tight text-[var(--foreground)]">
              Среднее 1 840 ккал — близко к цели.
            </p>
            <p className="mt-1 text-sm text-[var(--muted-strong)]">7 дней · цель 2 000</p>
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

      <div className="profile-settings mt-6">
        <section className="profile-settings__item">
          <div className="profile-settings__row">
            <div className="min-w-0">
              <p className="font-semibold text-[var(--foreground)]">Аккаунт</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">Имя, email, аватар</p>
            </div>
            <span className="shrink-0 text-[var(--muted)]" aria-hidden>
              ▾
            </span>
          </div>
        </section>
        <section className="profile-settings__item">
          <div className="profile-settings__row">
            <div className="min-w-0">
              <p className="font-semibold text-[var(--foreground)]">Напоминания</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">Пуш и тихие часы</p>
            </div>
            <span className="shrink-0 text-[var(--muted)]" aria-hidden>
              →
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
