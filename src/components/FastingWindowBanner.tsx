"use client";

import { useCallback, useEffect, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import {
  formatEatingWindowLabel,
  isOutsideEatingWindow,
} from "@/lib/fasting-window";
import { withBasePath } from "@/lib/paths";
import { useTimezone } from "@/lib/use-timezone";

type FastingBannerProps = {
  isToday: boolean;
};

function localHourInTz(timezone: string | null | undefined): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: timezone || undefined,
    }).formatToParts(new Date());
    const hour = parts.find((p) => p.type === "hour")?.value;
    const n = hour != null ? Number(hour) : NaN;
    return Number.isFinite(n) ? n : new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}

export function FastingWindowBanner({ isToday }: FastingBannerProps) {
  const day = useOptionalRationDay();
  const timezone = useTimezone();
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [hour, setHour] = useState(() => localHourInTz(timezone));
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/account"), { cache: "no-store" });
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        fastingStartHour?: number | null;
        fastingEndHour?: number | null;
      };
      setStart(data.fastingStartHour ?? null);
      setEnd(data.fastingEndHour ?? null);
    } catch {
      // ignore
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (day?.data?.account) {
      setStart(day.data.account.fastingStartHour ?? null);
      setEnd(day.data.account.fastingEndHour ?? null);
      setLoaded(true);
      return;
    }

    if (day && day.loading) {
      return;
    }

    void load();
  }, [day, load]);

  useEffect(() => {
    setHour(localHourInTz(timezone));
    const id = window.setInterval(() => setHour(localHourInTz(timezone)), 60_000);
    return () => window.clearInterval(id);
  }, [timezone]);

  if (!isToday || !loaded) return null;
  if (!isOutsideEatingWindow(hour, start, end)) return null;

  const label = formatEatingWindowLabel(start, end);

  return (
    <div
      className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950"
      role="status"
    >
      <p className="font-semibold">Сейчас вне окна питания</p>
      <p className="mt-0.5 text-xs text-amber-800/90">
        Окно {label}. Это мягкая подсказка по времени, не медицинская рекомендация.
      </p>
    </div>
  );
}
