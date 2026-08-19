export type ChangelogItemKind = "feature" | "fix" | "improvement";

export type ChangelogItem = {
  kind: ChangelogItemKind;
  text: string;
};

export type ChangelogRelease = {
  version: string;
  date: string;
  summary?: string;
  items: ChangelogItem[];
};

export const CHANGELOG_KIND_LABELS: Record<ChangelogItemKind, string> = {
  feature: "Новое",
  fix: "Исправление",
  improvement: "Улучшение",
};

export function formatChangelogDate(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
