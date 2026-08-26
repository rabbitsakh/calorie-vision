"use client";

import { useEffect, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { withBasePath } from "@/lib/paths";
import { localHour, resolvePushTimezone } from "@/lib/push-reminders";

const SEEN_PREFIX = "evening-checkin-";

const MOODS = [
  { value: 1, emoji: "😞", label: "Плохо" },
  { value: 2, emoji: "😕", label: "Не очень" },
  { value: 3, emoji: "😐", label: "Нормально" },
  { value: 4, emoji: "🙂", label: "Хорошо" },
  { value: 5, emoji: "😄", label: "Отлично" },
] as const;

function isSeen(date: string): boolean {
  try {
    return localStorage.getItem(`${SEEN_PREFIX}${date}`) === "1";
  } catch {
    return true;
  }
}

function markSeen(date: string): void {
  try {
    localStorage.setItem(`${SEEN_PREFIX}${date}`, "1");
  } catch {
    // ignore
  }
}

type EveningCheckinProps = {
  today: string;
  selectedDate: string;
  timezone?: string | null;
};

/** Short evening check-in: one mood tap by default (#38). */
export function EveningCheckin({ today, selectedDate, timezone }: EveningCheckinProps) {
  const day = useOptionalRationDay();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (selectedDate !== today) {
      setVisible(false);
      return;
    }
    if (isSeen(today)) {
      setVisible(false);
      return;
    }
    const hour = timezone
      ? localHour(resolvePushTimezone(timezone))
      : new Date().getHours();
    if (hour < 18) {
      setVisible(false);
      return;
    }

    if (day?.data && (day.data.date === today || day.today === today)) {
      if (day.data.diaryMood != null) {
        markSeen(today);
        setVisible(false);
      } else {
        setVisible(true);
      }
      return;
    }

    if (day && day.today === today && day.loading) {
      return;
    }

    void (async () => {
      try {
        const resp = await fetch(withBasePath(`/api/diary-note?date=${today}`));
        if (!resp.ok) {
          setVisible(true);
          return;
        }
        const data = (await resp.json()) as { note: { mood: number | null } | null };
        if (data.note?.mood != null) {
          markSeen(today);
          setVisible(false);
        } else {
          setVisible(true);
        }
      } catch {
        setVisible(true);
      }
    })();
  }, [today, selectedDate, timezone, day]);

  async function chooseMood(mood: number) {
    setSaving(true);
    try {
      const existingResp = await fetch(withBasePath(`/api/diary-note?date=${today}`));
      let existingNote = "";
      if (existingResp.ok) {
        const data = (await existingResp.json()) as { note: { note: string } | null };
        existingNote = data.note?.note?.trim() ?? "";
      }

      const note =
        existingNote && !existingNote.startsWith("Вечерний чек-in:")
          ? existingNote
          : "Вечерний чек-in: настроение";

      await fetch(withBasePath("/api/diary-note"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, note, mood }),
      });

      markSeen(today);
      setDone(true);
      setTimeout(() => setVisible(false), 1200);
    } finally {
      setSaving(false);
    }
  }

  function dismiss() {
    markSeen(today);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      {done ? (
        <p className="text-center text-sm font-medium text-slate-700">Спасибо! До завтра.</p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-slate-800">Как настроение?</p>
              <p className="text-xs text-slate-500">Один тап — и день закрыт</p>
            </div>
            <button type="button" className="btn-quiet text-xs text-slate-500" onClick={dismiss}>
              Позже
            </button>
          </div>
          <div className="mt-3 flex justify-between gap-1">
            {MOODS.map((mood) => (
              <button
                key={mood.value}
                type="button"
                disabled={saving}
                title={mood.label}
                aria-label={mood.label}
                className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white px-1 py-2.5 text-xl transition-colors hover:border-teal-300 hover:bg-teal-50 disabled:opacity-60"
                onClick={() => void chooseMood(mood.value)}
              >
                <span aria-hidden>{mood.emoji}</span>
                <span className="text-[10px] font-medium leading-tight text-slate-500">
                  {mood.label}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
