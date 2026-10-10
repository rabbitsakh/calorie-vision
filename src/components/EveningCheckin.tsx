"use client";

import { useEffect, useState } from "react";
import { useOptionalRationDay } from "@/components/RationDayProvider";
import { isLikelyOfflineError } from "@/lib/connectivity";
import { enqueueDiaryNoteDraft } from "@/lib/diary-note-draft-queue";
import { withBasePath } from "@/lib/paths";
import { quietHoursLocalHour, syncQuietHoursTimezone } from "@/lib/quiet-hours-prefs";
import { applyOptimisticDiaryMood } from "@/lib/ration-day-cache-optimistic";
import { readRationDayCache } from "@/lib/ration-day-cache";

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

/** Short evening check-in: one mood tap by default (#38). Wave U — works offline. */
export function EveningCheckin({ today, selectedDate, timezone }: EveningCheckinProps) {
  const day = useOptionalRationDay();
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [queuedOffline, setQueuedOffline] = useState(false);

  useEffect(() => {
    if (selectedDate !== today) {
      setVisible(false);
      return;
    }
    if (isSeen(today)) {
      setVisible(false);
      return;
    }
    if (timezone) {
      syncQuietHoursTimezone(timezone);
    }
    // Account quiet-hours TZ (same as celebrations / MotivationTip), not device wall clock alone.
    const hour = quietHoursLocalHour();
    // Align with streak (20) / check-in push (21) — dinner hour stays free for logging.
    if (hour < 20) {
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

    // Offline: trust ration-day cache for mood before hitting the network.
    const cachedMood = readRationDayCache(today)?.diaryMood;
    if (cachedMood != null) {
      markSeen(today);
      setVisible(false);
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

  function finishLocal(mood: number, offline: boolean) {
    try {
      applyOptimisticDiaryMood(today, mood);
    } catch {
      // ignore
    }
    markSeen(today);
    setQueuedOffline(offline);
    setDone(true);
    setTimeout(() => setVisible(false), offline ? 1600 : 1200);
  }

  async function chooseMood(mood: number) {
    setSaving(true);
    setQueuedOffline(false);
    const fallbackNote = "Вечерний чек-in: настроение";
    try {
      let existingNote = "";
      try {
        const existingResp = await fetch(withBasePath(`/api/diary-note?date=${today}`));
        if (existingResp.ok) {
          const data = (await existingResp.json()) as { note: { note: string } | null };
          existingNote = data.note?.note?.trim() ?? "";
        }
      } catch (err) {
        if (isLikelyOfflineError(err)) {
          enqueueDiaryNoteDraft({ date: today, note: fallbackNote, mood });
          finishLocal(mood, true);
          return;
        }
      }

      const note =
        existingNote && !existingNote.startsWith("Вечерний чек-in:")
          ? existingNote
          : fallbackNote;

      const putResp = await fetch(withBasePath("/api/diary-note"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, note, mood }),
      });
      if (!putResp.ok) {
        throw new Error("save failed");
      }

      finishLocal(mood, false);
    } catch (err) {
      if (isLikelyOfflineError(err) || err instanceof TypeError) {
        enqueueDiaryNoteDraft({ date: today, note: fallbackNote, mood });
        finishLocal(mood, true);
      } else {
        // Soft fail — still close locally so the ritual isn't blocked.
        enqueueDiaryNoteDraft({ date: today, note: fallbackNote, mood });
        finishLocal(mood, true);
      }
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
    <div id="checkin" className="scroll-mt-3 rounded-2xl border border-[rgba(13,115,119,0.14)] bg-[var(--surface-mist)] p-4">
      {done ? (
        <div className="text-center">
          <p className="text-sm font-semibold text-[var(--foreground)]">День закрыт</p>
          <p className="mt-0.5 text-sm text-[var(--muted-strong)]">
            {queuedOffline
              ? "Настроение на устройстве — отправим при связи. До завтра."
              : "Спасибо! До завтра."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-[var(--foreground)]">Как настроение?</p>
              <p className="text-xs text-[var(--muted)]">Один тап — мягко закрыть день</p>
            </div>
            <button type="button" className="btn-quiet text-xs text-[var(--muted)]" onClick={dismiss}>
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
                className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-[rgba(13,115,119,0.14)] bg-white px-1 py-2.5 text-xl transition-colors hover:border-teal-300 hover:bg-teal-50 disabled:opacity-60"
                onClick={() => void chooseMood(mood.value)}
              >
                <span aria-hidden>{mood.emoji}</span>
                <span className="text-[10px] font-medium leading-tight text-[var(--muted)]">
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
