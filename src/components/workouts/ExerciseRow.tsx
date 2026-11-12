"use client";

import type { ReactNode } from "react";
import { OverflowMenu, type OverflowMenuItem } from "@/components/workouts/OverflowMenu";

type Props = {
  name: string;
  muscle: string | null;
  doneLabel: string;
  bestTarget: string | null;
  lastLine?: string | null;
  expanded: boolean;
  superset: string | null;
  pending?: boolean;
  menu: OverflowMenuItem[];
  onToggle: () => void;
  children?: ReactNode;
};

/** Collapsed exercise line. Tap expands the set table; ⋯ stays off the flow. */
export function ExerciseRow({
  name,
  muscle,
  doneLabel,
  bestTarget,
  lastLine = null,
  expanded,
  superset,
  pending,
  menu,
  onToggle,
  children,
}: Props) {
  const meta = [muscle, bestTarget].filter(Boolean).join(" · ");
  return (
    <section
      className={`gym-ex overflow-visible ${expanded ? "is-open" : ""} ${superset ? "is-superset" : ""}`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          className="flex min-h-[48px] min-w-0 flex-1 flex-col items-start justify-center px-3 py-2 text-left"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <span className="flex max-w-full items-center gap-1.5">
            <span className="truncate font-semibold text-[var(--foreground)]">{name}</span>
            {pending ? (
              <span className="shrink-0 rounded bg-amber-200/80 px-1.5 py-0.5 text-[11px] font-semibold text-amber-950">
                на устройстве
              </span>
            ) : null}
          </span>
          {meta ? <span className="mt-0.5 truncate text-xs text-[var(--muted)]">{meta}</span> : null}
          {lastLine ? <span className="gym-last-time">{lastLine}</span> : null}
        </button>
        <span className="gym-ex__count">{doneLabel}</span>
        <OverflowMenu label={`Действия: ${name}`} items={menu} />
      </div>
      {expanded ? children : null}
    </section>
  );
}
