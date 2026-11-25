"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type StageMetric = {
  key: string;
  label: string;
  value: ReactNode;
  /** Короткая подпись под числом, мельче самого значения. */
  hint?: ReactNode;
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
  /** Optional chrome above metrics (e.g. collection wear / cheer). */
  lead?: ReactNode;
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
 * Portaled to <html> so iOS TWA / `.cv-app-frame` overflow cannot leave the tab bar
 * poking through (or sitting above) the day wrap-up.
 */
export function StageScreen({
  eyebrow,
  headline,
  subline,
  lead,
  metrics,
  children,
  primaryAction,
  secondaryAction,
  onDismiss,
  dismissLabel = "Закрыть",
}: StageScreenProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stage = (
    <div
          className="stage-screen-root fixed inset-0 z-[55] flex flex-col overflow-auto bg-gradient-to-b from-[var(--stage-from)] to-[var(--stage-to)] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={eyebrow}
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        {onDismiss ? (
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-white/90 hover:bg-white/10"
              onClick={onDismiss}
              aria-label={dismissLabel}
            >
              ✕
            </button>
          </div>
        ) : null}

        <p className="text-xs font-semibold uppercase tracking-widest text-white">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight text-white">{headline}</h2>
        {subline ? <p className="mt-1 text-base font-medium text-white">{subline}</p> : null}

        {lead ? <div className="mt-4">{lead}</div> : null}

        {metrics && metrics.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-3">
            {metrics.map((m) => (
              <div
                key={m.key}
                className={`min-w-0 overflow-hidden rounded-2xl px-4 py-3 ${
                  m.accent ? "bg-[#1aa6a6]/40" : "bg-white/10"
                }`}
              >
                <p className="text-xs font-semibold text-white">{m.label}</p>
                <div className="mt-1 break-words text-xl font-semibold tabular-nums leading-snug text-white">
                  {m.value}
                </div>
                {m.hint ? (
                  <p className="mt-0.5 text-[11px] font-medium leading-tight text-white/80">{m.hint}</p>
                ) : null}
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
                className="rounded-2xl bg-[var(--accent-fill)] py-3.5 text-base font-bold text-[var(--on-accent)]"
                onClick={primaryAction.onClick}
              >
                {primaryAction.label}
              </button>
            ) : null}
            {secondaryAction ? (
              <button
                type="button"
                className="rounded-2xl border border-white/35 py-3 text-sm font-semibold text-white"
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

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(stage, document.documentElement);
}
