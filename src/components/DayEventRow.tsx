"use client";

import Link from "next/link";
import type { DayFeedEvent } from "@/lib/day-feed-events";

/** Non-meal moment in the day feed — compact, links to its own screen. */
export function DayEventRow({ event, timezone }: { event: DayFeedEvent; timezone?: string | null }) {
  return (
    <Link
      href={event.href}
      className={`day-event-row day-event-row--${event.kind}${event.live ? " day-event-row--live" : ""}`}
      data-testid={`day-event-${event.kind}`}
    >
      <span className="day-event-row-dot" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="day-event-row-title">{event.title}</span>
        {event.detail ? <span className="day-event-row-detail">{event.detail}</span> : null}
      </span>
      {event.atMs != null ? (
        <span className="day-event-row-time">
          {new Date(event.atMs).toLocaleTimeString("ru-RU", {
            hour: "2-digit",
            minute: "2-digit",
            ...(timezone ? { timeZone: timezone } : {}),
          })}
        </span>
      ) : null}
    </Link>
  );
}
