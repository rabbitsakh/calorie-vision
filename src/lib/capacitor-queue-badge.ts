/**
 * Wave X — mirror offline draft count onto the APK icon badge (iOS)
 * and a quiet Android notification so the queue is visible after resume.
 */

import { isApkWebView } from "@/lib/capacitor-resume";
import { countAllOfflineDrafts } from "@/lib/offline-draft-count";

export const OFFLINE_QUEUE_BADGE_NOTIF_ID = 9120;
export const OFFLINE_QUEUE_CHANNEL_ID = "cv-offline-queue";

let lastSynced = -1;

async function hasLocalNotifications(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Boolean(Capacitor.isPluginAvailable("LocalNotifications"));
  } catch {
    return false;
  }
}

async function ensureChannel(): Promise<void> {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  try {
    await LocalNotifications.createChannel({
      id: OFFLINE_QUEUE_CHANNEL_ID,
      name: "Офлайн-очередь",
      description: "Черновики, которые ждут связь с сервером",
      importance: 2,
      visibility: 0,
      sound: undefined,
      vibration: false,
    });
  } catch {
    // channel may already exist / web
  }
}

function badgeCopy(count: number): { title: string; body: string } {
  if (count === 1) {
    return {
      title: "1 черновик на устройстве",
      body: "Откройте приложение — отправим при связи",
    };
  }
  return {
    title: `${count} черновика на устройстве`,
    body: "Еда, вода, вес или зал ждут отправку",
  };
}

/** Sync launcher badge / quiet notification to the current offline queue size. */
export async function syncCapacitorOfflineQueueBadge(
  count = countAllOfflineDrafts(),
): Promise<void> {
  if (!isApkWebView()) return;
  if (!(await hasLocalNotifications())) return;
  if (count === lastSynced) return;

  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await ensureChannel();

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: OFFLINE_QUEUE_BADGE_NOTIF_ID }],
    });
  } catch {
    // ignore
  }

  if (count <= 0) {
    lastSynced = 0;
    return;
  }

  const copy = badgeCopy(count);
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: OFFLINE_QUEUE_BADGE_NOTIF_ID,
          title: copy.title,
          body: copy.body,
          channelId: OFFLINE_QUEUE_CHANNEL_ID,
          badge: Math.min(count, 99),
          autoCancel: true,
          // Stay until cleared — refreshes on next sync.
          schedule: { at: new Date(Date.now() + 250) },
        },
      ],
    });
    lastSynced = count;
  } catch {
    // permission denied / plugin unavailable
  }
}

/** Test helper — reset memo so the next sync always writes. */
export function resetCapacitorQueueBadgeMemo(): void {
  lastSynced = -1;
}
