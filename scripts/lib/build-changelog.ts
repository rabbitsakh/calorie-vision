import { buildChangelogReleases } from "../../src/lib/changelog-build.ts";
import { versionFromPullRequestCount } from "../../src/lib/app-version.ts";
import { listGitMergeEntries } from "./git-merge-log.ts";

export function buildChangelogFromMerges() {
  return buildChangelogReleases(listGitMergeEntries(), versionFromPullRequestCount);
}
