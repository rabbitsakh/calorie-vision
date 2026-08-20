/** Monday of the week containing dateKey, in the given IANA timezone. */
export function weekStartMonday(dateKey: string, timezone?: string | null): string {
  const ref = new Date(dateKey + "T12:00:00Z");
  const weekday = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: timezone ?? "UTC",
  }).format(ref);

  const dayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = dayMap[weekday] ?? 0;

  const d = new Date(dateKey + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}

export function shiftDateKeyUtc(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function computeStreakFromSet(dateSet: Set<string>, today: string): number {
  let streak = 0;
  let expected = today;
  while (dateSet.has(expected)) {
    streak += 1;
    expected = shiftDateKeyUtc(expected, -1);
  }
  return streak;
}

export function computeLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (shiftDateKeyUtc(prev, 1) === curr) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}
