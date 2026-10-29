/**
 * «Лента дня»: non-meal moments (gym, weigh-in) placed by time among meal rows.
 * Meals stay the spine; events slot in before the first later meal.
 */

import type { MealListItem } from "@/lib/meal-groups";

export type DayFeedEvent = {
  key: string;
  kind: "gym" | "weight";
  /** null → top of the day (e.g. weigh-in without a time). */
  atMs: number | null;
  title: string;
  detail: string | null;
  href: string;
  live?: boolean;
};

export type GymSessionSummaryLike = {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  elapsedSec?: number | null;
  muscleLabels?: string[];
  setCount?: number;
  clockStatus?: string;
};

export function mealItemTimeMs(item: MealListItem): number | null {
  const raw = item.kind === "group" ? item.createdAt : (item.entry.eatenAt ?? item.entry.createdAt);
  const ms = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
}

/** Index in `rowTimes` before which each event renders; `rowTimes.length` = after all. */
export function placeDayEvents(
  rowTimes: Array<number | null>,
  events: DayFeedEvent[],
): Map<number, DayFeedEvent[]> {
  const out = new Map<number, DayFeedEvent[]>();
  const sorted = [...events].sort((a, b) => (a.atMs ?? -Infinity) - (b.atMs ?? -Infinity));
  for (const ev of sorted) {
    let idx = 0;
    if (ev.atMs != null) {
      idx = rowTimes.findIndex((t) => t != null && t > ev.atMs!);
      if (idx < 0) idx = rowTimes.length;
    }
    const list = out.get(idx) ?? [];
    list.push(ev);
    out.set(idx, list);
  }
  return out;
}

export function gymSessionEvent(s: GymSessionSummaryLike): DayFeedEvent | null {
  const sets = s.setCount ?? 0;
  if (!s.startedAt && sets === 0) return null;
  const live = s.clockStatus === "running" || s.clockStatus === "paused";
  const minutes = s.elapsedSec != null && s.elapsedSec > 0 ? Math.round(s.elapsedSec / 60) : null;
  const parts = [
    s.muscleLabels?.length ? s.muscleLabels.slice(0, 3).join(" · ") : null,
    live ? "идёт" : minutes != null ? `${minutes} мин` : null,
    sets > 0 ? `${sets} подх.` : null,
  ].filter((p): p is string => Boolean(p));
  const at = s.startedAt ? Date.parse(s.startedAt) : Number.NaN;
  return {
    key: `gym:${s.id}`,
    kind: "gym",
    atMs: Number.isFinite(at) ? at : null,
    title: live ? "Зал · тренировка идёт" : "Зал",
    detail: parts.length ? parts.join(" · ") : null,
    href: "/workouts",
    live,
  };
}

export function weightEvent(kg: number | null | undefined): DayFeedEvent | null {
  if (kg == null || !(kg > 0)) return null;
  return {
    key: "weight",
    kind: "weight",
    atMs: null,
    title: "Вес",
    detail: `${kg.toLocaleString("ru-RU", { maximumFractionDigits: 1 })} кг`,
    href: "/weight",
  };
}
