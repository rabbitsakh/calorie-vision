"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getPushCapability,
  setPushPromptDismissed,
  type PushCapability,
} from "@/lib/push-client";
import { subscribeBrowserPush } from "@/lib/push-subscribe";
import { withBasePath } from "@/lib/paths";

type ServerPushStatus = {
  subscribed: boolean;
  count: number;
};

export function PushRemindersSettings() {
  const [cap, setCap] = useState<PushCapability | null>(null);
  const [server, setServer] = useState<ServerPushStatus | null>(null);
  const [loading, setLoading] = useState(false);
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
    // Allow the ration banner to show again if this was dismissed earlier.
    setPushPromptDismissed(false);

    const result = await subscribeBrowserPush();
    if (result.ok) {
      setMessage("Напоминания подключены на этом устройстве");
    } else {
      setError(result.error);
    }
    await refresh();
    setLoading(false);
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

  return (
    <section className="card p-4 md:p-6">
      <h2 className="text-lg font-bold text-slate-900">Напоминания</h2>
      <p className="mt-1 text-sm text-slate-500">
        Push о завтраке, воде и серии записей. На iPhone — только из приложения с Home Screen (iOS 16.4+).
      </p>

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
        </div>
      ) : null}

      {message ? <p className="mt-3 text-sm text-teal-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
