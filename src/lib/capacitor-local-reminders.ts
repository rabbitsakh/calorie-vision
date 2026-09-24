/**
 * Local (on-device) reminders for the Capacitor RuStore APK.
 * Android WebView has no Web Push / PushManager — schedule via LocalNotifications.
 */

import { isCapacitorNative } from "@/lib/capacitor-bridge";
import {
  effectiveReminderSchedule,
  type PushReminderPrefs,
  type ReminderKind,
} from "@/lib/push-reminder-schedule";
import { isInQuietHours } from "@/lib/quiet-hours";

export const CAP_REMINDERS_ENABLED_KEY = "cv-local-reminders-on";

/** Stable notification ids so we can cancel/reschedule by kind. */
export const CAP_REMINDER_IDS: Record<ReminderKind, number> = {
  weekly: 9101,
  reactivation: 9102,
  breakfast: 9103,
  lunch: 9104,
  water_midday: 9105,
  dinner: 9106,
  water_evening: 9107,
  calories: 9108,
  streak: 9109,
  checkin: 9110,
};

const ALL_REMINDER_IDS = Object.values(CAP_REMINDER_IDS);

/** Generic copy — no live diary context (unlike server cron payloads). */
export function localReminderCopy(kind: ReminderKind): { title: string; body: string } {
  switch (kind) {
    case "breakfast":
      return { title: "Завтрак", body: "Запишите завтрак — день станет понятнее." };
    case "lunch":
      return { title: "Обед", body: "Не забудьте обед в дневнике." };
    case "dinner":
      return { title: "Ужин", body: "Вечер — хорошее время закрыть день записью." };
    case "water_midday":
      return { title: "Вода", body: "Стакан воды? Отметьте в приложении." };
    case "water_evening":
      return { title: "Вода вечером", body: "Допить до цели по воде?" };
    case "calories":
      return { title: "Сводка за день", body: "Гляньте калории и БЖУ в рационе." };
    case "streak":
      return { title: "Серия", body: "Одна запись — и день ваш." };
    case "checkin":
      return { title: "Вечерний чек-ин", body: "Как прошёл день? Отметьте настроение." };
    case "weekly":
      return { title: "Итог недели", body: "Понедельник — короткий взгляд на прошлую неделю." };
    case "reactivation":
      return { title: "Мы рядом", body: "Без давления: можно просто открыть дневник." };
    default:
      return { title: "Calorie Vision", body: "Напоминание из дневника." };
  }
}

/**
 * Capacitor LocalNotifications weekday: 1 = Sunday … 7 = Saturday.
 * Our schedule uses 0 = Sunday … 6 = Saturday (JS-style).
 */
export function toCapacitorWeekday(jsWeekday: number): number {
  const w = ((Math.trunc(jsWeekday) % 7) + 7) % 7;
  return w + 1;
}

export type CapReminderScheduleItem = {
  id: number;
  kind: ReminderKind;
  title: string;
  body: string;
  hour: number;
  weekday?: number;
};

export function buildCapacitorReminderSchedule(
  prefs?: PushReminderPrefs | null,
  quietStart?: number | null,
  quietEnd?: number | null,
): CapReminderScheduleItem[] {
  const slots = effectiveReminderSchedule(prefs);
  const items: CapReminderScheduleItem[] = [];
  for (const slot of slots) {
    if (isInQuietHours(slot.hour, quietStart, quietEnd)) continue;
    const copy = localReminderCopy(slot.kind);
    items.push({
      id: CAP_REMINDER_IDS[slot.kind],
      kind: slot.kind,
      title: copy.title,
      body: copy.body,
      hour: slot.hour,
      ...(slot.weekday != null ? { weekday: slot.weekday } : {}),
    });
  }
  return items;
}

async function preferencesGet(key: string): Promise<string | null> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key });
    return value ?? null;
  } catch {
    return null;
  }
}

async function preferencesSet(key: string, value: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.set({ key, value });
  } catch {
    // ignore
  }
}

async function preferencesRemove(key: string): Promise<void> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    await Preferences.remove({ key });
  } catch {
    // ignore
  }
}

export async function isCapacitorRemindersEnabled(): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  const value = await preferencesGet(CAP_REMINDERS_ENABLED_KEY);
  return value === "1";
}

export type CapLocalPermission = "granted" | "denied" | "prompt" | "unknown";

