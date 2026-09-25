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
import { getQuietHoursPrefs } from "@/lib/quiet-hours-prefs";
import { readRationDayCache } from "@/lib/ration-day-cache";

export const CAP_REMINDERS_ENABLED_KEY = "cv-local-reminders-on";
const CAP_REMINDER_PREFS_KEY = "cv-local-reminder-prefs";

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

/** Lightweight diary context for local notification copy (last cached ration day). */
export type LocalReminderDiarySnapshot = {
  date: string;
  mealCount: number;
  totalCalories: number;
  calorieTarget: number | null;
  waterMl: number;
  waterTargetMl: number;
  hasBreakfast: boolean;
  hasLunch: boolean;
  hasDinner: boolean;
  streak: number;
  streakBeforeToday: number;
  loggedToday: boolean;
  hasMood: boolean;
};

type RationDayLike = {
  date: string;
  meals?: {
    entries?: Array<{ mealType?: string | null }>;
    totalCalories?: number;
    target?: { calories?: number } | null;
  };
  water?: { totalMl?: number; target?: number };
  streak?: {
    streak?: number;
    streakBeforeToday?: number;
    loggedToday?: boolean;
  };
  diaryMood?: string | null;
  week?: { calorieTarget?: number | null };
};

export function diarySnapshotFromRationDay(
  payload: RationDayLike | null | undefined,
): LocalReminderDiarySnapshot | null {
  if (!payload?.date) return null;
  const entries = payload.meals?.entries ?? [];
  const mealCount = entries.length;
  const types = new Set(entries.map((e) => e.mealType).filter(Boolean));
  const waterTarget = Number(payload.water?.target);
  const calorieTarget =
    payload.meals?.target?.calories ??
    payload.week?.calorieTarget ??
    null;
  return {
    date: payload.date,
    mealCount,
    totalCalories: Math.max(0, Math.round(Number(payload.meals?.totalCalories) || 0)),
    calorieTarget:
      calorieTarget != null && Number.isFinite(calorieTarget) && calorieTarget > 0
        ? Math.round(calorieTarget)
        : null,
    waterMl: Math.max(0, Math.round(Number(payload.water?.totalMl) || 0)),
    waterTargetMl:
      Number.isFinite(waterTarget) && waterTarget > 0 ? Math.round(waterTarget) : 2000,
    hasBreakfast: types.has("BREAKFAST"),
    hasLunch: types.has("LUNCH"),
    hasDinner: types.has("DINNER"),
    streak: Math.max(0, Math.floor(Number(payload.streak?.streak) || 0)),
    streakBeforeToday: Math.max(
      0,
      Math.floor(Number(payload.streak?.streakBeforeToday) || 0),
    ),
    loggedToday: Boolean(payload.streak?.loggedToday) || mealCount > 0,
    hasMood: Boolean(payload.diaryMood?.trim()),
  };
}

/** Prefer today's cache entry; fall back to the newest cached day. */
export function readLocalReminderDiarySnapshot(
  todayKey?: string | null,
): LocalReminderDiarySnapshot | null {
  if (typeof window === "undefined") return null;
  if (todayKey) {
    const today = diarySnapshotFromRationDay(readRationDayCache(todayKey));
    if (today) return today;
  }
  try {
    const raw = localStorage.getItem("cv-ration-day-cache-v1");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, RationDayLike>;
    const keys = Object.keys(parsed).sort();
    const last = keys[keys.length - 1];
    if (!last) return null;
    return diarySnapshotFromRationDay(parsed[last]);
  } catch {
    return null;
  }
}

