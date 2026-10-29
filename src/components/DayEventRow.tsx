"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { DayFeedEvent, PlannedSlot } from "@/lib/day-feed-events";
import { requestOpenFoodAddPicker } from "@/lib/open-food-camera";
import { requestOpenWeightQuick } from "@/lib/open-weight-quick";

export type FeedDot = "meal" | "gym" | "weight" | "empty";

export function feedTimeLabel(atMs: number | null, timezone?: string | null): string {
  if (atMs == null) return "";
  return new Date(atMs).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    ...(timezone ? { timeZone: timezone } : {}),
  });
}

/** One «Лента дня» line: time · dot on the rail · card. */
export function FeedTimelineItem({
  time,
  dot,
  children,
}: {
  time: string;
  dot: FeedDot;
  children: ReactNode;
}) {
  return (
    <div className="feed-tl-item">
      <span className="feed-tl-time">{time}</span>
      <span className="feed-tl-rail" aria-hidden>
        <i className={`feed-tl-dot feed-tl-dot--${dot}`} />
        <u />
      </span>
      <div className="feed-tl-body">{children}</div>
    </div>
  );
}

/** Non-meal moment in the day feed — card on the rail, links to its own screen. */
export function DayEventRow({ event, timezone }: { event: DayFeedEvent; timezone?: string | null }) {
  return (
    <FeedTimelineItem time={feedTimeLabel(event.atMs, timezone)} dot={event.kind}>
      <Link
        href={event.href}
        className={`feed-card day-event-row--${event.kind}${event.live ? " feed-card--live" : ""}`}
        data-testid={`day-event-${event.kind}`}
      >
        <span className="feed-card-t1">
          {event.title}
          {event.live ? <span className="feed-tag feed-tag--live">идёт</span> : null}
        </span>
        {event.detail ? <span className="feed-card-t2">{event.detail}</span> : null}
      </Link>
    </FeedTimelineItem>
  );
}

/** Dashed «что дальше» slot at the end of today's feed. */
export function PlannedSlotRow({
  slot,
  extra,
}: {
  slot: PlannedSlot;
  /** Second quick action («Как вчера») — takes the main button slot. */
  extra?: { label: string; onClick: () => void } | null;
}) {
  const run = () => {
    if (slot.action.kind === "weight") requestOpenWeightQuick();
    else requestOpenFoodAddPicker({ mealType: slot.action.mealType });
  };
  return (
    <FeedTimelineItem time={slot.timeLabel} dot="empty">
      <div className="feed-card feed-card--dash" data-testid={slot.key}>
        <span className="feed-card-t1">
          {slot.title}
          <button type="button" className="feed-mini-btn" onClick={extra?.onClick ?? run}>
            {extra?.label ?? slot.actionLabel}
          </button>
        </span>
        <span className="feed-card-t2">{slot.detail}</span>
      </div>
    </FeedTimelineItem>
  );
}
