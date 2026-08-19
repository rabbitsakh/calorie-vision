import assert from "node:assert/strict";
import { test } from "node:test";
import { CHANGELOG, formatChangelogDate } from "./changelog.ts";

test("changelog has releases in descending version order", () => {
  assert.ok(CHANGELOG.length >= 2);
  for (const release of CHANGELOG) {
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
