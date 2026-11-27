"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { DateNavBar } from "@/components/DateNavBar";
import { DailySummaryCard } from "@/components/DailySummaryCard";
import { MomentHeroView } from "@/components/MomentHeroCard";
import { ChestArt, LeafChestStrip } from "@/components/LeafChestStrip";
import { LEAF_FINE_PRINT, type LeafPublic } from "@/lib/leaf-chest";
import { NavIcon } from "@/components/NavIcons";
import { buildMomentHero } from "@/lib/moment-hero";
import { setMetrikaConsent } from "@/lib/metrika-consent";
import { APP_NAV } from "@/lib/navigation";
import {
  CARBS,
  CARBS_TARGET,
  EATEN_KCAL,
  FAT,
  FAT_TARGET,
  FIXTURE_DATE,
  FIXTURE_HOUR,
  PROTEIN,
  PROTEIN_TARGET,
  REMAINING_KCAL,
  SCREEN_IDEAS,
  TARGET_KCAL,
  WATER_ML,
  WATER_TARGET_ML,
  ideasForMoment,
} from "./fixture";

function chestPreview(kind: string | null): LeafPublic {
  const empty = { state: "empty" as const, label: "" };
  const on = { state: "on" as const, label: "" };
  const base = {
    finePrint: LEAF_FINE_PRINT,
    readyCount: 0,
    spareLeaf: false,
    canSpendSpare: false,
    pendingNote: null,
  };
  if (kind === "0") {
    return {
      ...base,
      line: "Пока пусто. Завтрак или зал — и первый листок.",
      sheetHint: "Пока пусто. Завтрак или зал — и первый листок.",
      filled: 0,
      ready: false,
      rarity: null,
      rarityLabel: null,
      chestLook: "common",
      slots: [empty, empty, empty],
    };
  }
  if (kind === "ready") {
    return {
      ...base,
      line: "Три дня есть. Можно открывать.",
      sheetHint: "Сундук твой. Откроем?",
      filled: 3,
      ready: true,
      readyCount: 1,
      rarity: "rare",
      rarityLabel: "Редкий",
      chestLook: "rare",
      slots: [on, on, on],
    };
  }
  return {
    ...base,
    line: "Вчера зал, позавчера завтрак — остался сегодняшний листок.",
    sheetHint: "Сделаешь и то и другое — в сундуке будет редкая вещь.",
    filled: 2,
    ready: false,
    rarity: null,
    rarityLabel: null,
    chestLook: "rare",
    slots: [on, on, { state: "wait", label: "" }],
  };
}

const SAMPLE_REWARD = {
  key: "sticker_sprout",
  title: "Росток",
  description: "Тихое начало дня",
  rarityLabel: "Редкий",
  look: "rare" as const,
};

const RARITY_GALLERY = [
  { look: "common" as const, label: "Обычный" },
  { look: "rare" as const, label: "Редкий" },
  { look: "epic" as const, label: "Эпический" },
  { look: "gold" as const, label: "Легендарный" },
];

const ICON = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

/**
 * Стенд живой карточки «Сегодня» для скриншотов: ?theme=light|dark&ideas=empty.
 * Цифры считает buildMomentHero из переданных съеденного и цели, в дневник не пишет.
 */
