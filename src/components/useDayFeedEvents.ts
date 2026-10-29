"use client";

import { useEffect, useMemo, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import {
  gymSessionEvent,
  weightEvent,
  type DayFeedEvent,
  type GymSessionSummaryLike,
} from "@/lib/day-feed-events";
import { withBasePath } from "@/lib/paths";

/** Gym sessions + weigh-in for the selected day, ready for the meal feed. */
export function useDayFeedEvents(date: string, refreshKey: number): DayFeedEvent[] {
  const day = useOptionalRationDay();
  const [sessions, setSessions] = useState<GymSessionSummaryLike[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/workouts?date=${date}&limit=5`), {
          cache: "no-store",
        });
        if (!resp.ok || cancelled) return;
        const data = (await resp.json()) as { sessions?: GymSessionSummaryLike[] };
        if (!cancelled) setSessions(data.sessions ?? []);
      } catch {
        // offline — feed keeps meals only
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, refreshKey]);

  const weightKg = day?.data?.weightKg ?? null;
  return useMemo(() => {
    const events = sessions
      .map(gymSessionEvent)
      .filter((e): e is DayFeedEvent => e != null);
    const w = weightEvent(weightKg);
    return w ? [w, ...events] : events;
  }, [sessions, weightKg]);
}
