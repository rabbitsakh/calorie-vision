"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { WeeklyReportCard } from "@/components/WeeklyReportCard";
import { WeightGoalCard } from "@/components/WeightGoalCard";
import { toDateKeyTz } from "@/lib/dates";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";
import { useRouter } from "next/navigation";

const ShoppingListPanel = dynamic(
  () => import("@/components/ShoppingListPanel").then((m) => m.ShoppingListPanel),
  { ssr: false },
);

const WeeklyChallenge = dynamic(
  () => import("@/components/WeeklyChallenge").then((m) => m.WeeklyChallenge),
  { ssr: false },
);

export default function PlanPage() {
  const timezone = useTimezone();
  const { date, setDate } = useSelectedDate(timezone);
  const today = toDateKeyTz(new Date(), timezone);
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <AppShell
      title="План"
      compact
      description="Неделя целиком: челлендж, вес, покупки."
      date={date}
    >
      <AuthGate>
        {/* D4: one weekly composition — not five stacked cards. */}
        <div className="plan-week">
          <div className="plan-week__hero">
            <WeeklyPlan
              selectedDate={date}
              today={today}
              refreshKey={refreshKey}
              showPlanLink={false}
              embedded
              showHolidayToggle={date === today}
              onHolidayChange={() => setRefreshKey((k) => k + 1)}
              onWeekNavigate={(next) => setDate(next)}
              onSelectDate={(next) => {
                router.push(`/ration?date=${next}`);
              }}
            />
          </div>

          <div className="plan-week__rail">
            <section id="challenge" className="scroll-mt-3">
              <WeeklyChallenge
                selectedDate={date}
                refreshKey={refreshKey}
                embedded
                onStarted={() => setRefreshKey((k) => k + 1)}
              />
            </section>

            <details className="plan-week__fold group">
              <summary className="plan-week__fold-summary">
                <span className="min-w-0">
                  <span className="block font-semibold text-[var(--foreground)]">Итог недели</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    Средние, лучший день, шаринг
                  </span>
                </span>
                <span
                  className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
                  aria-hidden
                >
                  ▾
                </span>
              </summary>
              <div className="plan-week__fold-body">
                <WeeklyReportCard endDate={date} today={today} embedded />
              </div>
            </details>

            <details className="plan-week__fold group">
              <summary className="plan-week__fold-summary">
                <span className="min-w-0">
                  <span className="block font-semibold text-[var(--foreground)]">Цель по весу</span>
                  <span className="mt-0.5 block text-xs text-[var(--muted)]">
                    Текущий вес и темп
                  </span>
                </span>
                <span
                  className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
                  aria-hidden
                >
                  ▾
                </span>
              </summary>
              <div className="plan-week__fold-body">
                <WeightGoalCard
                  selectedDate={date === today ? today : date}
                  refreshKey={refreshKey}
                  showCurrentWeight
                  embedded
                  onChanged={() => setRefreshKey((k) => k + 1)}
                />
              </div>
            </details>

            <ShoppingListPanel selectedDate={date} embedded />
          </div>
        </div>
      </AuthGate>
    </AppShell>
  );
}