export async function checkCapacitorNotificationPermission(): Promise<CapLocalPermission> {
  if (!isCapacitorNative()) return "unknown";
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const status = await LocalNotifications.checkPermissions();
    const display = status.display;
    if (display === "granted") return "granted";
    if (display === "denied") return "denied";
    if (display === "prompt" || display === "prompt-with-rationale") return "prompt";
    return "unknown";
  } catch {
    return "unknown";
  }
}

export async function requestCapacitorNotificationPermission(): Promise<CapLocalPermission> {
  if (!isCapacitorNative()) return "unknown";
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const status = await LocalNotifications.requestPermissions();
    const display = status.display;
    if (display === "granted") return "granted";
    if (display === "denied") return "denied";
    if (display === "prompt" || display === "prompt-with-rationale") return "prompt";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function cancelAllReminderNotifications(): Promise<void> {
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({
    notifications: ALL_REMINDER_IDS.map((id) => ({ id })),
  });
}

export async function scheduleCapacitorLocalReminders(
  prefs?: PushReminderPrefs | null,
  quietStart?: number | null,
  quietEnd?: number | null,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!isCapacitorNative()) {
    return { ok: false, error: "Доступно только в приложении" };
  }
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const items = buildCapacitorReminderSchedule(prefs, quietStart, quietEnd);
    await cancelAllReminderNotifications();
    if (items.length === 0) {
      return { ok: true, count: 0 };
    }
    await LocalNotifications.schedule({
      notifications: items.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        channelId: "reminders",
        schedule: {
          allowWhileIdle: true,
          repeats: true,
          on: {
            hour: item.hour,
            minute: 0,
            ...(item.weekday != null
              ? { weekday: toCapacitorWeekday(item.weekday) }
              : {}),
          },
        },
        extra: { kind: item.kind, source: "capacitor-local" },
      })),
    });
    return { ok: true, count: items.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось запланировать";
    return { ok: false, error: message };
  }
}

export async function ensureReminderNotificationChannel(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.createChannel({
      id: "reminders",
      name: "Напоминания",
      description: "Мягкие напоминания о еде, воде и серии",
      importance: 4,
      visibility: 1,
      sound: undefined,
      vibration: true,
    });
  } catch {
    // Older Android / plugin — channel optional
  }
}

export type EnableCapRemindersResult = { ok: true } | { ok: false; error: string };

export async function enableCapacitorLocalReminders(
  prefs?: PushReminderPrefs | null,
  quietStart?: number | null,
  quietEnd?: number | null,
): Promise<EnableCapRemindersResult> {
  if (!isCapacitorNative()) {
    return { ok: false, error: "Доступно только в приложении" };
  }
  await ensureReminderNotificationChannel();
  let permission = await checkCapacitorNotificationPermission();
  if (permission !== "granted") {
    permission = await requestCapacitorNotificationPermission();
  }
  if (permission === "denied") {
    return {
      ok: false,
      error: "Уведомления запрещены. Разрешите их в настройках Android для Calorie Vision.",
    };
  }
  if (permission !== "granted") {
    return { ok: false, error: "Разрешение на уведомления не получено" };
  }
  const scheduled = await scheduleCapacitorLocalReminders(prefs, quietStart, quietEnd);
  if (!scheduled.ok) return scheduled;
  await preferencesSet(CAP_REMINDERS_ENABLED_KEY, "1");
  return { ok: true };
}

export async function disableCapacitorLocalReminders(): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    await cancelAllReminderNotifications();
  } catch {
    // ignore
  }
  await preferencesRemove(CAP_REMINDERS_ENABLED_KEY);
}

export async function syncCapacitorLocalRemindersIfEnabled(
  prefs?: PushReminderPrefs | null,
  quietStart?: number | null,
  quietEnd?: number | null,
): Promise<void> {
  if (!(await isCapacitorRemindersEnabled())) return;
  await scheduleCapacitorLocalReminders(prefs, quietStart, quietEnd);
}

export async function fireCapacitorTestReminder(): Promise<EnableCapRemindersResult> {
  if (!isCapacitorNative()) {
    return { ok: false, error: "Доступно только в приложении" };
  }
  try {
    await ensureReminderNotificationChannel();
    const permission = await checkCapacitorNotificationPermission();
    if (permission !== "granted") {
      return { ok: false, error: "Сначала включите напоминания" };
    }
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    const at = new Date(Date.now() + 1500);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 9199,
          title: "Проверка напоминаний",
          body: "Если видите это — локальные уведомления в APK работают.",
          channelId: "reminders",
          schedule: { at, allowWhileIdle: true },
        },
      ],
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось отправить тест";
    return { ok: false, error: message };
  }
}
