"use client";

import { useCallback, useEffect, useState } from "react";
import { Mascot, type MascotPose } from "@/components/Mascot";
import {
  getPushCapability,
  setPushPromptDismissed,
  type PushCapability,
} from "@/lib/push-client";
import { subscribeBrowserPush } from "@/lib/push-subscribe";
import { withBasePath } from "@/lib/paths";
import { REMINDER_SCHEDULE, reminderKindLabel } from "@/lib/push-reminder-schedule";

type ServerPushStatus = {
  subscribed: boolean;
  count: number;
};

function poseForStatus(
  cap: PushCapability,
  activeOnServer: boolean,
): MascotPose {
  if (cap.kind === "denied" || cap.kind === "ios-old" || cap.kind === "unsupported") {
    return "idle";
  }
  if (cap.kind === "ios-browser") return "tip";
  if (activeOnServer && cap.kind === "granted") return "cheer";
  if (cap.kind === "granted" || cap.kind === "default") return "tip";
  return "idle";
}

export function PushRemindersSettings() {
  const [cap, setCap] = useState<PushCapability | null>(null);
  const [server, setServer] = useState<ServerPushStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setCap(getPushCapability());
    try {
      const resp = await fetch(withBasePath("/api/push/subscribe"));
      if (resp.ok) {
        const data = (await resp.json()) as ServerPushStatus;
        setServer(data);
      } else {
        setServer(null);
      }
    } catch {
      setServer(null);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleEnable() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setPushPromptDismissed(false);

    const result = await subscribeBrowserPush();
    if (result.ok) {
      setMessage("Готово — буду напоминать на этом устройстве");
    } else {
      setError(result.error);
    }
    await refresh();
    setLoading(false);
  }

  async function handleTestPush() {
    setTesting(true);
    setError(null);
    setMessage(null);
    try {
      const resp = await fetch(withBasePath("/api/push/test"), { method: "POST" });
      const data = (await resp.json()) as { message?: string; error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось отправить тест");
      } else {
        setMessage(data.message ?? "Тестовое уведомление отправлено");
      }
    } catch {
      setError("Не удалось отправить тест");
    }
    setTesting(false);
  }

  if (!cap || cap.kind === "loading") {
    return (
      <section className="card p-4 md:p-6">
        <h2 className="text-lg font-bold text-slate-900">Напоминания</h2>
        <p className="mt-1 text-sm text-slate-500">Проверяем поддержку…</p>
      </section>
    );
  }

  const activeOnServer = Boolean(server?.subscribed);
  const showEnable = cap.canSubscribe;
  const pose = poseForStatus(cap, activeOnServer);

  return (
    <section className="card p-4 md:p-6">
      <div className="flex items-start gap-3">
        <Mascot pose={pose} size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">Напоминания</h2>
          <p className="mt-1 text-sm text-slate-500">
            Завтрак, обед, вода (днём и вечером), сводка калорий, серия и вечерний чек-ин — по
            часовому поясу из профиля (при включении подставим пояс этого устройства). По
            понедельникам — итог прошлой недели. На iPhone — только из приложения с Home Screen
            (iOS 16.4+).
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{cap.title}</p>
        <p className="mt-1 text-sm text-slate-600">{cap.detail}</p>
        <dl className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-2">
          <div>
            Устройство:{" "}
            <span className="font-medium text-slate-700">
              {cap.isIos ? "iPhone / iPad" : "другое"}
            </span>
          </div>
          <div>
            Режим:{" "}
            <span className="font-medium text-slate-700">
              {cap.isStandalone ? "с Home Screen" : "браузер / вкладка"}
            </span>
          </div>
          <div>
            Разрешение:{" "}
            <span className="font-medium text-slate-700">{cap.permission}</span>
          </div>
          <div>
            На сервере:{" "}
            <span className="font-medium text-slate-700">
              {server == null
                ? "—"
                : activeOnServer
                  ? `подписка есть (${server.count})`
                  : "подписки нет"}
            </span>
          </div>
        </dl>
        <ul className="mt-3 space-y-1 text-xs text-slate-600">
          {REMINDER_SCHEDULE.map((slot) => (
            <li key={slot.kind}>• {reminderKindLabel(slot.kind)}</li>
          ))}
        </ul>
      </div>

      {showEnable ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={loading}
            onClick={() => void handleEnable()}
          >
            {loading
              ? "Подключаем…"
              : activeOnServer || cap.kind === "granted"
                ? "Обновить подписку"
                : "Включить напоминания"}
          </button>
          {activeOnServer && cap.kind === "granted" ? (
            <button
              type="button"
              className="btn btn-secondary text-sm"
              disabled={testing}
              onClick={() => void handleTestPush()}
            >
              {testing ? "Отправляем…" : "Проверить уведомление"}
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-teal-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
