/** Browser IANA timezone, or null when unavailable / invalid. */
export function detectDeviceTimezone(): string | null {
  if (typeof Intl === "undefined") return null;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone?.trim();
    if (!tz) return null;
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

export function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * UTC offset of `timeZone` at `date`, in minutes east of UTC
 * (e.g. Asia/Sakhalin → 660 for UTC+11).
 */
export function timezoneOffsetMinutes(timeZone: string, date = new Date()): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);
    const name = parts.find((p) => p.type === "timeZoneName")?.value;
    if (!name) return null;
    // "GMT", "GMT+11", "GMT-05:30", "GMT+11:00"
    if (name === "GMT" || name === "UTC") return 0;
    const m = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(name);
    if (!m) return null;
    const sign = m[1] === "-" ? -1 : 1;
    const hours = Number(m[2]);
    const mins = Number(m[3] ?? "0");
    return sign * (hours * 60 + mins);
  } catch {
    return null;
  }
}

/**
 * True when IANA ids are identical OR currently share the same UTC offset.
 * Android WebView often reports a different city id (or Etc/GMT-11) than the
 * profile city while wall-clock GMT+11 is the same — that is not a conflict.
 */
export function timezonesCurrentlyEquivalent(
  a: string | null | undefined,
  b: string | null | undefined,
  date = new Date(),
): boolean {
  const left = a?.trim() || "";
  const right = b?.trim() || "";
  if (!left || !right) return false;
  if (left === right) return true;
  const offA = timezoneOffsetMinutes(left, date);
  const offB = timezoneOffsetMinutes(right, date);
  if (offA == null || offB == null) return false;
  return offA === offB;
}
