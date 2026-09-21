/** 0 = Monday … 6 = Sunday (ISO-ish, matches plan UI). */
export const WEEKDAY_LABELS_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export function parseWeekdays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const out: number[] = [];
  for (const item of raw) {
    const n = typeof item === "number" ? item : Number(item);
    if (!Number.isInteger(n) || n < 0 || n > 6) continue;
    if (!out.includes(n)) out.push(n);
  }
  return out.sort((a, b) => a - b);
}

export function weekdaysToJson(days: number[]): number[] {
  return parseWeekdays(days);
}

/** JS Date.getDay(): 0=Sun … 6=Sat → our 0=Mon … 6=Sun. */
export function jsDateToPlanWeekday(date: Date): number {
  const js = date.getDay(); // 0 Sun
  return js === 0 ? 6 : js - 1;
}

export function planWeekdayFromDateKey(dateKey: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0));
  if (Number.isNaN(d.getTime())) return null;
  const js = d.getUTCDay();
  return js === 0 ? 6 : js - 1;
}

export function parsePlanLabel(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return null;
  const t = raw.trim().toUpperCase().slice(0, 8);
  return t || null;
}
