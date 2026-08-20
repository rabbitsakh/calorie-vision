"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";

const PANEL_ID = "challenge";

type ChallengeOption = {
  key: string;
  title: string;
  description: string;
  target: number;
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
};

type WeeklyChallengeProps = {
  selectedDate: string;
  refreshKey: number;
};

export function WeeklyChallenge({ selectedDate, refreshKey }: WeeklyChallengeProps) {
  const [data, setData] = useState<ChallengesResponse | null>(null);
  const [hidden, setHidden] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/challenges"));
      if (!resp.ok) return;
      setData((await resp.json()) as ChallengesResponse);
    } catch {
      // non-critical
    }
  }, []);

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

  if (!data) return null;

  if (hidden) {
    return (
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
    );
  }

  return (
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
          <div className="mt-2 flex items-center justify-between text-xs text-emerald-800">
            <span>
              {data.active.progress} / {data.active.target}
            </span>
            {data.active.completed ? (
              <span className="font-semibold">Выполнено!</span>
            ) : null}
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
              style={{
                width: `${Math.min(100, Math.round((data.active.progress / data.active.target) * 100))}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
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
              {starting === opt.key ? (
                <span className="text-xs text-emerald-700">Стартуем…</span>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
