import assert from "node:assert/strict";
import { test } from "node:test";
import { buildChangelogReleases, classifyChangelogKind } from "./changelog-build.ts";
import { formatChangelogDate } from "./changelog-types.ts";
import { APP_VERSION_EPOCH_MERGES, versionFromPullRequestCount } from "./app-version.ts";

test("classifies PR titles into changelog kinds", () => {
  assert.equal(classifyChangelogKind("Fix deploy script"), "fix");
  assert.equal(classifyChangelogKind("feat: multi dish recognition"), "feature");
  assert.equal(classifyChangelogKind("Auto version from merged PRs"), "improvement");
});

test("builds one release per version from merge inputs", () => {
  const releases = buildChangelogReleases(
    [
      {
        index: APP_VERSION_EPOCH_MERGES,
        dateKey: "2026-08-01",
        title: "Initial admin panel",
      },
      {
        index: APP_VERSION_EPOCH_MERGES + 1,
        dateKey: "2026-08-02",
        title: "Fix profile save",
      },
    ],
    versionFromPullRequestCount,
  );

  assert.equal(releases.length, 2);
  assert.equal(releases[0]?.version, "0.4.1");
  assert.equal(releases[1]?.version, "0.4.0");
  assert.equal(releases[0]?.items[0]?.kind, "fix");
});

test("formatChangelogDate renders Russian date", () => {
  const formatted = formatChangelogDate("2026-08-19");
  assert.match(formatted, /19/);
  assert.match(formatted, /2026/);
});
