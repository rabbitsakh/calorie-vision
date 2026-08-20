"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";
import { pluralDays } from "@/lib/russian-text";
import { StreakGlyph } from "@/components/StreakIcon";
import { MilestoneCelebration } from "@/components/MilestoneCelebration";

const PANEL_ID = "streak";

type StreakData = {
  streak: number;
  longestStreak: number;
  nextMilestone: number | null;
  daysUntilNext: number | null;
  last14: Array<{ date: string; logged: boolean; frozen?: boolean }>;
  daysLoggedTotal: number;
  canFreezeYesterday?: boolean;
  freezeAvailable?: boolean;
  streakAtRisk?: boolean;
};

function streakLabel(streak: number): string {
  if (streak >= 100) return "Легенда!";
  if (streak >= 30) return "Мастер привычки";
  if (streak >= 14) return "Две недели!";
  if (streak >= 7) return "Неделя без пропусков";
  if (streak >= 3) return "Хорошее начало";
  return "Начните сегодня";
}

function dayAbbr(dateKey: string): string {
  const days = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const d = new Date(dateKey + "T12:00:00Z");
  return days[d.getUTCDay()] ?? "";
}

function dayNum(dateKey: string): string {
  return String(new Date(dateKey + "T12:00:00Z").getUTCDate());
}

export function StreakWidget({
  selectedDate,
  refreshKey,
}: {
  selectedDate: string;
  refreshKey: number;
}) {
  const [data, setData] = useState<StreakData | null>(null);
  const [hidden, setHidden] = useState(false);
  const [freezing, setFreezing] = useState(false);

  async function loadStreak() {
    try {
      const resp = await fetch(withBasePath(`/api/streak?today=${selectedDate}`));
      if (!resp.ok) return;
      setData((await resp.json()) as StreakData);
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    void loadStreak();
  }, [selectedDate, refreshKey]);

  async function useFreeze() {
    if (!data?.canFreezeYesterday || freezing) return;
    const yesterday = (() => {
      const d = new Date(selectedDate + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

    setFreezing(true);
    try {
      const resp = await fetch(withBasePath("/api/streak"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: yesterday, today: selectedDate }),
      });
      if (resp.ok) {
        await loadStreak();
      }
    } finally {
      setFreezing(false);
    }
  }

  if (!data) return null;

  if (hidden) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-400 hover:border-slate-300"
        onClick={() => { showPanelToday(PANEL_ID, selectedDate); setHidden(false); }}
      >
        <span className="flex items-center gap-1.5">
          <StreakGlyph streak={data.streak} className="h-4 w-4" />
          {data.streak >= 1
            ? `${data.streak} ${pluralDays(data.streak)} подряд`
            : data.daysLoggedTotal > 0
              ? "Продолжите серию сегодня"
              : "Начните серию сегодня"}
        </span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  const { streak, longestStreak, nextMilestone, daysUntilNext, last14, daysLoggedTotal } = data;
  const isRecord = streak >= longestStreak && streak > 1;
  const hasStreak = streak >= 1;

  // Find the previous milestone for progress bar start
  const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];
  const prevMilestone = MILESTONES.filter((m) => m <= streak).pop() ?? 0;
  const rangeStart = prevMilestone;
  const rangeEnd = nextMilestone ?? streak;
  const barPct = rangeEnd > rangeStart
    ? Math.round(((streak - rangeStart) / (rangeEnd - rangeStart)) * 100)
    : 100;

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
      {hasStreak ? <MilestoneCelebration streak={streak} /> : null}
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StreakGlyph streak={hasStreak ? streak : 0} />
          <div>
            <p className="text-lg font-bold text-amber-900">
              {hasStreak
                ? `${streak} ${pluralDays(streak)} подряд`
                : daysLoggedTotal > 0 ? "Продолжите серию сегодня" : "Начните серию сегодня"}
            </p>
            <p className="text-xs text-amber-700">
              {hasStreak
                ? streakLabel(streak)
                : daysLoggedTotal > 0
                  ? `Лучший результат: ${longestStreak} ${pluralDays(longestStreak)}. Добавьте еду — и серия возобновится`
                  : "Добавьте первый приём пищи — и серия начнётся"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasStreak && isRecord ? (
            <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
              Рекорд!
            </span>
          ) : hasStreak && longestStreak > streak ? (
            <span className="shrink-0 text-right text-xs text-amber-700">
              Рекорд: {longestStreak} {pluralDays(longestStreak)}
            </span>
          ) : null}
          <button
            type="button"
            className="btn-quiet text-amber-700 hover:bg-amber-100 hover:text-amber-900"
            onClick={() => { hidePanelToday(PANEL_ID, selectedDate); setHidden(true); }}
          >
            Скрыть
          </button>
        </div>
      </div>

      {/* Progress to next milestone */}
      {hasStreak && nextMilestone ? (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-amber-700">
            <span>До {nextMilestone} дней</span>
            <span>{daysUntilNext} {pluralDays(daysUntilNext ?? 0)} осталось</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-amber-200">
            <div
              className="h-2 rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${barPct}%` }}
            />
          </div>
        </div>
      ) : hasStreak && !nextMilestone ? (
        <p className="mt-2 text-sm font-semibold text-amber-800">
          🏆 Вы достигли {streak} дней! Невероятно!
        </p>
      ) : null}

      {data.canFreezeYesterday ? (
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
          <p className="text-sm text-sky-900">
            Вчера не было записей — серия под угрозой. Используйте заморозку (1 раз в неделю)?
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-sky-800 hover:text-sky-950 disabled:opacity-60"
            disabled={freezing}
            onClick={() => void useFreeze()}
          >
            {freezing ? "Сохраняем…" : "❄️ Заморозить вчера"}
          </button>
        </div>
      ) : data.freezeAvailable && data.streakAtRisk ? null : data.freezeAvailable ? (
        <p className="mt-2 text-xs text-sky-700">❄️ Заморозка доступна на этой неделе</p>
      ) : null}

      {/* Last 14 days mini-calendar */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs text-amber-700">Последние 14 дней</p>
        <div className="flex gap-0.5">
          {last14.map(({ date, logged, frozen }) => {
            const isToday = date === selectedDate;
            const active = logged || frozen;
            return (
              <div
                key={date}
                className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
                title={`${date}: ${logged ? "есть записи" : frozen ? "заморожено" : "нет записей"}`}
              >
                <div
                  className={`h-6 w-full rounded-sm transition-colors ${
                    active
                      ? frozen && !logged
                        ? isToday
                          ? "bg-sky-500"
                          : "bg-sky-400"
                        : isToday
                          ? "bg-amber-500"
                          : "bg-amber-400"
                      : isToday
                        ? "bg-amber-100 ring-1 ring-amber-400"
                        : "bg-amber-100"
                  }`}
                />
                <span className="text-xs font-medium leading-none text-amber-700">
                  {dayNum(date)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-0.5">
          {last14.map(({ date }) => (
            <div key={`day-${date}`} className="min-w-0 flex-1 text-center">
              <span className="text-xs text-amber-600">{dayAbbr(date)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Total stats */}
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-amber-700">
          Всего дней с записями: <span className="font-semibold">{daysLoggedTotal}</span>
        </p>
        {longestStreak >= 7 && !isRecord ? (
          <p className="text-xs text-amber-600">Лучший: {longestStreak} дней</p>
        ) : null}
      </div>
    </div>
  );
}
