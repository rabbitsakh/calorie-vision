"use client";

import { useCallback, useEffect, useState } from "react";
import { Mascot } from "@/components/Mascot";
import {
  getPushCapability,
  getPushPromptDismissed,
  setPushPromptDismissed,
} from "@/lib/push-client";
import { subscribeBrowserPush } from "@/lib/push-subscribe";

export function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hintOnly, setHintOnly] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const cap = getPushCapability();

    // Soft hint on iPhone when opened from Safari instead of Home Screen.
    if (cap.kind === "ios-browser" && !getPushPromptDismissed()) {
      setHintOnly(true);
      setHintText(cap.detail);
      setVisible(true);
      return;
    }

    if (!cap.canSubscribe || cap.permission !== "default") return;
    if (getPushPromptDismissed()) return;

    setHintOnly(false);
    setHintText(null);
    setVisible(true);
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await subscribeBrowserPush();
      if (result.ok) {
        setPushPromptDismissed(false);
        setVisible(false);
      } else {
        // Transient fetch/subscribe errors must not permanently dismiss the prompt.
        setError(result.error || "Не удалось подключить уведомления. Попробуйте ещё раз.");
      }
    } catch {
      setError("Не удалось подключить уведомления. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  }, []);


  function dismiss() {
    setPushPromptDismissed(true);
    setVisible(false);
  }

  if (!visible) return null;

  if (hintOnly) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4">
        <div className="flex items-start gap-3">
          <Mascot pose="tip" size="sm" className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-amber-950">Напоминания на iPhone</p>
            <p className="mt-1 text-sm text-amber-900">
              {hintText ??
                "Откройте приложение с иконки на Home Screen — из Safari push не приходит."}
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Статус можно проверить в разделе «Профиль».
            </p>
            <div className="mt-3">
              <button type="button" className="btn-quiet text-sm text-amber-800" onClick={dismiss}>
                Понятно
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/80 p-4">
      <div className="flex items-start gap-3">
        <Mascot pose="idle" size="sm" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-teal-900">Могу мягко напомнить</p>
          <p className="mt-1 text-sm text-teal-700">
            Завтрак, обед, вода, сводка калорий, серия и вечерний чек-ин — без давления.
          </p>
          {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-on-tint text-sm text-teal-800"
              disabled={loading}
              onClick={() => void subscribe()}
            >
              {loading ? "Подключаем…" : "Включить"}
            </button>
            <button type="button" className="btn-quiet text-sm text-teal-700" onClick={dismiss}>
              Не сейчас
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
