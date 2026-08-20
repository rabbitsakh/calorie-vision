"use client";

import { useCallback, useEffect, useState } from "react";
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
    try {
      const result = await subscribeBrowserPush();
      if (result.ok) {
        setPushPromptDismissed(false);
        setVisible(false);
      } else {
        // Keep banner; user can retry from profile.
        setVisible(false);
        setPushPromptDismissed(true);
      }
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
        <p className="font-semibold text-amber-950">Напоминания на iPhone</p>
        <p className="mt-1 text-sm text-amber-900">
          {hintText ??
            "Откройте приложение с иконки на Home Screen — из Safari push не приходит."}
        </p>
        <p className="mt-1 text-sm text-amber-800">
          Статус и повторное включение — в разделе «Профиль».
        </p>
        <div className="mt-3">
          <button type="button" className="btn-quiet text-sm text-amber-800" onClick={dismiss}>
            Понятно
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-teal-100 bg-teal-50/80 p-4">
      <p className="font-semibold text-teal-900">Включить напоминания?</p>
      <p className="mt-1 text-sm text-teal-700">
        Утром — про завтрак, днём — про воду, вечером — про серию записей.
      </p>
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
  );
}
