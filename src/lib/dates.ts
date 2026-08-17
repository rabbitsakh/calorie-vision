export function toDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

export function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDisplayDate(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
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
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex, 1));
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