/** Copy with optional diary context from the last cached ration day. */
export function localReminderCopy(
  kind: ReminderKind,
  snapshot?: LocalReminderDiarySnapshot | null,
): { title: string; body: string } {
  const s = snapshot ?? null;
  switch (kind) {
    case "breakfast":
      if (s?.hasBreakfast || (s?.loggedToday && s.mealCount > 0)) {
        return {
          title: "Завтрак",
          body:
            s.totalCalories > 0
              ? `Уже ${s.totalCalories} ккал сегодня — добавьте завтрак, если ещё не отметили.`
              : "Если завтрак ещё не в дневнике — отметьте его сейчас.",
        };
      }
      return { title: "Завтрак", body: "Запишите завтрак — день станет понятнее." };
    case "lunch":
      if (s?.hasLunch) {
        return {
          title: "Обед",
          body:
            s.totalCalories > 0
              ? `Обед уже есть · ${s.totalCalories} ккал за день. Можно добавить перекус.`
              : "Обед уже в дневнике — день открыт.",
        };
      }
      if (s && s.mealCount === 0) {
        return {
          title: "Обед",
          body: "День пока пустой — добавьте обед, чтобы открыть дневник.",
        };
      }
      if (s && s.totalCalories > 0) {
        return {
          title: "Обед",
          body: `Уже ${s.totalCalories} ккал — не забудьте записать обед.`,
        };
      }
      return { title: "Обед", body: "Не забудьте обед в дневнике." };
    case "dinner":
      if (s?.hasDinner) {
        return {
          title: "Ужин",
          body:
            s.totalCalories > 0
              ? `Ужин отмечен · ${s.totalCalories} ккал за день. Можно закрыть день чек-ином.`
              : "Ужин уже в дневнике.",
        };
      }
      if (s && s.mealCount === 0) {
        return {
          title: "Ужин",
          body: "Сегодня ещё нет приёмов пищи — добавьте хотя бы ужин.",
        };
      }
      if (s && s.totalCalories > 0) {
        return {
          title: "Ужин",
          body: `Уже ${s.totalCalories} ккал за день — не забудьте ужин.`,
        };
      }
      return { title: "Ужин", body: "Вечер — хорошее время закрыть день записью." };
    case "water_midday": {
      if (s) {
        const half = Math.round(s.waterTargetMl / 2);
        if (s.waterMl >= half) {
          return {
            title: "Вода",
            body: `${s.waterMl} из ${s.waterTargetMl} мл — половина цели уже есть.`,
          };
        }
        return {
          title: "Вода",
          body: `${s.waterMl} из ${s.waterTargetMl} мл. До половины цели ~${Math.max(0, half - s.waterMl)} мл.`,
        };
      }
      return { title: "Вода", body: "Стакан воды? Отметьте в приложении." };
    }
    case "water_evening": {
      if (s) {
        if (s.waterMl >= s.waterTargetMl) {
          return {
            title: "Вода вечером",
            body: `${s.waterMl} мл — цель по воде на сегодня закрыта.`,
          };
        }
        return {
          title: "Вода вечером",
          body: `${s.waterMl} из ${s.waterTargetMl} мл. До цели ещё ${Math.max(0, s.waterTargetMl - s.waterMl)} мл.`,
        };
      }
      return { title: "Вода вечером", body: "Допить до цели по воде?" };
    }
    case "calories":
      if (s && s.mealCount > 0 && s.calorieTarget) {
        const pct = Math.round((s.totalCalories / s.calorieTarget) * 100);
        return {
          title: "Сводка за день",
          body: `${s.totalCalories} / ${s.calorieTarget} ккал (${pct}%). Гляньте рацион.`,
        };
      }
      if (s && s.mealCount > 0) {
        return {
          title: "Сводка за день",
          body: `${s.mealCount} ${s.mealCount === 1 ? "приём" : "приёма"}, ${s.totalCalories} ккал — откройте рацион.`,
        };
      }
      return { title: "Сводка за день", body: "Гляньте калории и БЖУ в рационе." };
    case "streak":
      if (s?.loggedToday && s.streak >= 1) {
        return {
          title: "Серия",
          body: `Серия ${s.streak} ${s.streak === 1 ? "день" : "дн."} — сегодня уже есть запись.`,
        };
      }
      if (s && s.streakBeforeToday >= 1 && !s.loggedToday) {
        return {
          title: "Серия",
          body: `Серия ${s.streakBeforeToday} дн. — одна запись до полуночи сохранит её.`,
        };
      }
      return { title: "Серия", body: "Одна запись — и день ваш." };
    case "checkin":
      if (s?.hasMood) {
        return {
          title: "Вечерний чек-ин",
          body: "Настроение уже отмечено — можно просто глянуть итог дня.",
        };
      }
      if (s && s.mealCount > 0) {
        return {
          title: "Вечерний чек-ин",
          body: `${s.mealCount} ${s.mealCount === 1 ? "приём" : "приёма"}, ${s.totalCalories} ккал — как настроение?`,
        };
      }
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
  snapshot?: LocalReminderDiarySnapshot | null,
): CapReminderScheduleItem[] {
  const slots = effectiveReminderSchedule(prefs);
  const diary = snapshot === undefined ? readLocalReminderDiarySnapshot() : snapshot;
  const items: CapReminderScheduleItem[] = [];
  for (const slot of slots) {
    if (isInQuietHours(slot.hour, quietStart, quietEnd)) continue;
    const copy = localReminderCopy(slot.kind, diary);
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

async function loadStoredReminderPrefs(): Promise<PushReminderPrefs | null> {
  const raw = await preferencesGet(CAP_REMINDER_PREFS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as PushReminderPrefs;
  } catch {
    return null;
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
  snapshot?: LocalReminderDiarySnapshot | null,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (!isCapacitorNative()) {
    return { ok: false, error: "Доступно только в приложении" };
  }
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    if (prefs != null) {
      await preferencesSet(CAP_REMINDER_PREFS_KEY, JSON.stringify(prefs));
    }
    const storedPrefs = prefs ?? (await loadStoredReminderPrefs());
    const items = buildCapacitorReminderSchedule(
      storedPrefs,
      quietStart,
      quietEnd,
      snapshot === undefined ? readLocalReminderDiarySnapshot() : snapshot,
    );
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

/** After ration day loads — refresh notification copy from diary cache. */
export async function refreshCapacitorReminderCopyFromDiary(
  todayKey?: string | null,
): Promise<void> {
  if (!(await isCapacitorRemindersEnabled())) return;
  const snapshot = readLocalReminderDiarySnapshot(todayKey);
  const quiet = getQuietHoursPrefs();
  await scheduleCapacitorLocalReminders(undefined, quiet.start, quiet.end, snapshot);
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
