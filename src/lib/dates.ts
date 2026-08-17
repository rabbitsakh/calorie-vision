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
