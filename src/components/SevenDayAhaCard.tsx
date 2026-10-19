"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import {
  markSevenDayAhaSeen,
  shouldShowSevenDayAha,
} from "@/lib/first-hour-trust";
import { withBasePath } from "@/lib/paths";

/** Soft insight after ~7 logged days — deep-link to stats. */
export function SevenDayAhaCard({ today, selectedDate }: { today: string; selectedDate: string }) {
  const day = useOptionalRationDay();
  const [visible, setVisible] = useState(false);
  const daysLogged = day?.data?.streak?.daysLoggedTotal ?? 0;

  useEffect(() => {
    if (selectedDate !== today) {
      setVisible(false);
      return;
    }
    setVisible(shouldShowSevenDayAha(daysLogged));
  }, [daysLogged, selectedDate, today]);

  if (!visible) return null;

  return (
    <div className="rounded-xl border border-[var(--border-quiet)] bg-[var(--accent-soft)]/50 px-3 py-2.5 text-sm text-[var(--accent-ink)]">
      <p className="font-semibold">Неделя в дневнике</p>
      <p className="mt-0.5 text-xs text-[var(--muted-strong)]">
        Уже {daysLogged} дней с записями — в статистике видно коридор калорий и настроение по еде.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={withBasePath("/stats")}
          className="text-xs font-semibold text-[var(--accent-ink)] underline-offset-2 hover:underline"
          onClick={() => {
            markSevenDayAhaSeen();
            setVisible(false);
          }}
        >
          Открыть статистику →
        </Link>
        <button
          type="button"
          className="text-xs font-medium text-[var(--muted)]"
          onClick={() => {
            markSevenDayAhaSeen();
            setVisible(false);
          }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
}
