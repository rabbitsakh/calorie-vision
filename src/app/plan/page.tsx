"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { AuthGate } from "@/components/AuthGate";
import { ShareWeekButton } from "@/components/ShareWeekButton";
import { WeeklyPlan } from "@/components/WeeklyPlan";
import { WeeklyReportCard } from "@/components/WeeklyReportCard";
import { withBasePath } from "@/lib/paths";
import { useSelectedDate } from "@/lib/use-selected-date";
import { useTimezone } from "@/lib/use-timezone";
import { useRouter } from "next/navigation";

const ShoppingListPanel = dynamic(
  () => import("@/components/ShoppingListPanel").then((m) => m.ShoppingListPanel),
  { ssr: false },
);

export default function PlanPage() {
  const timezone = useTimezone();
  const { date } = useSelectedDate(timezone);
  const router = useRouter();

  return (
    <AppShell
      title="План"
      compact
      description="Неделя, покупки и спокойный обзор."
      date={date}
    >
      <AuthGate>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="min-w-0 flex-1 text-sm text-slate-600">
              Норма и факт по калориям. Нажмите на день — откроется рацион.
            </p>
            <ShareWeekButton endDate={date} className="shrink-0" />
          </div>
          <WeeklyPlan
            selectedDate={date}
            onSelectDate={(next) => {
              router.push(`/ration?date=${next}`);
            }}
          />
          <WeeklyReportCard endDate={date} />
          <ShoppingListPanel selectedDate={date} />
          <Link
            href={withBasePath("/weight")}
            className="card flex items-center justify-between gap-3 p-4 transition-colors hover:border-teal-200"
          >
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">Вес и цель</p>
              <p className="mt-0.5 text-sm text-slate-500">Журнал веса и темп к цели</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-teal-800">Открыть →</span>
          </Link>
        </div>
      </AuthGate>
    </AppShell>
  );
}
