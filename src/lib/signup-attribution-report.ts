import { parseSignupAttributionBody, type SignupAttribution } from "@/lib/signup-attribution";

export type AttributionReportRow = {
  source: string;
  medium: string;
  campaign: string;
  /** Строка «без метки»: нет signupAttribution или в нём нет utm. */
  unlabeled: boolean;
  d7: number;
  d30: number;
  all: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function cell(value: string | undefined): string {
  return value?.trim() || "—";
}

function groupKey(attribution: SignupAttribution | null): string {
  if (!attribution) return "";
  return [attribution.utm_source, attribution.utm_medium, attribution.utm_campaign]
    .map((part) => part ?? "")
    .join("\u0001");
}

export function aggregateSignupAttribution(
  rows: Array<{ createdAt: Date; signupAttribution: unknown }>,
  now: Date,
): AttributionReportRow[] {
  const since7 = now.getTime() - 7 * DAY_MS;
  const since30 = now.getTime() - 30 * DAY_MS;
  const groups = new Map<string, AttributionReportRow>();

  const bump = (key: string, row: AttributionReportRow, createdAt: Date) => {
    const at = createdAt.getTime();
    row.all += 1;
    if (at >= since30) row.d30 += 1;
    if (at >= since7) row.d7 += 1;
    groups.set(key, row);
  };

  for (const entry of rows) {
    const parsed = parseSignupAttributionBody(entry.signupAttribution);
    const key = groupKey(parsed);
    const existing = groups.get(key);
    const row =
      existing ??
      ({
        source: parsed ? cell(parsed.utm_source) : "без метки",
        medium: parsed ? cell(parsed.utm_medium) : "—",
        campaign: parsed ? cell(parsed.utm_campaign) : "—",
        unlabeled: !parsed,
        d7: 0,
        d30: 0,
        all: 0,
      } satisfies AttributionReportRow);
    bump(key, row, entry.createdAt);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.unlabeled !== b.unlabeled) return a.unlabeled ? 1 : -1;
    return b.all - a.all || a.source.localeCompare(b.source, "ru");
  });
}
