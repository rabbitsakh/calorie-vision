"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useFoodAddUi } from "@/components/FoodAddHost";
import { Button } from "@/components/ds/ui";
import { formatDateShort } from "@/lib/dates";
import { formatTrainingNormSplit } from "@/lib/training-day";
import { formatWaterLiters } from "@/lib/water-display";
import { withBasePath } from "@/lib/paths";

const SEEN_KEY_PREFIX = "summary-seen-";

type DailySummaryData = {
  date: string;
  today: string;
  mealCount: number;
  entryCount?: number;
  totalCalories: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalFiber?: number;
  totalSugar?: number;
  totalWaterMl: number;
  goal?: "LOSE" | "GAIN" | "MAINTAIN" | null;
  target: {
    calories: number;
    protein?: number;
    fat?: number;
    carbs?: number;
    fiber?: number;
    sugar?: number;
  } | null;
  comparison: { calories: { kind: "deficit" | "surplus" | "even" } } | null;
  tip: string;
  hasData: boolean;
  training?: {
    trainingDay: boolean;
    baseCalories: number;
    calorieBonusKcal: number;
  } | null;
};

function isSummarySeen(today: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(`${SEEN_KEY_PREFIX}${today}`) === "1";
  } catch {
    return true;
  }
}

function onboardingStillOpen(): boolean {
  try {
    return localStorage.getItem("cv-onboarding-v1") !== "1";
  } catch {
    return false;
  }
}

/** Words for the old «К цели / дефицит» tile. Display only. */
function explainDayCalories(data: DailySummaryData): string {
  const target = data.target?.calories ?? 0;
  if (!(target > 0) || data.totalCalories <= 0) {
    return data.tip || "За этот день записей почти нет.";
  }
  const diff = Math.round(data.totalCalories - target);
  const band = data.goal === "MAINTAIN" ? 0.1 : 0.05;
  const amount = Math.abs(diff).toLocaleString("ru-RU");
  if (Math.abs(diff) <= Math.max(1, Math.round(target * band))) {
    return "В цели: съедено около нормы этого дня.";
  }
  if (diff < 0) {
    if (data.goal === "LOSE") {
      return `Дефицит ${amount} ккал: съедено меньше нормы. Для похудения это запас, а не долг добрать.`;
    }
    if (data.goal === "GAIN") {
      return `До цели ещё ${amount} ккал — норма дня не закрыта.`;
    }
    return `Ниже коридора на ${amount} ккал.`;
  }
  if (data.goal === "GAIN") {
    return `Профицит ${amount} ккал: съедено больше нормы. Для набора это плюс.`;
  }
  if (data.goal === "LOSE") {
    return `Сверх цели на ${amount} ккал: съедено больше нормы дня.`;
  }
  return `Выше коридора на ${amount} ккал.`;
}

function markSummarySeen(today: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${SEEN_KEY_PREFIX}${today}`, "1");
  } catch {
    // ignore
  }
}

type DailySummaryCardProps = {
  today: string;
  /** Стенд: показать сводку без запроса к API. */
  previewData?: DailySummaryData;
};

export function DailySummaryCard({ today, previewData }: DailySummaryCardProps) {
  const { sheetOpen } = useFoodAddUi();
  const [data, setData] = useState<DailySummaryData | null>(previewData ?? null);
  const [visible, setVisible] = useState(Boolean(previewData));

  useEffect(() => {
    if (previewData) return;
    if (onboardingStillOpen()) return;
    if (isSummarySeen(today)) return;

    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/daily-summary"));
        if (!resp.ok) return;
        const json = (await resp.json()) as DailySummaryData;
        if (json.today !== today) return;
        setData(json);
        setVisible(true);
      } catch {
        // non-critical
      }
    })();
  }, [today, previewData]);

  // Don’t cover the «+» sheet / tab interactions while adding food.
  if (!visible || !data || sheetOpen) return null;

  function dismiss() {
    markSummarySeen(today);
    setVisible(false);
  }

  const calorieLine =
    data.target && data.target.calories > 0
      ? `${Math.round(data.totalCalories).toLocaleString("ru-RU")} из ${Math.round(data.target.calories).toLocaleString("ru-RU")} ккал`
      : data.totalCalories > 0
        ? `${Math.round(data.totalCalories).toLocaleString("ru-RU")} ккал`
        : "Нет записей еды";

  const macroLine = [
    data.target?.protein
      ? `белки ${Math.round(data.totalProtein)} из ${Math.round(data.target.protein)} г`
      : null,
    data.target?.fat ? `жиры ${Math.round(data.totalFat)} из ${Math.round(data.target.fat)} г` : null,
    data.target?.carbs
      ? `углеводы ${Math.round(data.totalCarbs)} из ${Math.round(data.target.carbs)} г`
      : null,
    data.target?.fiber
      ? `клетчатка ${Math.round(data.totalFiber ?? 0)} из ${Math.round(data.target.fiber)} г`
      : data.totalFiber
        ? `клетчатка ${Math.round(data.totalFiber)} г`
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const waterLine =
    data.totalWaterMl > 0 ? `Вода ${formatWaterLiters(data.totalWaterMl)} л` : null;
  const normSplit = formatTrainingNormSplit(data.training, data.target?.calories);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="day-summary-sheet" role="dialog" aria-modal="true" aria-labelledby="day-summary-title">
      <button type="button" className="day-summary-sheet__scrim" aria-label="Закрыть итог дня" onClick={dismiss} />
      <div className="day-summary-sheet__panel">
        <p className="ds-eyebrow">Итог дня</p>
        <h2 id="day-summary-title" className="mt-2 font-display text-xl font-semibold tracking-tight">
          {formatDateShort(data.date)}
        </h2>
        <p className="ds-num mt-3 text-[1.2rem] font-extrabold leading-tight">{calorieLine}</p>
        {normSplit ? (
          <p className="ds-num mt-1 text-xs font-semibold text-[var(--muted)]">{normSplit}</p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-strong)]">{explainDayCalories(data)}</p>
        {macroLine ? <p className="ds-num mt-3 text-sm text-[var(--foreground)]">{macroLine}</p> : null}
        {waterLine ? <p className="ds-num mt-1 text-sm text-[var(--muted-strong)]">{waterLine}</p> : null}
        {data.tip ? <p className="mt-3 text-sm text-[var(--muted)]">{data.tip}</p> : null}
        <Button className="mt-4 w-full" onClick={dismiss}>
          К рациону
        </Button>
      </div>
    </div>,
    document.documentElement,
  );
}
