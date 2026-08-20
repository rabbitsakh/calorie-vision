"use client";

import { withBasePath } from "@/lib/paths";
import { urlBase64ToUint8Array } from "@/lib/push-client";

export type PushSubscribeResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Register the service worker, request permission if needed, and upsert
 * the push subscription on the server.
 */
export async function subscribeBrowserPush(): Promise<PushSubscribeResult> {
  if (typeof window === "undefined") {
    return { ok: false, error: "Недоступно на сервере" };
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

    const saveResp = await fetch(withBasePath("/api/push/subscribe"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });

    if (!saveResp.ok) {
      const data = (await saveResp.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? "Не удалось сохранить подписку" };
    }

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка подписки";
    return { ok: false, error: message };
  }
}
