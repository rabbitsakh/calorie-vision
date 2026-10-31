/**
 * «Лента дня»: non-meal moments (gym, weigh-in) placed by time among meal rows.
 * Meals stay the spine; events slot in before the first later meal.
 */

import type { MealListItem } from "@/lib/meal-groups";

export type DayFeedEvent = {
  key: string;
  kind: "gym" | "weight" | "water";
  /** null → top of the day (e.g. weigh-in without a time). */
  atMs: number | null;
  title: string;
  detail: string | null;
  href: string;
  live?: boolean;
  /** Gym PR badge in the feed. */
  record?: boolean;
  /** Water quick-add (+250). */
  waterAddMl?: number;
};

export type GymSessionSummaryLike = {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  elapsedSec?: number | null;
  muscleLabels?: string[];
  setCount?: number;
  clockStatus?: string;
  prCount?: number;
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
  const record = (s.prCount ?? 0) > 0 && !live;
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
    record,
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

/** Soft water card in the day feed (mockup: total + «+250»). */
export function waterFeedEvent(input: {
  totalMl: number;
  target: number;
  /** Only show when the user already drank something today. */
  requireLogged?: boolean;
}): DayFeedEvent | null {
  const total = Math.max(0, Math.round(input.totalMl));
  const target = Math.max(0, Math.round(input.target));
  if (!(target > 0)) return null;
  if (input.requireLogged !== false && !(total > 0)) return null;
  return {
    key: "water",
    kind: "water",
    atMs: null,
    title: `Вода · ${total.toLocaleString("ru-RU")} мл`,
    detail: `цель ${target.toLocaleString("ru-RU")} мл`,
    href: "/ration",
    waterAddMl: 250,
  };
}

export type PlannedSlot = {
  key: string;
  title: string;
  detail: string;
  /** Wall-clock hint in the time column («06:45», «13:00»). */
  timeLabel: string;
  actionLabel: string;
  action: { kind: "weight" } | { kind: "meal"; mealType: "BREAKFAST" | "LUNCH" | "DINNER" };
};

const SLOT_PLAN = [
  { type: "BREAKFAST", from: 5, to: 11, title: "Завтрак", time: "08:00" },
  { type: "LUNCH", from: 11, to: 16, title: "Обед", time: "13:00" },
  { type: "DINNER", from: 16, to: 22, title: "Ужин", time: "19:00" },
] as const;

/**
 * Dashed «что дальше» rows at the end of today's feed: weigh-in before breakfast,
 * then the meal slot of the current hour if it is still empty.
 */
export function plannedDaySlots(input: {
  isToday: boolean;
  hour: number;
  hasWeight: boolean;
  loggedMealTypes: ReadonlySet<string>;
}): PlannedSlot[] {
  if (!input.isToday) return [];
  const out: PlannedSlot[] = [];
  if (!input.hasWeight && input.hour >= 5 && input.hour < 11 && !input.loggedMealTypes.has("BREAKFAST")) {
    out.push({
      key: "plan:weight",
      title: "Вес до завтрака",
      detail: "натощак — тренд точнее",
      timeLabel: "утро",
      actionLabel: "Ввести",
      action: { kind: "weight" },
    });
  }
  const slot = SLOT_PLAN.find((s) => input.hour >= s.from && input.hour < s.to);
  if (slot && !input.loggedMealTypes.has(slot.type)) {
    out.push({
      key: `plan:${slot.type}`,
      title: slot.title,
      detail:
        slot.type === "BREAKFAST"
          ? "как вчера или сфоткай — запишу сюда"
          : "сфоткай или напиши ниже — запишу сюда",
      timeLabel: slot.time,
      actionLabel: "Сфоткать",
      action: { kind: "meal", mealType: slot.type },
    });
  }
  return out;
}
