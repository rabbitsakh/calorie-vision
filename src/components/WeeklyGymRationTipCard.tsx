"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { assistantWeekLink } from "@/lib/push-deeplink";
import { withBasePath } from "@/lib/paths";
import {
  hidePanelForWeek,
  isPanelHiddenForWeek,
  showPanelForWeek,
} from "@/lib/panel-visibility";

const PANEL_ID = "weekly-gym-ration-tip";

type DigestPayload = {
  weekStart: string;
  weekEnd: string;
  weekLabel: string;
  digest: { headline: string; steps: string[] } | null;
  tip: string | null;
  source: "rules" | "gigachat";
};

type Props = {
  endDate: string;
  /** Flat inside plan-week fold. */
  embedded?: boolean;
};

export function WeeklyGymRationTipCard({ endDate, embedded = false }: Props) {
  const [data, setData] = useState<DigestPayload | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/weekly-digest-tip?end=${endDate}`));
        if (!resp.ok) return;
        const json = (await resp.json()) as DigestPayload;
        setData(json);
        if (json.weekStart) {
          setHidden(isPanelHiddenForWeek(PANEL_ID, json.weekStart));
        }
      } catch {
        // non-critical
      }
    })();
  }, [endDate]);

  if (!data?.digest || data.digest.steps.length === 0) return null;

  if (hidden) {
    return (
      <button
        type="button"
        className="mb-3 flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-[var(--accent)]/25 px-4 py-2.5 text-sm text-[var(--accent-ink)] hover:border-[var(--accent)]/40"
        onClick={() => {
          showPanelForWeek(PANEL_ID, data.weekStart);
          setHidden(false);
        }}
      >
        <span>Фокус недели — {data.weekLabel}</span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  const { headline, steps } = data.digest;
  const showTip =
    data.tip &&
    data.tip.trim().length >= 12 &&
    !steps.some((s) => s === data.tip || s.startsWith(data.tip!.slice(0, 24)));

  return (
    <section
      className={
        embedded
          ? "mb-4 border-b border-[var(--border-hairline)] pb-4"
          : "mb-3 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)]/70 p-4"
      }
      aria-label={headline}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-xs font-semibold uppercase tracking-widest ${
              embedded ? "text-[var(--accent-ink)]/80" : "text-[var(--accent-ink)]"
            }`}
          >
            Следующая неделя
          </p>
          <p
            className={`mt-1 font-semibold leading-snug ${
              embedded ? "text-[var(--foreground)]" : "text-[var(--accent-ink)]"
            }`}
          >
            {headline}
          </p>
        </div>
        <button
          type="button"
          className="btn-quiet shrink-0 text-xs text-[var(--accent-ink)] hover:bg-[var(--accent-soft)]"
          onClick={() => {
            hidePanelForWeek(PANEL_ID, data.weekStart);
            setHidden(true);
          }}
        >
          Скрыть
        </button>
      </div>

      <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-sm leading-snug text-[var(--muted-strong)]">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>

      {showTip ? (
        <p className="mt-2.5 text-xs leading-relaxed text-[var(--accent-ink)]/75">{data.tip}</p>
      ) : null}

      <Link
        href={assistantWeekLink({
          prefill: `По итогам недели: ${headline}. Помоги спланировать следующую: рацион + зал.`,
        })}
        className="mt-3 inline-flex rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--accent-hover)]"
      >
        Разобрать с AI
      </Link>
    </section>
  );
}
