const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isDateKey(value: string): boolean {
  const match = DATE_KEY.exec(value);
  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function requireDateKey(value: string | null | undefined): string | null {
  if (!value || !isDateKey(value)) {
    return null;
  }

  return value;
}

export function toDateKey(value: Date | string): string {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateWords(dateKey: string): string {
  if (!isDateKey(dateKey)) {
    return dateKey;
  }

  const formatted = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseDateInput(dateKey));

  return `${formatted.replace(/\s*г\.?\s*$/u, "")} г.`;
}

export function parseYearMonth(value: string): { year: number; monthIndex: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return null;
  }

  return { year, monthIndex };
}

export function formatYearMonth(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function shiftYearMonth(year: number, monthIndex: number, delta: number): {
  year: number;
  monthIndex: number;
} {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function formatMonthTitle(year: number, monthIndex: number): string {
  const title = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));

  return `${title.replace(/\s*г\.?\s*$/u, "")} г.`;
}

export function monthDateRange(year: number, monthIndex: number): { start: string; end: string } {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return {
    start: `${formatYearMonth(year, monthIndex)}-01`,
    end: `${formatYearMonth(year, monthIndex)}-${String(lastDay).padStart(2, "0")}`,
  };
}

export function shiftDateKey(dateKey: string, deltaDays: number): string {
  const date = parseDateInput(dateKey);
  date.setDate(date.getDate() + deltaDays);
  return formatDateInput(date);
}

/** Monday of the ISO-style week that contains `dateKey` (Mon–Sun). */
export function mondayOfWeek(dateKey: string): string {
  const date = parseDateInput(dateKey);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + diff);
  return formatDateInput(date);
}

export function weekdayShort(dateKey: string): string {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short" }).format(parseDateInput(dateKey));
}

/** Inclusive list of `days` calendar days ending on `endDate`. */
export function dateRangeEnding(endDate: string, days: number): string[] {
  const end = parseDateInput(endDate);
  const keys: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(end);
    day.setDate(day.getDate() - offset);
    keys.push(formatDateInput(day));
  }
  return keys;
}

export function formatDateShort(dateKey: string): string {
  if (!isDateKey(dateKey)) {
    return dateKey;
  }

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
  }).format(parseDateInput(dateKey));
}

export function formatDateTime(value: string | Date, timezone?: string | null): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  }).format(date);
}

export function formatTimeShort(value: string | Date, timezone?: string | null): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone ?? undefined,
  }).format(date);
}

/** HH:MM for `<input type="time">` in the given timezone. */
export function toTimeInputValue(value: string | Date, timezone?: string | null): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone ?? undefined,
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "12";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/**
 * Instant for calendar `dateKey` + wall-clock `HH:MM` in `timezone`
 * (browser local when timezone is omitted).
 */
export function dateKeyAndTimeToIso(
  dateKey: string,
  timeHHMM: string,
  timezone?: string | null,
): string | null {
  if (!isDateKey(dateKey)) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(timeHHMM.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) {
    return null;
  }
  const [year, month, day] = dateKey.split("-").map(Number) as [number, number, number];

  if (!timezone) {
    return new Date(year, month - 1, day, hour, minute, 0, 0).toISOString();
  }

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(utcMs));
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const asUtc = Date.UTC(
      Number(map.year),
      Number(map.month) - 1,
      Number(map.day),
      Number(map.hour),
      Number(map.minute),
      Number(map.second),
    );
    const wanted = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const delta = wanted - asUtc;
    if (delta === 0) break;
    utcMs += delta;
  }
  return new Date(utcMs).toISOString();
}

/** Returns YYYY-MM-DD in the given timezone (defaults to local). */
export function toDateKeyTz(date: Date, timezone?: string | null): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone ?? undefined,
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

export function getMonthGrid(year: number, monthIndex: number): Array<string | null> {
  const first = new Date(year, monthIndex, 1);
  const weekday = first.getDay();
  const leading = weekday === 0 ? 6 : weekday - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<string | null> = [];

  for (let index = 0; index < leading; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(formatDateInput(new Date(year, monthIndex, day)));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}
