"use client";

import { useEffect, useState } from "react";
import { StageScreen, type StageMetric } from "@/components/StageScreen";
import { formatDateShort } from "@/lib/dates";
import { formatCalorieVsTargetLabel } from "@/lib/diet";
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
  target: { calories: number } | null;
  comparison: { calories: { kind: "deficit" | "surplus" | "even" } } | null;
  tip: string;
  hasData: boolean;
};

function isSummarySeen(today: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(`${SEEN_KEY_PREFIX}${today}`) === "1";
  } catch {
    return true;
  }
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
};

export function DailySummaryCard({ today }: DailySummaryCardProps) {
  const [data, setData] = useState<DailySummaryData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
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
  }, [today]);

  if (!visible || !data) return null;

  function dismiss() {
    markSummarySeen(today);
    setVisible(false);
  }

  const entryCount = data.entryCount ?? data.mealCount;

  const calorieLabel =
    data.totalCalories > 0 ? `${data.totalCalories} ккал` : "нет записей";

  const vsTarget =
    data.target && data.totalCalories > 0
      ? formatCalorieVsTargetLabel(data.totalCalories, data.target.calories, data.goal)
      : "";

  const macroLine =
    entryCount > 0 ? `${data.totalProtein}/${data.totalFat}/${data.totalCarbs} г` : "—";

  const waterLabel = data.totalWaterMl > 0 ? `${data.totalWaterMl} мл` : "—";

  const deltaLabel =
    data.comparison?.calories.kind === "deficit"
      ? "дефицит"
      : data.comparison?.calories.kind === "surplus"
        ? "профицит"
        : data.comparison?.calories.kind === "even"
          ? "в норме"
          : vsTarget || "—";

  const metrics: StageMetric[] = [
    {
      key: "kcal",
      label: "Калории",
      value: (
        <>
          {calorieLabel}
          {vsTarget ? (
            <span className="mt-0.5 block text-xs font-normal text-slate-400">{vsTarget}</span>
          ) : null}
        </>
      ),
    },
    { key: "macro", label: "БЖУ", value: macroLine },
    { key: "delta", label: "К цели", value: deltaLabel },
    {
      key: "water",
      label: "Вода",
      value: waterLabel,
      accent: data.totalWaterMl > 0,
    },
  ];

  const fiberSugar = [
    data.totalFiber != null && data.totalFiber > 0
      ? `клетчатка ${Math.round(data.totalFiber)} г`
      : null,
    data.totalSugar != null && data.totalSugar > 0
      ? `сахар ${Math.round(data.totalSugar)} г`
      : null,
  ].filter(Boolean);

  return (
    <StageScreen
      eyebrow="Итог дня"
      headline={formatDateShort(data.date)}
      subline={data.tip}
      metrics={metrics}
      primaryAction={{ label: "К рациону", onClick: dismiss }}
      onDismiss={dismiss}
    >
      {entryCount > 0 && fiberSugar.length > 0 ? (
        <p className="text-sm text-slate-300">{fiberSugar.join(" · ")}</p>
      ) : null}
    </StageScreen>
  );
}