export function TodayHeroPreview() {
  const params = useSearchParams();
  const dark = params.get("theme") === "dark";
  const ideasEmpty = params.get("ideas") === "empty";
  const hourRaw = params.get("hour");
  const hourParam = hourRaw == null ? Number.NaN : Number(hourRaw);
  const hour = Number.isFinite(hourParam) && hourParam >= 0 && hourParam <= 23 ? hourParam : FIXTURE_HOUR;
  const past = params.get("past") === "1";
  const baseRaw = Number(params.get("base"));
  const bonusRaw = Number(params.get("bonus"));
  const calorieBase = Number.isFinite(baseRaw) && baseRaw > 0 ? Math.round(baseRaw) : null;
  const calorieBonus = Number.isFinite(bonusRaw) && bonusRaw > 0 ? Math.round(bonusRaw) : null;
  const viewDate = past ? "2026-11-01" : FIXTURE_DATE;
  const headerTitle = past ? "1 ноября 2026 г." : "Сегодня";

  useEffect(() => {
    setMetrikaConsent("declined");
  }, []);

  const moment = useMemo(
    () =>
      buildMomentHero({
        selectedIsToday: true,
        hour,
        gymLive: false,
        gymLiveLabel: null,
        gymDoneToday: true,
        morning: null,
        logged: true,
        calories: EATEN_KCAL,
        calorieTarget:
          calorieBase != null && calorieBonus != null ? calorieBase + calorieBonus : TARGET_KCAL,
        calorieBase,
        calorieBonus,
        protein: PROTEIN,
        proteinTarget: PROTEIN_TARGET,
        fat: FAT,
        fatTarget: FAT_TARGET,
        carbs: CARBS,
        carbsTarget: CARBS_TARGET,
        waterMl: WATER_ML,
        waterTarget: WATER_TARGET_ML,
        streak: 0,
        softStep: {
          label: "После тренировки — доберите белок",
          actionLabel: "Добавить",
          action: "food",
        },
      }),
    [hour, calorieBase, calorieBonus],
  );
  const showSummary = params.get("summary") === "1";

  return (
    <div className={`cv-app-frame today-shot${dark ? " today-hero-force-dark" : ""}`} data-today-hero-shot="live">
      <main className="app-shell cv-app-main mx-auto flex w-full max-w-6xl flex-1 flex-col gap-1.5 px-2.5 py-1.5">
        <header className="app-chrome app-chrome--theater">
          <div className="flex h-10 items-center justify-between gap-3">
            <div className="app-chrome__brand">
              <BrandMark size={36} />
              <span className="app-chrome__wordmark truncate">
                Calorie Vision
                <span className="app-chrome__wordmark-sub md:hidden">{headerTitle}</span>
              </span>
            </div>
            <span className="today-shot__avatar" aria-hidden>
              <svg viewBox="0 0 24 24" width="20" height="20">
                <circle cx="12" cy="9" r="3.2" fill="currentColor" />
                <path d="M5.5 19.2c1.2-2.6 3.4-3.8 6.5-3.8s5.3 1.2 6.5 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </span>
          </div>
        </header>

        <div className="ration-day-scene">
          <div className="ration-day-band">
            <DateNavBar date={viewDate} today={FIXTURE_DATE} onDateChange={() => {}} />
          </div>
          {moment ? (
            <MomentHeroView
              moment={moment}
              selectedDate={FIXTURE_DATE}
              onAction={() => {}}
              mealIdeas={
                ideasEmpty
                  ? []
                  : ideasForMoment(SCREEN_IDEAS, REMAINING_KCAL, FIXTURE_HOUR).map((idea) => ({
                      name: idea.name,
                      calories: idea.calories,
                    }))
              }
              mealIdeasLabel="Идеи на завтрак"
              ideasEmpty={ideasEmpty}
            />
          ) : null}
          {params.get("chest") === "gallery" ? (
            <section className="leaf-gallery" aria-label="Редкости сундука">
              {RARITY_GALLERY.map((item) => (
                <article key={item.look} className={`leaf-gallery-card leaf-chest-frame--${item.look}`}>
                  <ChestArt look={item.look} />
                  <b>{item.label}</b>
                </article>
              ))}
            </section>
          ) : null}
          {params.get("chest") && params.get("chest") !== "gallery" ? (
            <>
              <LeafChestStrip
                selectedDate={FIXTURE_DATE}
                today={FIXTURE_DATE}
                refreshKey={0}
                fixture={chestPreview(params.get("chest"))}
                initialSheet={params.get("chest") === "sheet"}
                previewReward={
                  params.get("chest") === "play" || params.get("chest") === "reward" ? SAMPLE_REWARD : null
                }
                previewRevealed={params.get("chest") === "reward"}
                previewMotion={params.get("chest") === "play" ? "full" : "auto"}
              />
              <div className="ration-day-feed ration-meal-feed">
                <article className="meal-card">
                  <div className="meal-card-body flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[var(--muted)]">Завтрак</p>
                      <p className="meal-card-title">Сырники со сметаной</p>
                    </div>
                    <p className="meal-card-kcal">420</p>
                  </div>
                </article>
                <article className="meal-card">
                  <div className="meal-card-body flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[var(--muted)]">Обед</p>
                      <p className="meal-card-title">Курица с киноа</p>
                    </div>
                    <p className="meal-card-kcal">610</p>
                  </div>
                </article>
              </div>
            </>
          ) : null}
        </div>
      </main>

      <nav className="mobile-tab-bar shrink-0" aria-label="Основные разделы">
        <form className="bottom-composer" onSubmit={(event) => event.preventDefault()} aria-label="Записать еду">
          <span className="bottom-composer-ai" aria-hidden>
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3z" strokeLinejoin="round" />
              <path d="M18.5 13.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1z" strokeLinejoin="round" />
            </svg>
          </span>
          <input className="bottom-composer-input" placeholder="Что съел? Напиши…" aria-label="Что съели" readOnly />
          <span className="bottom-composer-btn" aria-hidden>
            <svg {...ICON} strokeWidth={2.4}>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="bottom-composer-btn bottom-composer-btn--camera" aria-hidden>
            <svg {...ICON} width={22} height={22} strokeWidth={2.2}>
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </span>
        </form>
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-1.5">
          {APP_NAV.map((item) => {
            const active = item.href === "/ration";
            return (
              <span key={item.href} className={`mobile-tab-bar__link${active ? " mobile-tab-bar__link--active" : ""}`}>
                <span className="mobile-tab-bar__icon">
                  <NavIcon name={item.icon} className="h-5 w-5" />
                </span>
                <span className="truncate">{item.shortLabel}</span>
              </span>
            );
          })}
        </div>
      </nav>
      {showSummary ? (
        <DailySummaryCard
          today={FIXTURE_DATE}
          previewData={{
            date: "2026-11-12",
            today: FIXTURE_DATE,
            mealCount: 3,
            totalCalories: 1330,
            totalProtein: 78,
            totalFat: 42,
            totalCarbs: 140,
            totalFiber: 11,
            totalSugar: 18,
            totalWaterMl: 700,
            goal: "LOSE",
            target: { calories: 1808 },
            comparison: { calories: { kind: "deficit" } },
            tip: "Вчера день закрыт спокойно.",
            hasData: true,
          }}
        />
      ) : null}
    </div>
  );
}
