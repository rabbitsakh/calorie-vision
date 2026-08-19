import changelog from "../data/changelog.json";
import {
  formatChangelogDate,
  CHANGELOG_KIND_LABELS,
  type ChangelogItem,
  type ChangelogItemKind,
  type ChangelogRelease,
} from "./changelog-types";

export { formatChangelogDate, CHANGELOG_KIND_LABELS };
export type { ChangelogItem, ChangelogItemKind, ChangelogRelease };

export const CHANGELOG = changelog as ChangelogRelease[];
