"use client";

import type { ReactNode } from "react";

export type StageMetric = {
  key: string;
  label: string;
  value: ReactNode;
  accent?: boolean;
};

type StageAction = {
  label: string;
  onClick: () => void;
};

type StageScreenProps = {
  eyebrow: string;
  headline: string;
  subline?: string;
  metrics?: StageMetric[];
  children?: ReactNode;
  primaryAction?: StageAction;
  secondaryAction?: StageAction;
  /** Optional top-right dismiss control. */
  onDismiss?: () => void;
  dismissLabel?: string;
};

/**
 * Full-bleed closing stage: teal→slate gradient, eyebrow, headline, metric tiles, CTAs.
 * Shared by workout summary, day wrap-up, and similar “done” surfaces.
 */
export function StageScreen({
  eyebrow,
  headline,
  subline,
  metrics,
  children,
  primaryAction,
  secondaryAction,
  onDismiss,
  dismissLabel = "Закрыть",
}: StageScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-auto bg-gradient-to-b from-teal-950 to-slate-950 text-white">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        {onDismiss ? (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={onDismiss}
              aria-label={dismissLabel}
            >
              ✕
            </button>
          </div>
        ) : null}

        <p className="text-xs font-semibold uppercase tracking-widest text-teal-300/90">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight">{headline}</h2>
        {subline ? <p className="mt-1 text-slate-300">{subline}</p> : null}

        {metrics && metrics.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <div
                key={m.key}
                className={`rounded-2xl px-4 py-3 ${
                  m.accent ? "bg-teal-500/20" : "bg-white/10"
                }`}
              >
                <p className={`text-xs ${m.accent ? "text-teal-200" : "text-slate-400"}`}>
                  {m.label}
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{m.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {children ? <div className="mt-6 flex-1">{children}</div> : <div className="flex-1" />}

        {primaryAction || secondaryAction ? (
          <div className="mt-auto flex flex-col gap-2 pt-8">
            {primaryAction ? (
              <button
                type="button"
                className="rounded-2xl bg-teal-500 py-3.5 text-base font-bold text-slate-950"
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </button>
            ) : null}
            {secondaryAction ? (
              <button
                type="button"
                className="rounded-2xl border border-white/20 py-3 text-sm font-semibold"
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
