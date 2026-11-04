import { hourInTimezone } from "@/lib/meal-type";

type Recency = {
  eatenAt?: Date | string | null;
  createdAt: Date | string;
};

/** Сначала то, что съели позже, а не то, что раньше попало в выборку. */
export function compareQuickAddRecency(a: Recency, b: Recency): number {
  const ta = new Date(a.eatenAt ?? a.createdAt).getTime();
  const tb = new Date(b.eatenAt ?? b.createdAt).getTime();
  return tb - ta;
}

/** Час в поясе пользователя. На сервере getHours() — это UTC. */
export function quickAddHour(entry: Recency, timezone?: string | null): number {
  return hourInTimezone(new Date(entry.eatenAt ?? entry.createdAt), timezone);
}
