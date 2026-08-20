"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";
import { hidePanelToday, isPanelHiddenToday, showPanelToday } from "@/lib/panel-visibility";
import { pluralDays } from "@/lib/russian-text";

const PANEL_ID = "streak";

type StreakData = {
  streak: number;
  longestStreak: number;
  nextMilestone: number | null;
  daysUntilNext: number | null;
  last14: Array<{ date: string; logged: boolean }>;
  daysLoggedTotal: number;
};

function streakEmoji(streak: number): string {
  if (streak >= 100) return "🏆";
  if (streak >= 30) return "💎";
  if (streak >= 14) return "⚡";
  if (streak >= 7) return "🔥";
  if (streak >= 3) return "✨";
  return "🌱";
}

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

  useEffect(() => {
    setHidden(isPanelHiddenToday(PANEL_ID, selectedDate));
  }, [selectedDate]);

  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/streak?today=${selectedDate}`));
        if (!resp.ok) return;
        setData((await resp.json()) as StreakData);
      } catch {
        // non-critical
      }
    })();
  }, [selectedDate, refreshKey]);

  if (!data) return null;

  if (hidden) {
    return (
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-400 hover:border-slate-300"
        onClick={() => { showPanelToday(PANEL_ID, selectedDate); setHidden(false); }}
      >
        <span>
          {data.streak >= 1
            ? `${streakEmoji(data.streak)} ${data.streak} ${pluralDays(data.streak)} подряд`
            : data.daysLoggedTotal > 0
              ? "📅 Продолжите серию сегодня"
              : "📅 Начните серию сегодня"}
        </span>
        <span className="text-xs">Показать</span>
      </button>
    );
  }

  const { streak, longestStreak, nextMilestone, daysUntilNext, last14, daysLoggedTotal } = data;
  const isRecord = streak >= longestStreak && streak > 1;
  const hasStreak = streak >= 1;
  const progressPct = nextMilestone
    ? Math.round(((nextMilestone - daysUntilNext!) / nextMilestone) * 100)
    : 100;

  // Find the previous milestone for progress bar start
  const MILESTONES = [3, 7, 14, 30, 60, 100, 200, 365];
  const prevMilestone = MILESTONES.filter((m) => m <= streak).pop() ?? 0;
  const rangeStart = prevMilestone;
  const rangeEnd = nextMilestone ?? streak;
  const barPct = rangeEnd > rangeStart
    ? Math.round(((streak - rangeStart) / (rangeEnd - rangeStart)) * 100)
    : 100;

  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl leading-none">{hasStreak ? streakEmoji(streak) : "📅"}</span>
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
            className="text-xs text-amber-600 hover:text-amber-800"
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
              className="h-2 rounded-full bg-amber-500 transition-all"
              style={{ width: `${barPct}%` }}
            />
          </div>
        </div>
      ) : hasStreak && !nextMilestone ? (
        <p className="mt-2 text-sm font-semibold text-amber-800">
          🏆 Вы достигли {streak} дней! Невероятно!
        </p>
      ) : null}

      {/* Last 14 days mini-calendar */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs text-amber-700">Последние 14 дней</p>
        <div className="flex gap-0.5">
          {last14.map(({ date, logged }) => {
            const isToday = date === selectedDate;
            return (
              <div
                key={date}
                className="flex min-w-0 flex-1 flex-col items-center gap-0.5"
                title={`${date}: ${logged ? "есть записи" : "нет записей"}`}
              >
                <div
                  className={`h-6 w-full rounded-sm transition-colors ${
                    logged
                      ? isToday
                        ? "bg-amber-500"
                        : "bg-amber-400"
                      : isToday
                        ? "bg-amber-100 ring-1 ring-amber-400"
                        : "bg-amber-100"
                  }`}
                />
                <span className="text-[8px] font-medium leading-none text-amber-700">
                  {dayNum(date)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex gap-0.5">
          {last14.map(({ date }) => (
            <div key={`day-${date}`} className="min-w-0 flex-1 text-center">
              <span className="text-[7px] text-amber-600">{dayAbbr(date)}</span>
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
