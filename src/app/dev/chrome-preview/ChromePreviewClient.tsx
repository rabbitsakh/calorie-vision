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

        <div className="ration-diary-toolbar mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-[0.95rem] font-semibold tracking-tight text-[var(--foreground)]">
            Дневник
          </h2>
          <button
            type="button"
            className="ration-diary-filters text-xs font-semibold text-[var(--accent-ink)] underline-offset-2 hover:underline"
            tabIndex={-1}
          >
            Фильтры
          </button>
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
            <div className="meal-card-body">
              <div className="meal-card-thumb shrink-0 rounded-[0.85rem] bg-[var(--accent-soft)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="meal-card-title">Пирог с персиком и творожным кремом</p>
                <p className="meal-card-meta">250 ккал · 100 г · Б 5.3 · Ж 10 · У 26.7</p>
                <div className="meal-card-meta-row">
                  <span className="meal-time-badge">06:55 Завтр.</span>
                  <div className="meal-card-actions" aria-hidden>
                    <button type="button" tabIndex={-1}>✎</button>
                    <button type="button" tabIndex={-1}>⧉</button>
                    <button type="button" tabIndex={-1} className="danger">🗑</button>
                  </div>
                </div>
              </div>
            </div>
          </article>
          <div className="meal-section-header flex items-center gap-2 pt-1">
            <span className="h-3.5 w-1 shrink-0 rounded-full bg-amber-500" aria-hidden />
            <h3 className="font-display text-[1.05rem] font-semibold tracking-tight text-[var(--foreground)]">
              Обед <span className="ml-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">· 1</span>
            </h3>
          </div>
          <article className="meal-card">
            <div className="meal-card-body">
              <div className="meal-card-thumb shrink-0 rounded-[0.85rem] bg-[var(--accent-soft)]" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="meal-card-title">Bombbar Natural bar chocolate peanut</p>
                <p className="meal-card-meta">180 ккал · 40 г · Б 15 · Ж 6 · У 12</p>
                <div className="meal-card-meta-row">
                  <span className="meal-time-badge">13:20 Обед</span>
                  <div className="meal-card-actions" aria-hidden>
                    <button type="button" tabIndex={-1}>✎</button>
                    <button type="button" tabIndex={-1}>⧉</button>
                    <button type="button" tabIndex={-1} className="danger">🗑</button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>

        {/* D7 — day-more: hairline bands on the day wash */}
        <div className="ration-day-more mt-3 flex flex-col gap-3 px-0.5 pb-1">
          <section
            className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-quiet)] bg-[var(--accent-water-soft)]/55 px-3.5 py-3"
            aria-label="Вода (превью)"
          >
            <p className="text-sm font-semibold text-[var(--accent-ink)]">
              Вода <span className="font-medium text-[var(--muted-strong)]">750 / 2000 мл</span>
            </p>
            <p className="text-[11px] text-[var(--muted)]">Осталось 1250 мл · без sky-палитры</p>
          </section>
          <details className="group rounded-[var(--radius-lg)] border border-[var(--border-quiet)] bg-[var(--surface-mist)]/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--foreground)]">Ещё</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">Привычки, план, итог</p>
              </div>
              <span className="shrink-0 text-[var(--muted)]" aria-hidden>
                ▾
              </span>
            </summary>
          </details>
        </div>
      </div>

      <div className="gym-day mt-6">
        <section className="day-hero day-hero--scene day-hero--day day-hero--live" aria-label="Зал сегодня (превью)">
          <div className="day-hero-glow" aria-hidden />
          <div className="gym-console-active relative flex items-center gap-4 px-5 py-7 md:px-7 md:py-8">
            <div className="min-w-0 flex-1">
              <p className="gym-live-pulse text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white/80">
                Сейчас · вт
              </p>
              <p className="font-display mt-2.5 text-[1.45rem] font-semibold leading-snug tracking-tight text-white sm:text-[1.7rem]">
                Верх тела · в зале
              </p>
              <p className="mt-2.5 text-[0.95rem] font-medium text-white/85">
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
          <div className="relative px-5 py-5 md:px-6 md:py-6">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[var(--accent-ink)]/70">
              Главный вывод
            </p>
            <p className="stats-insight-body mt-2">
              Среднее 1 840 ккал — близко к цели.
            </p>
            <p className="mt-2 text-sm font-medium text-[var(--muted-strong)]">7 дней · цель 2 000</p>
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
        {/* D8 — challenge on accent tokens, not emerald */}
        <div className="plan-week__band px-5 py-4 md:px-7">
          <p className="font-semibold text-[var(--foreground)]">Челлендж недели</p>
          <p className="text-xs text-[var(--muted)]">3 дня с белком ≥ нормы</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <span className="text-sm font-semibold tabular-nums text-[var(--accent-ink)]">
              1<span className="font-normal"> / 3</span>
            </span>
            <span className="text-sm font-bold tabular-nums text-[var(--accent-ink)]">33%</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-[var(--accent-soft)]">
            <div className="h-full w-1/3 rounded-full bg-[var(--accent)]" />
          </div>
        </div>
      </div>

      {/* D9 — weight wash scene */}
      <div className="weight-page-scene mt-6 flex flex-col gap-3">
        <section className="weight-page-block p-4" aria-label="Вес (превью)">
          <p className="font-display text-lg font-semibold tracking-tight text-[var(--foreground)]">Вес</p>
          <p className="mt-1 text-sm text-[var(--muted)]">78.4 кг · цель 75 кг</p>
        </section>
        <section className="weight-page-block p-4">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">До цели</p>
          <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">−3.4 кг</p>
        </section>
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

      {/* D13 — quiet empty + assistant wash */}
      <div className="scene-empty mt-6">
        <p className="scene-empty__title">Избранное пока пусто</p>
        <p className="scene-empty__hint">Одна строка и один CTA — общий паттерн пустых экранов.</p>
        <button type="button" className="btn btn-on-tint text-sm text-[var(--accent-ink)]" tabIndex={-1}>
          + Добавить продукт
        </button>
      </div>

      <div className="assistant-scene mt-6" aria-label="Ассистент (превью)">
        <div className="assistant-scene-toolbar">
          <span className="assistant-scene-chip">День · сегодня</span>
          <span className="assistant-scene-chip">ещё 760 ккал</span>
        </div>
        <p className="mt-2 text-sm text-[var(--muted-strong)]">
          Пиши обычным языком — добавлю в рацион или план зала.
        </p>
      </div>

      <div className="food-add-sheet mt-6 shrink-0 rounded-[var(--radius-panel)] p-4 shadow-xl">
        <p className="font-display text-[1.05rem] font-semibold tracking-tight text-[var(--foreground)]">
          Добавить еду
        </p>
        <div className="food-add-utility-row food-add-utility-row--three mt-3" role="list">
          {(
            [
              ["water", "Вода", "+250 мл"],
              ["weight", "Вес", "сегодня"],
              ["workout", "Тренировка", "зал"],
            ] as const
          ).map(([id, label, hint]) => (
            <button
              key={id}
              type="button"
              tabIndex={-1}
              className={`food-add-utility-tile food-add-utility-tile--${id}`}
            >
              <span className="food-add-utility-icon" aria-hidden>
                ·
              </span>
              <span className="food-add-utility-copy">
                <span className="food-add-utility-label">{label}</span>
                <span className="food-add-utility-hint">{hint}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent-ink)]/70">
          Штрихкод · idle
        </p>
        <div className="barcode-scanner mt-3 flex flex-col gap-2">
          <p className="text-xs text-[var(--muted-strong)]">
            Сканер читает штрихкод на устройстве и сразу получает цифры — фото в GigaChat не отправляется.
          </p>
          <div className="barcode-scanner__stage barcode-scanner__stage--idle">
            <div className="barcode-scanner__idle flex h-32 flex-col items-center justify-center gap-2 px-5 text-center">
              <span className="barcode-scanner__frame" aria-hidden />
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Наведите камеру на штрихкод на упаковке
              </p>
              <p className="text-xs text-[var(--muted-strong)]">
                Или загрузите снимок / введите цифры ниже
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
