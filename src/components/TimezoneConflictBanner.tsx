"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { detectDeviceTimezone } from "@/lib/device-timezone";
import { clearTimezoneCache } from "@/lib/use-timezone";
import { withBasePath } from "@/lib/paths";

const DISMISS_KEY = "cv-tz-mismatch-dismiss";

/**
 * Soft banner when device IANA zone ≠ profile timezone.
 * One-tap sync writes device TZ to the account.
 */
export function TimezoneConflictBanner() {
  const [profileTz, setProfileTz] = useState<string | null>(null);
  const [deviceTz, setDeviceTz] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const device = detectDeviceTimezone();
    setDeviceTz(device);
    if (!device) return;

    try {
      if (sessionStorage.getItem(DISMISS_KEY) === device) {
        return;
      }
    } catch {
      // ignore
    }

    let cancelled = false;
    void (async () => {
      try {
        const resp = await fetch(withBasePath("/api/account"));
        if (!resp.ok) return;
        const data = (await resp.json()) as { timezone?: string | null };
        const profile = data.timezone?.trim() || null;
        if (cancelled) return;
        setProfileTz(profile);
        if (profile && profile !== device) {
          setVisible(true);
        }
      } catch {
        // non-critical
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const sync = useCallback(async () => {
    if (!deviceTz) return;
    setSaving(true);
    try {
      const resp = await fetch(withBasePath("/api/account"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: deviceTz }),
      });
      if (!resp.ok) return;
      clearTimezoneCache(deviceTz);
      setProfileTz(deviceTz);
      setVisible(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [deviceTz]);

  const dismiss = useCallback(() => {
    try {
      if (deviceTz) sessionStorage.setItem(DISMISS_KEY, deviceTz);
    } catch {
      // ignore
    }
    setVisible(false);
  }, [deviceTz]);

  if (!visible || !profileTz || !deviceTz) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-amber-950">Часовой пояс не совпадает</p>
          <p className="mt-0.5 text-xs text-amber-900/90">
            В профиле — <span className="font-medium">{profileTz}</span>, на устройстве —{" "}
            <span className="font-medium">{deviceTz}</span>. Напоминания идут по поясу профиля.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-sm font-semibold text-amber-950 underline-offset-2 hover:underline disabled:opacity-60"
              disabled={saving}
              onClick={() => void sync()}
            >
              {saving ? "Сохраняем…" : "Синхронизировать с устройством"}
            </button>
            <Link
              href="/profile"
              className="text-sm font-medium text-amber-900/80 underline-offset-2 hover:underline"
            >
              Профиль
            </Link>
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 text-xs font-semibold text-amber-800/80 hover:text-amber-950"
          onClick={dismiss}
        >
          Скрыть
        </button>
      </div>
    </div>
  );
}
