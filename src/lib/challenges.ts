export type ChallengeDef = {
  key: string;
  title: string;
  description: string;
  target: number;
};

export const CHALLENGE_DEFS: ChallengeDef[] = [
  {
    key: "breakfast_7",
    title: "Завтрак каждый день",
    description: "Запишите завтрак 7 дней подряд на этой неделе",
    target: 7,
  },
  {
    key: "water_5",
    title: "Пять дней с водой",
    description: "≥1500 мл воды в 5 днях этой недели",
    target: 5,
  },
  {
    key: "log_5",
    title: "Пять дней дневника",
    description: "Любые записи еды в 5 днях этой недели",
    target: 5,
  },
];

export function challengeDef(key: string): ChallengeDef | undefined {
  return CHALLENGE_DEFS.find((c) => c.key === key);
}

/** Monday YYYY-MM-DD for a date key (UTC noon anchor). */
export function weekStartMonday(dateKey: string): string {
  const d = new Date(dateKey + "T12:00:00Z");
  const day = d.getUTCDay();
  const offset = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
}
