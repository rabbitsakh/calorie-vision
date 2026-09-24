"use client";

import { detectDeviceTimezone } from "@/lib/device-timezone";
import { isCapacitorNative } from "@/lib/capacitor-bridge";
import {
  enableCapacitorLocalReminders,
  fireCapacitorTestReminder,
} from "@/lib/capacitor-local-reminders";
import { withBasePath } from "@/lib/paths";
import { urlBase64ToUint8Array } from "@/lib/push-client";
import type { PushReminderPrefs } from "@/lib/push-reminder-schedule";
import { clearTimezoneCache } from "@/lib/use-timezone";

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; error: string };

export type SubscribePushOptions = {
  prefs?: PushReminderPrefs | null;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
};

/**
 * Register the service worker, request permission if needed, and upsert
 * the push subscription on the server. On Capacitor APK — LocalNotifications.
 */
export async function subscribeBrowserPush(
  options: SubscribePushOptions = {},
): Promise<PushSubscribeResult> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Недоступно на сервере" };
  }

  if (isCapacitorNative()) {
    return enableCapacitorLocalReminders(
      options.prefs,
      options.quietHoursStart,
      options.quietHoursEnd,
    );
  }

  if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, error: "Web Push не поддерживается в этом браузере" };
  }

  try {
    if (Notification.permission === "denied") {
      return { ok: false, error: "Уведомления запрещены в настройках" };
    }

    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        return {
          ok: false,
          error:
            permission === "denied"
              ? "Уведомления запрещены"
              : "Разрешение не получено",
        };
      }
    }

    const vapidResp = await fetch(withBasePath("/api/push/vapid"));
    if (!vapidResp.ok) {
      return { ok: false, error: "Сервер уведомлений не настроен" };
    }
    const { publicKey } = (await vapidResp.json()) as { publicKey: string };
    if (!publicKey) {
      return { ok: false, error: "Нет VAPID-ключа" };
    }

    const registration = await navigator.serviceWorker.register(withBasePath("/sw.js"));
    await navigator.serviceWorker.ready;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, error: "Браузер вернул неполную подписку" };
    }

    const timezone = detectDeviceTimezone();
    const saveResp = await fetch(withBasePath("/api/push/subscribe"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
        ...(timezone ? { timezone } : {}),
      }),
    });

    if (!saveResp.ok) {
      const data = (await saveResp.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? "Не удалось сохранить подписку" };
    }

    if (timezone) clearTimezoneCache(timezone);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка подписки";
    return { ok: false, error: message };
  }
}

export async function testPushDelivery(): Promise<PushSubscribeResult> {
  if (isCapacitorNative()) {
    return fireCapacitorTestReminder();
  }
  try {
    const resp = await fetch(withBasePath("/api/push/test"), { method: "POST" });
    const data = (await resp.json()) as { message?: string; error?: string };
    if (!resp.ok) {
      return { ok: false, error: data.error ?? "Не удалось отправить тест" };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Не удалось отправить тест" };
  }
}
