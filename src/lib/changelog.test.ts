import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { formatChangelogDate } from "./changelog-types.ts";
import type { ChangelogRelease } from "./changelog-types.ts";

test("generated changelog matches package version at the top", () => {
  const packageJson = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
    version?: string;
  };
  const changelog = JSON.parse(readFileSync(join(process.cwd(), "src/data/changelog.json"), "utf8")) as
    ChangelogRelease[];

  assert.ok(changelog.length > 0);
  assert.equal(changelog[0]?.version, packageJson.version);
  for (const release of changelog) {
    assert.match(release.version, /^\d+\.\d+\.\d+$/);
    assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(release.items.length > 0, `v${release.version} should have items`);
  }
});

test("formatChangelogDate renders Russian date", () => {
  const formatted = formatChangelogDate("2026-08-19");
  assert.match(formatted, /19/);
  assert.match(formatted, /2026/);
});
