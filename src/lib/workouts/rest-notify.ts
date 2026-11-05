/**
 * Таймер отдыха вне экрана.
 * Android: window.CvRest (нативный chronometer на экране блокировки).
 * Веб и PWA: Notification API и service worker, звук остаётся в session-clock.
 */

const REST_TAG = "cv-rest";

type CvRestBridge = {
  start?: (endsAt: number, title: string) => boolean;
  add?: (ms: number) => boolean;
  skip?: () => boolean;
  endsAt?: () => number;
};

type RestHost = Window & {
  CvRest?: CvRestBridge;
  Capacitor?: { isPluginAvailable?: (name: string) => boolean };
};

function bridge(): CvRestBridge | null {
  if (typeof window === "undefined") return null;
  const host = window as RestHost;
  return host.CvRest ?? null;
}

export function readNativeRestEndsAt(): number | null {
  try {
    const ends = bridge()?.endsAt?.();
    if (typeof ends === "number" && Number.isFinite(ends) && ends > Date.now()) return ends;
  } catch {
    // нет моста
  }
  return null;
}

async function showWebNotification(endsAt: number, title: string): Promise<void> {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;
  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (permission !== "granted") return;
  const until = new Date(endsAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const body = `До ${until}. Можно закрыть экран — напомним, если браузер позволит.`;
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  if (registration) {
    await registration.showNotification(title, {
      body,
      tag: REST_TAG,
      renotify: true,
      silent: true,
      data: { url: "/workouts", kind: "rest", endsAt },
      actions: [
        { action: "add30", title: "+30 с" },
        { action: "skip", title: "Пропустить" },
      ],
    } as NotificationOptions);
    return;
  }
  const note = new Notification(title, { body, tag: REST_TAG, silent: true });
  window.setTimeout(() => note.close(), Math.max(1000, endsAt - Date.now()));
}

async function scheduleCapacitorEnd(endsAt: number, title: string): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const cap = (window as RestHost).Capacitor;
  if (!cap?.isPluginAvailable?.("LocalNotifications")) return false;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 88021,
          title,
          body: "Отдых закончился",
          schedule: { at: new Date(endsAt), allowWhileIdle: true },
          sound: "default",
          extra: { kind: "rest" },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}

async function cancelCapacitorEnd(): Promise<void> {
  if (typeof window === "undefined") return;
  const cap = (window as RestHost).Capacitor;
  if (!cap?.isPluginAvailable?.("LocalNotifications")) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({ notifications: [{ id: 88021 }] });
  } catch {
    // плагин мог не запланировать уведомление
  }
}

/** true, если отсчёт на блокировке ведёт нативный сервис (звук в конце тоже он). */
export async function startRestNotification(endsAt: number, title = "Отдых"): Promise<boolean> {
  try {
    if (bridge()?.start?.(endsAt, title)) return true;
  } catch {
    // старая сборка без CvRest
  }
  await scheduleCapacitorEnd(endsAt, title);
  await showWebNotification(endsAt, title);
  return false;
}

export async function shiftRestNotification(endsAt: number, deltaMs: number): Promise<void> {
  try {
    if (bridge()?.add?.(deltaMs)) return;
  } catch {
    // ignore
  }
  await cancelCapacitorEnd();
  await startRestNotification(endsAt, "Отдых");
}

export async function clearRestNotification(): Promise<void> {
  try {
    bridge()?.skip?.();
  } catch {
    // ignore
  }
  await cancelCapacitorEnd();
  if (typeof window === "undefined") return;
  const registration = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
  const notes = (await registration?.getNotifications({ tag: REST_TAG })) ?? [];
  for (const note of notes) note.close();
}

export type RestNotifyAction = "add30" | "skip";

export function subscribeRestNotificationActions(
  onAction: (action: RestNotifyAction) => void,
): () => void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};
  const handler = (event: MessageEvent) => {
    const data = event.data as { type?: string; action?: string } | null;
    if (!data || data.type !== "cv-rest") return;
    if (data.action === "add30" || data.action === "skip") onAction(data.action);
  };
  navigator.serviceWorker.addEventListener("message", handler);
  return () => navigator.serviceWorker.removeEventListener("message", handler);
}
