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
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2.5 text-sm text-indigo-950">
      <p className="font-semibold">Неделя в дневнике</p>
      <p className="mt-0.5 text-xs text-indigo-900/80">
        Уже {daysLogged} дней с записями — в статистике видно коридор калорий и настроение по еде.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <Link
          href={withBasePath("/stats")}
          className="text-xs font-semibold text-indigo-900 underline-offset-2 hover:underline"
          onClick={() => {
            markSevenDayAhaSeen();
            setVisible(false);
          }}
        >
          Открыть статистику →
        </Link>
        <button
          type="button"
          className="text-xs font-medium text-indigo-800/70"
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
