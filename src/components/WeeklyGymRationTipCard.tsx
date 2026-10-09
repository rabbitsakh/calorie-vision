"use client";

import { useEffect, useState } from "react";
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
        className="mb-3 flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-teal-200 px-4 py-2.5 text-sm text-teal-700 hover:border-teal-300"
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
          : "mb-3 rounded-2xl border border-teal-100 bg-teal-50/70 p-4"
      }
      aria-label={headline}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-xs font-semibold uppercase tracking-widest ${
              embedded ? "text-teal-800/80" : "text-teal-700"
            }`}
          >
            Следующая неделя
          </p>
          <p
            className={`mt-1 font-semibold leading-snug ${
              embedded ? "text-[var(--foreground)]" : "text-teal-950"
            }`}
          >
            {headline}
          </p>
        </div>
        <button
          type="button"
          className="btn-quiet shrink-0 text-xs text-teal-800 hover:bg-teal-100"
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
        <p className="mt-2.5 text-xs leading-relaxed text-teal-900/75">{data.tip}</p>
      ) : null}
    </section>
  );
}
