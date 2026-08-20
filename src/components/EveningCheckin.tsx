"use client";

import { useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";

const SEEN_PREFIX = "evening-checkin-";

type Choice = {
  id: "ok" | "over" | "skip";
  label: string;
  mood: number;
  note: string;
};

const CHOICES: Choice[] = [
  { id: "ok", label: "Норм", mood: 4, note: "Вечерний чек-in: норм" },
  { id: "over", label: "Перебрал", mood: 3, note: "Вечерний чек-in: перебрал" },
  { id: "skip", label: "Не записывал", mood: 2, note: "Вечерний чек-in: не записывал" },
];

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

/** Local hour 0–23 for optional evening gating. */
function localHour(): number {
  return new Date().getHours();
}

type EveningCheckinProps = {
  today: string;
  selectedDate: string;
};

export function EveningCheckin({ today, selectedDate }: EveningCheckinProps) {
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
    // Show from 18:00, or always if user opens ration late / testing via ? — keep 18+
    if (localHour() < 18) {
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
  }, [today, selectedDate]);

  async function choose(choice: Choice) {
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
          : choice.note;

      await fetch(withBasePath("/api/diary-note"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, note, mood: choice.mood }),
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
              <p className="font-semibold text-slate-800">Как прошёл день?</p>
              <p className="text-xs text-slate-500">30 секунд — без оценок и стыда</p>
            </div>
            <button type="button" className="btn-quiet text-xs text-slate-500" onClick={dismiss}>
              Позже
            </button>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {CHOICES.map((choice) => (
              <button
                key={choice.id}
                type="button"
                disabled={saving}
                className="rounded-xl border border-slate-200 bg-white px-2 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-teal-300 hover:bg-teal-50 disabled:opacity-60"
                onClick={() => void choose(choice)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
