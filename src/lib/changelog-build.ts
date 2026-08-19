import type { ChangelogItemKind, ChangelogRelease } from "./changelog-types";

export type ChangelogMergeInput = {
  index: number;
  dateKey: string;
  title: string;
};

export function classifyChangelogKind(title: string): ChangelogItemKind {
  const lower = title.toLowerCase();
  if (/^(fix|исправ)/.test(lower) || lower.includes("fix:") || lower.includes("bug")) {
    return "fix";
  }
  if (/^(feat|add|нов|feature|добав)/.test(lower) || lower.includes("feat:")) {
    return "feature";
  }
  return "improvement";
}

export function buildChangelogReleases(
  merges: ChangelogMergeInput[],
  versionForIndex: (index: number) => string,
): ChangelogRelease[] {
  const chronological: ChangelogRelease[] = [];

  for (const merge of merges) {
    const version = versionForIndex(merge.index);
    const item = { kind: classifyChangelogKind(merge.title), text: merge.title };
    const last = chronological[chronological.length - 1];

    if (last?.version === version) {
      last.items.push(item);
      last.date = merge.dateKey;
      continue;
    }

    chronological.push({
      version,
      date: merge.dateKey,
      summary: merge.title,
      items: [item],
    });
  }

  return chronological.reverse();
}
