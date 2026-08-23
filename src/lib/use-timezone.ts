"use client";

import { useEffect, useState } from "react";
import { detectDeviceTimezone } from "@/lib/device-timezone";
import { withBasePath } from "@/lib/paths";

type AccountSummary = { timezone?: string | null };

let cache: string | null | undefined = undefined;
let syncInFlight: Promise<string | null> | null = null;

async function persistDeviceTimezone(tz: string): Promise<string | null> {
  try {
    const resp = await fetch(withBasePath("/api/account"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: tz }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as AccountSummary;
    return data.timezone ?? tz;
  } catch {
    return null;
  }
}

/**
 * Load profile timezone; if unset, detect the device IANA zone and save it.
 * Push cron can only use a stored timezone — "device default" on the server is Moscow.
 */
export function useTimezone(): string | null {
  const [timezone, setTimezone] = useState<string | null>(
    cache !== undefined ? cache : null,
  );

  useEffect(() => {
    if (cache !== undefined) {
      setTimezone(cache);
      return;
    }

    if (!syncInFlight) {
      syncInFlight = (async () => {
        try {
          const res = await fetch(withBasePath("/api/account"));
          const data = res.ok ? ((await res.json()) as AccountSummary) : null;
          let tz = data?.timezone?.trim() || null;
          if (!tz) {
            const deviceTz = detectDeviceTimezone();
            if (deviceTz) {
              tz = (await persistDeviceTimezone(deviceTz)) ?? deviceTz;
            }
          }
          cache = tz;
          return tz;
        } catch {
          cache = null;
          return null;
        } finally {
          syncInFlight = null;
        }
      })();
    }

    void syncInFlight.then((tz) => setTimezone(tz));
  }, []);

  return timezone;
}

/** Clear cached timezone (e.g. after profile save). */
export function clearTimezoneCache(next?: string | null) {
  cache = next === undefined ? undefined : next;
}
