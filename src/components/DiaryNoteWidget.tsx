"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";

const MOODS = [
  { value: 1, emoji: "😞", label: "Плохо" },
  { value: 2, emoji: "😕", label: "Не очень" },
  { value: 3, emoji: "😐", label: "Нормально" },
  { value: 4, emoji: "🙂", label: "Хорошо" },
  { value: 5, emoji: "😄", label: "Отлично" },
];

export function DiaryNoteWidget({ selectedDate }: { selectedDate: string }) {
  const [note, setNote] = useState("");
  const [mood, setMood] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath(`/api/diary-note?date=${selectedDate}`));
      if (!resp.ok) return;
      const data = (await resp.json()) as { note: { note: string; mood: number | null } | null };
      if (data.note) {
        setNote(data.note.note);
        setMood(data.note.mood);
        setOpen(true);
      } else {
        setNote("");
        setMood(null);
        setOpen(false);
      }
    } catch {
      // non-critical
    }
  }, [selectedDate]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(withBasePath("/api/diary-note"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, note, mood }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500 hover:border-slate-300 hover:bg-slate-50"
        onClick={() => setOpen(true)}
      >
        <span className="text-lg">📝</span>
        Добавить заметку о дне
      </button>
    );
  }

  return (
    <section className="card p-4 md:p-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Заметка о дне</h2>
        <button
          type="button"
          className="text-xs text-slate-400 hover:text-slate-600"
          onClick={() => { setOpen(false); setNote(""); setMood(null); void handleSave(); }}
        >
          Скрыть
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-3">
        <div className="flex gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              title={m.label}
              className={`flex-1 rounded-xl py-2 text-xl transition-all ${
                mood === m.value ? "bg-teal-100 ring-2 ring-teal-400" : "hover:bg-slate-100"
              }`}
              onClick={() => setMood(mood === m.value ? null : m.value)}
            >
              {m.emoji}
            </button>
          ))}
        </div>

        <textarea
          className="min-h-[80px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-teal-400 focus:outline-none"
          placeholder="Как прошёл день? Что повлияло на питание?"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-400">{note.length}/500</span>
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saved ? "Сохранено ✓" : saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </div>
    </section>
  );
}
