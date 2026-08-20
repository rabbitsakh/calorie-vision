"use client";

import { useCallback, useEffect, useState } from "react";
import { withBasePath } from "@/lib/paths";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

const DISMISS_KEY = "push-prompt-dismissed";

export function PushNotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission !== "default") return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      return;
    }
    setSupported(true);
    setVisible(true);
  }, []);

  const subscribe = useCallback(async () => {
    setLoading(true);
    try {
      const vapidResp = await fetch(withBasePath("/api/push/vapid"));
      if (!vapidResp.ok) {
        setVisible(false);
        return;
      }
      const { publicKey } = (await vapidResp.json()) as { publicKey: string };

      const registration = await navigator.serviceWorker.register(withBasePath("/sw.js"));
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const json = subscription.toJSON();
      await fetch(withBasePath("/api/push/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });

      setVisible(false);
    } catch {
      dismiss();
    } finally {
      setLoading(false);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!supported || !visible) return null;

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
        <button
          type="button"
          className="btn-quiet text-sm text-teal-700"
          onClick={dismiss}
        >
          Не сейчас
        </button>
      </div>
    </div>
  );
}
