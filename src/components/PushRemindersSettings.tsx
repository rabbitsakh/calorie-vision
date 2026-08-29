"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Mascot, type MascotPose } from "@/components/Mascot";
import { PwaInstallWizard } from "@/components/PwaInstallWizard";
import {
  getPushCapability,
  setPushPromptDismissed,
  type PushCapability,
} from "@/lib/push-client";
import { subscribeBrowserPush } from "@/lib/push-subscribe";
import { trackPushEnabledGoal } from "@/lib/metrika-funnel";
import { withBasePath } from "@/lib/paths";
import {
  REMINDER_SCHEDULE,
  reminderKindLabel,
  type PushReminderPrefs,
  type ReminderKind,
} from "@/lib/push-reminder-schedule";
import { clampHour, formatQuietHoursLabel } from "@/lib/quiet-hours";
import {
  pushActionLabel,
  pushUxMatrixSteps,
  resolvePushUxState,
  type PushUxAction,
  type PushUxState,
} from "@/lib/push-ux-state";

type ServerPushStatus = {
  subscribed: boolean;
  count: number;
};

type ReminderPrefRow = {
  enabled: boolean;
  hour: number;
};

function defaultPrefRows(): Record<ReminderKind, ReminderPrefRow> {
  const rows = {} as Record<ReminderKind, ReminderPrefRow>;
  for (const slot of REMINDER_SCHEDULE) {
    rows[slot.kind] = { enabled: true, hour: slot.hour };
  }
  return rows;
}

function prefsFromServer(raw: PushReminderPrefs | null | undefined): Record<ReminderKind, ReminderPrefRow> {
  const rows = defaultPrefRows();
  if (!raw) return rows;
  for (const slot of REMINDER_SCHEDULE) {
    const pref = raw[slot.kind];
    if (!pref) continue;
    rows[slot.kind] = {
      enabled: pref.enabled !== false,
      hour: pref.hour != null ? pref.hour : slot.hour,
    };
  }
  return rows;
}

function poseForUx(ux: PushUxState): MascotPose {
  if (ux.tone === "ok") return "cheer";
  if (ux.tone === "warn") return "idle";
  if (ux.id === "install-needed" || ux.id === "needs-resync") return "tip";
  return "tip";
}

function permissionLabelRu(permission: PushCapability["permission"]): string {
  switch (permission) {
    case "granted":
      return "разрешено";
    case "denied":
      return "запрещено";
    case "default":
      return "ещё не спрашивали";
    default:
      return "неизвестно";
  }
}

function toneClasses(tone: PushUxState["tone"]): string {
  switch (tone) {
    case "ok":
      return "border-emerald-200 bg-emerald-50/80";
    case "warn":
      return "border-amber-200 bg-amber-50/90";
    case "tip":
      return "border-teal-200 bg-teal-50/70";
    default:
      return "border-slate-200 bg-slate-50";
  }
}

function matrixStepClasses(status: "done" | "current" | "todo" | "blocked"): string {
  switch (status) {
    case "done":
      return "border-emerald-300 bg-emerald-100 text-emerald-900";
    case "current":
      return "border-teal-400 bg-teal-100 text-teal-950 ring-1 ring-teal-300";
    case "blocked":
      return "border-amber-300 bg-amber-100 text-amber-950";
    default:
      return "border-slate-200 bg-white text-slate-500";
  }
}

