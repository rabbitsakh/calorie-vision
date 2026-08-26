"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clampHour,
  formatEatingWindowLabel,
} from "@/lib/fasting-window";
import { withBasePath } from "@/lib/paths";

export function FastingWindowSettings() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const load = useCallback(async () => {
    try {
      const resp = await fetch(withBasePath("/api/account"));
      if (!resp.ok) return;
      const data = (await resp.json()) as {
        fastingStartHour?: number | null;
        fastingEndHour?: number | null;
      };
      const s = data.fastingStartHour;
      const e = data.fastingEndHour;
      if (s != null && e != null && s !== e) {
        setEnabled(true);
        setStart(String(s));
        setEnd(String(e));
      } else {
        setEnabled(false);
        setStart("12");
        setEnd("20");
      }
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(nextEnabled: boolean, nextStart: string, nextEnd: string) {
    setSaving(true);
    setError(null);
    setMessage(null);
    let startHour: number | null = null;
    let endHour: number | null = null;
    if (nextEnabled) {
      startHour = clampHour(nextStart);
      endHour = clampHour(nextEnd);
      if (startHour === null || endHour === null) {
        setError("Укажите часы от 0 до 23");
        setSaving(false);
        return;
      }
      if (startHour === endHour) {
        setError("Начало и конец окна не должны совпадать");
        setSaving(false);
        return;
      }
    }
    try {
      const resp = await fetch(withBasePath("/api/account"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fastingStartHour: startHour,
          fastingEndHour: endHour,
        }),
      });
      const data = (await resp.json()) as {
        error?: string;
        fastingStartHour?: number | null;
        fastingEndHour?: number | null;
      };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось сохранить");
      } else {
        const on =
          data.fastingStartHour != null &&
          data.fastingEndHour != null &&
          data.fastingStartHour !== data.fastingEndHour;
        setEnabled(on);
        if (on) {
          setStart(String(data.fastingStartHour));
          setEnd(String(data.fastingEndHour));
        }
        setMessage(
          on
            ? `Окно питания: ${formatEatingWindowLabel(data.fastingStartHour, data.fastingEndHour)}`
            : "Окно питания выключено",
        );
      }
    } catch {
      setError("Не удалось сохранить");
    }
    setSaving(false);
  }

  return (
    <section className="card p-4 md:p-5">
      <h2 className="font-display text-base font-semibold text-slate-800">
        Окно питания
      </h2>
      <p className="mt-1 text-sm text-slate-500">
        Мягкая подсказка по времени еды на рационе. Не медицинский совет и не интервальное
        голодание «по протоколу».
      </p>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={enabled}
          disabled={saving}
          onChange={(e) => {
            const on = e.target.checked;
            setEnabled(on);
            void save(on, start || "12", end || "20");
          }}
          className="h-4 w-4 rounded border-slate-300"
        />
        Показывать подсказку вне окна
      </label>

      {enabled ? (
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="field w-24">
            <label className="text-xs">С (час)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={start}
              onChange={(e) => setStart(e.target.value)}
              disabled={saving}
            />
          </div>
          <div className="field w-24">
            <label className="text-xs">До (час)</label>
            <input
              type="number"
              min={0}
              max={23}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              disabled={saving}
            />
          </div>
          <button
            type="button"
            className="btn btn-on-tint text-sm text-teal-800"
            disabled={saving}
            onClick={() => void save(true, start, end)}
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
      ) : null}

      {message ? <p className="mt-2 text-xs text-teal-700">{message}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
