"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SoftCelebration } from "@/components/SoftCelebration";
import {
  isSoftCelebrationSeen,
  isSoftCelebrationsMutedToday,
  markSoftCelebrationSeen,
} from "@/lib/soft-celebration";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";
import { toDateKey } from "@/lib/dates";

const PANEL_ID = "challenge";

type ChallengeOption = {
  key: string;
  title: string;
  description: string;
  target: number;
  tight?: boolean;
  daysLeft?: number;
};

type ActiveChallenge = {
  challengeKey: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  completed: boolean;
  weekStart: string;
};

type ChallengesResponse = {
  active: ActiveChallenge | null;
  options: ChallengeOption[];
  weekStart: string;
  daysLeft?: number;
};

type WeeklyChallengeProps = {
  selectedDate: string;
  refreshKey: number;
  /** One-line strip for collapsed habits accordion. */
  mini?: boolean;
};

export function WeeklyChallenge({ selectedDate, refreshKey, mini = false }: WeeklyChallengeProps) {
  const [data, setData] = useState<ChallengesResponse | null>(null);
  const [hidden, setHidden] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const prevCompleted = useRef<boolean | null>(null);
  const todayKey = toDateKey(new Date());

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  const closeCelebrate = useCallback(() => setCelebrate(false), []);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/challenges"));
      if (!resp.ok) return;
      const next = (await resp.json()) as ChallengesResponse;
      setData(next);

      const active = next.active;
      if (!active) {
        prevCompleted.current = null;
        return;
      }

      const doneKey = `${active.weekStart}-${active.challengeKey}`;
      const justCompleted = prevCompleted.current === false && active.completed;
      const firstSightDone =
        prevCompleted.current === null &&
        active.completed &&
        !isSoftCelebrationSeen("challenge-done", doneKey);

      if (
        (justCompleted || firstSightDone) &&
        !isSoftCelebrationSeen("challenge-done", doneKey) &&
        !isSoftCelebrationsMutedToday(todayKey)
      ) {
        markSoftCelebrationSeen("challenge-done", doneKey);
        setCelebrate(true);
      }

      prevCompleted.current = active.completed;
    } catch {
      // non-critical
    }
  }, [todayKey]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function start(key: string) {
    setStarting(key);
    try {
      const resp = await fetch(withBasePath("/api/challenges"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeKey: key }),
      });
      if (resp.ok) await load();
    } finally {
      setStarting(null);
    }
  }

  const celebration = (
    <SoftCelebration
      open={celebrate}
      variant="challenge"
      pose="goal"
      title="Челлендж закрыт!"
      subtitle={
        data?.active
          ? `${data.active.title} — неделя в копилку.`
          : "Отличная работа на этой неделе."
      }
      badge="✓"
      durationMs={0}
      ctaLabel="Супер!"
      muteDate={todayKey}
      onClose={closeCelebrate}
    />
  );

  if (!data) return celebration;

  if (mini) {
    const active = data.active;
    const label = active
      ? active.completed
        ? `${active.title} ✓`
        : `${active.progress}/${active.target}`
      : "Выбрать цель";
    return (
      <>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-900">
          <span className="truncate" title={active?.title ?? "Челлендж недели"}>
            {active ? active.title : "Челлендж"} · {label}
          </span>
        </div>
        {celebration}
      </>
    );
  }

  if (hidden) {
    return (
      <>
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-emerald-200 px-4 py-2.5 text-sm text-emerald-700 hover:border-emerald-300"
          onClick={() => {
            showPanelToday(PANEL_ID, selectedDate);
            setHidden(false);
          }}
        >
          <span>Челлендж недели</span>
          <span className="text-xs">Показать</span>
        </button>
        {celebration}
      </>
    );
  }

  const daysLeft = data.daysLeft ?? data.options[0]?.daysLeft;

  return (
    <>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-emerald-900">Челлендж недели</p>
            <p className="text-xs text-emerald-700">Одна цель на 7 дней — без перфекционизма</p>
          </div>
          <button
            type="button"
            className="btn-quiet text-xs text-emerald-700 hover:bg-emerald-100"
            onClick={() => {
              hidePanelToday(PANEL_ID, selectedDate);
              setHidden(true);
            }}
          >
            Скрыть
          </button>
        </div>

        {data.active ? (
          <div>
            <p className="font-medium text-slate-800">{data.active.title}</p>
            <p className="text-xs text-slate-500">{data.active.description}</p>
            {(() => {
              const pct = Math.min(
                100,
                Math.round((data.active.progress / Math.max(1, data.active.target)) * 100),
              );
              return (
                <>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="text-sm font-semibold tabular-nums text-emerald-900">
                      {data.active.progress}
                      <span className="font-normal text-emerald-700"> / {data.active.target}</span>
                    </span>
                    <span className="text-sm font-bold tabular-nums text-emerald-800">
                      {data.active.completed ? "Выполнено!" : `${pct}%`}
                    </span>
                  </div>
                  <div
                    className="mt-2 h-4 overflow-hidden rounded-full bg-emerald-200/90 ring-1 ring-inset ring-emerald-300/80"
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`Прогресс челленджа: ${pct}%`}
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        data.active.completed
                          ? "bg-emerald-600"
                          : "bg-gradient-to-r from-emerald-500 to-teal-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {typeof daysLeft === "number" && daysLeft < 7 ? (
              <p className="text-xs text-amber-800">
                До конца недели {daysLeft}{" "}
                {daysLeft === 1 ? "день" : daysLeft < 5 ? "дня" : "дней"} — цели на 7 дней могут не
                успеть без записей с понедельника.
              </p>
            ) : null}
            {data.options.map((opt) => (
              <button
                key={opt.key}
                type="button"
                disabled={starting !== null}
                className="rounded-xl border border-emerald-100 bg-white px-3 py-2.5 text-left hover:border-emerald-300 disabled:opacity-60"
                onClick={() => void start(opt.key)}
              >
                <p className="text-sm font-medium text-slate-800">{opt.title}</p>
                <p className="text-xs text-slate-500">{opt.description}</p>
                {opt.tight ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Сложно успеть: до конца недели меньше дней, чем нужно
                  </p>
                ) : null}
                {starting === opt.key ? (
                  <span className="text-xs text-emerald-700">Стартуем…</span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>
      {celebration}
    </>
  );
}