export function PushRemindersSettings() {
  const [cap, setCap] = useState<PushCapability | null>(null);
  const [server, setServer] = useState<ServerPushStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quietStart, setQuietStart] = useState<string>("");
  const [quietEnd, setQuietEnd] = useState<string>("");
  const [quietSaving, setQuietSaving] = useState(false);
  const [reminderPrefs, setReminderPrefs] = useState<Record<ReminderKind, ReminderPrefRow>>(defaultPrefRows);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<"install" | "reinstall">("install");

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
    try {
      const accountResp = await fetch(withBasePath("/api/account"));
      if (accountResp.ok) {
        const account = (await accountResp.json()) as {
          quietHoursStart?: number | null;
          quietHoursEnd?: number | null;
          pushReminderPrefs?: PushReminderPrefs | null;
        };
        setQuietStart(
          account.quietHoursStart == null ? "" : String(account.quietHoursStart),
        );
        setQuietEnd(account.quietHoursEnd == null ? "" : String(account.quietHoursEnd));
        setReminderPrefs(prefsFromServer(account.pushReminderPrefs));
      }
    } catch {
      // keep defaults
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ux = useMemo(() => {
    if (!cap) {
      return resolvePushUxState({
        capability: {
          kind: "loading",
          canSubscribe: false,
          isIos: false,
          isStandalone: false,
          permission: "unknown",
          title: "Проверяем…",
          detail: "",
        },
        serverSubscribed: null,
      });
    }
    return resolvePushUxState({
      capability: cap,
      serverSubscribed: server == null ? null : server.subscribed,
    });
  }, [cap, server]);

  const matrixSteps = useMemo(() => pushUxMatrixSteps(ux.id), [ux.id]);

  async function saveQuietHours() {
    setQuietSaving(true);
    setError(null);
    setMessage(null);
    const start = quietStart === "" ? null : clampHour(quietStart);
    const end = quietEnd === "" ? null : clampHour(quietEnd);
    if ((quietStart !== "" && start === null) || (quietEnd !== "" && end === null)) {
      setError("Укажите часы тишины от 0 до 23");
      setQuietSaving(false);
      return;
    }
    if ((start == null) !== (end == null)) {
      setError("Укажите и начало, и конец — или очистите оба поля");
      setQuietSaving(false);
      return;
    }
    try {
      const resp = await fetch(withBasePath("/api/account"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quietHoursStart: start, quietHoursEnd: end }),
      });
      const data = (await resp.json()) as {
        error?: string;
        quietHoursStart?: number | null;
        quietHoursEnd?: number | null;
      };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось сохранить тихие часы");
      } else {
        setQuietStart(data.quietHoursStart == null ? "" : String(data.quietHoursStart));
        setQuietEnd(data.quietHoursEnd == null ? "" : String(data.quietHoursEnd));
        setMessage(
          `Тихие часы: ${formatQuietHoursLabel(data.quietHoursStart, data.quietHoursEnd)}`,
        );
      }
    } catch {
      setError("Не удалось сохранить тихие часы");
    }
    setQuietSaving(false);
  }

  async function saveReminderPrefs() {
    setPrefsSaving(true);
    setError(null);
    setMessage(null);
    const payload: PushReminderPrefs = {};
    for (const slot of REMINDER_SCHEDULE) {
      const row = reminderPrefs[slot.kind];
      const enabled = row?.enabled ?? true;
      const hour = row?.hour ?? slot.hour;
      payload[slot.kind] = { enabled, hour };
    }
    try {
      const resp = await fetch(withBasePath("/api/account"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pushReminderPrefs: payload }),
      });
      const data = (await resp.json()) as {
        error?: string;
        pushReminderPrefs?: PushReminderPrefs | null;
      };
      if (!resp.ok) {
        setError(data.error ?? "Не удалось сохранить напоминания");
      } else {
        setReminderPrefs(prefsFromServer(data.pushReminderPrefs));
        setMessage("Настройки напоминаний сохранены");
      }
    } catch {
      setError("Не удалось сохранить напоминания");
    }
    setPrefsSaving(false);
  }

  async function handleEnable() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setPushPromptDismissed(false);

    const result = await subscribeBrowserPush();
    if (result.ok) {
      trackPushEnabledGoal();
      setMessage(
        ux.id === "needs-resync" || ux.id === "active"
          ? "Подписка обновлена"
          : "Готово — буду напоминать на этом устройстве",
      );
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

  function openWizard(mode: "install" | "reinstall") {
    setWizardMode(mode);
    setWizardOpen(true);
  }

  function runAction(action: PushUxAction) {
    if (action === "enable" || action === "resync") {
      void handleEnable();
      return;
    }
    if (action === "install") {
      openWizard("install");
      return;
    }
    if (action === "reinstall") {
      openWizard("reinstall");
    }
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
  const pose = poseForUx(ux);
  const showTest = ux.id === "active" && cap.kind === "granted";

  return (
    <section className="card p-4 md:p-6">
      <div className="flex items-start gap-3">
        <Mascot pose={pose} size="md" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-slate-900">Напоминания</h2>
          <p className="mt-1 text-sm text-slate-500">
            Завтрак, обед, ужин, вода, сводка калорий, серия и вечерний чек-ин — по часовому поясу
            из профиля. Можно включить/выключить каждый тип и выбрать час. По понедельникам —
            итог прошлой недели. На iPhone — только из приложения с экрана «Домой» (iOS 16.4+).
          </p>
        </div>
      </div>

      <div className={`mt-4 rounded-2xl border px-4 py-3 ${toneClasses(ux.tone)}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Статус push</p>
        <ol className="mt-2 flex flex-wrap gap-2" aria-label="Шаги подключения уведомлений">
          {matrixSteps.map((step) => (
            <li
              key={`${step.id}-${step.label}`}
              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${matrixStepClasses(step.status)}`}
            >
              {step.label}
              {step.status === "done" ? " ✓" : step.status === "current" ? " · сейчас" : ""}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm font-semibold text-slate-900">{ux.title}</p>
        <p className="mt-1 text-sm text-slate-600">{ux.detail}</p>
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
              {cap.isStandalone ? "с экрана «Домой»" : "браузер / вкладка"}
            </span>
          </div>
          <div>
            Разрешение:{" "}
            <span className="font-medium text-slate-700">
              {permissionLabelRu(cap.permission)}
            </span>
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

      {ux.primaryAction !== "none" || ux.secondaryAction !== "none" || showTest ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {ux.primaryAction !== "none" ? (
            <button
              type="button"
              className="btn btn-primary text-sm"
              disabled={loading && (ux.primaryAction === "enable" || ux.primaryAction === "resync")}
              onClick={() => runAction(ux.primaryAction)}
            >
              {loading && (ux.primaryAction === "enable" || ux.primaryAction === "resync")
                ? "Подключаем…"
                : pushActionLabel(ux.primaryAction, ux.id === "active")}
            </button>
          ) : null}
          {ux.secondaryAction !== "none" ? (
            <button
              type="button"
              className="btn btn-secondary text-sm"
              onClick={() => runAction(ux.secondaryAction)}
            >
              {pushActionLabel(ux.secondaryAction)}
            </button>
          ) : null}
          {showTest ? (
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

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Какие напоминания слать</p>
        <p className="mt-1 text-sm text-slate-600">
          Выключите ненужные или сдвиньте час — по умолчанию как в расписании.
        </p>
        <ul className="mt-3 space-y-2">
          {REMINDER_SCHEDULE.map((slot) => {
            const row = reminderPrefs[slot.kind] ?? { enabled: true, hour: slot.hour };
            return (
              <li
                key={slot.kind}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
              >
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    checked={row.enabled}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setReminderPrefs((prev) => ({
                        ...prev,
                        [slot.kind]: { ...prev[slot.kind], enabled, hour: prev[slot.kind]?.hour ?? slot.hour },
                      }));
                    }}
                  />
                  <span className="min-w-0">{reminderKindLabel(slot.kind, row.hour)}</span>
                </label>
                <select
                  className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm"
                  value={String(row.hour)}
                  disabled={!row.enabled}
                  aria-label={`Час: ${slot.kind}`}
                  onChange={(event) => {
                    const hour = Number(event.target.value);
                    setReminderPrefs((prev) => ({
                      ...prev,
                      [slot.kind]: { enabled: prev[slot.kind]?.enabled ?? true, hour },
                    }));
                  }}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <option key={hour} value={String(hour)}>
                      {String(hour).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          className="btn btn-secondary mt-3 text-sm"
          disabled={prefsSaving}
          onClick={() => void saveReminderPrefs()}
        >
          {prefsSaving ? "Сохраняем…" : "Сохранить напоминания"}
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Тихие часы</p>
        <p className="mt-1 text-sm text-slate-600">
          В этом интервале (по часовому поясу профиля) напоминания не отправляются. Можно
          через полночь — например, с 22 до 7.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-700">
            С
            <select
              className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              value={quietStart}
              onChange={(event) => setQuietStart(event.target.value)}
            >
              <option value="">выкл</option>
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={String(hour)}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-700">
            До
            <select
              className="mt-1 block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              value={quietEnd}
              onChange={(event) => setQuietEnd(event.target.value)}
            >
              <option value="">выкл</option>
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={String(hour)}>
                  {String(hour).padStart(2, "0")}:00
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-secondary text-sm"
            disabled={quietSaving}
            onClick={() => void saveQuietHours()}
          >
            {quietSaving ? "Сохраняем…" : "Сохранить"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Сейчас: {formatQuietHoursLabel(
            quietStart === "" ? null : Number(quietStart),
            quietEnd === "" ? null : Number(quietEnd),
          )}
        </p>
      </div>

      <div className="mt-4 rounded-2xl border border-teal-100 bg-teal-50/70 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Установка на телефон</p>
        <p className="mt-1 text-sm text-slate-600">
          Добавьте приложение на экран «Домой» — на iPhone так работают напоминания. Если
          уведомления запрещены — переустановите ярлык.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <button
            type="button"
            className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
            onClick={() => openWizard("install")}
          >
            Как установить
          </button>
          <button
            type="button"
            className="text-sm font-semibold text-teal-800 underline-offset-2 hover:underline"
            onClick={() => openWizard("reinstall")}
          >
            Переустановить
          </button>
        </div>
      </div>

      {message ? <p className="mt-3 text-sm text-teal-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <PwaInstallWizard
        open={wizardOpen}
        mode={wizardMode}
        prefer={cap.isIos ? "ios" : "auto"}
        onClose={() => setWizardOpen(false)}
      />
    </section>
  );
}
